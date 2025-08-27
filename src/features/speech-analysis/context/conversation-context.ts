/**
 * Conversation Context Manager
 * Manages conversation state, participants, and dialogue flow
 */

import { createLLMClient } from '../llm-client.js';
import {
  createConversationContext,
  createSpeechChunk,
  createSpeechEvent
} from '../../../core/configuration/types.ts';

export interface ConversationParticipant {
  readonly id: string;
  readonly name?: string;
  readonly role?: 'speaker' | 'listener' | 'moderator';
  readonly metadata?: Record<string, any>;
}

export interface ConversationTurn {
  readonly id: string;
  readonly participantId: string;
  readonly content: string;
  readonly timestamp: number;
  readonly duration?: number;
  readonly confidence: number;
  readonly metadata?: Record<string, any>;
}

export interface ConversationState {
  readonly id: string;
  readonly participants: ConversationParticipant[];
  readonly turns: ConversationTurn[];
  readonly currentSpeaker: string | null;
  readonly startTime: number;
  readonly lastActivity: number;
  readonly topics: string[];
  readonly sentiment: {
    overall: number;
    byParticipant: Record<string, number>;
  };
  readonly statistics: {
    totalTurns: number;
    totalDuration: number;
    avgTurnLength: number;
    participationRate: Record<string, number>;
  };
}

export interface ConversationContextConfig {
  maxTurns?: number;
  turnTimeoutMs?: number;
  autoSentimentAnalysis?: boolean;
  trackParticipation?: boolean;
  enableTopicTracking?: boolean;
}

export interface ConversationContextManager {
  // Conversation management
  startConversation: (participants?: ConversationParticipant[]) => Promise<string>;
  endConversation: (conversationId: string) => Promise<void>;
  getConversation: (conversationId: string) => Promise<ConversationState | null>;
  
  // Participant management
  addParticipant: (conversationId: string, participant: ConversationParticipant) => Promise<void>;
  removeParticipant: (conversationId: string, participantId: string) => Promise<void>;
  updateParticipant: (conversationId: string, participant: ConversationParticipant) => Promise<void>;
  
  // Turn management
  addTurn: (conversationId: string, turn: ConversationTurn) => Promise<void>;
  getCurrentSpeaker: (conversationId: string) => Promise<string | null>;
  setSpeaker: (conversationId: string, participantId: string) => Promise<void>;
  
  // Analysis
  analyzeSentiment: (conversationId: string) => Promise<{ overall: number; byParticipant: Record<string, number> }>;
  extractTopics: (conversationId: string) => Promise<string[]>;
  getStatistics: (conversationId: string) => Promise<ConversationState['statistics']>;
  
  // State management
  getState: (conversationId: string) => Promise<ConversationState | null>;
  clearConversation: (conversationId: string) => Promise<void>;
}

/**
 * Create conversation context manager
 */
export const createConversationContextManager = (config: ConversationContextConfig = {}): ConversationContextManager => {
  const configuration = {
    maxTurns: config.maxTurns || 1000,
    turnTimeoutMs: config.turnTimeoutMs || 30000,
    autoSentimentAnalysis: config.autoSentimentAnalysis !== false,
    trackParticipation: config.trackParticipation !== false,
    enableTopicTracking: config.enableTopicTracking !== false
  };

  const conversations = new Map<string, ConversationState>();
  const llmClient = createLLMClient();

  const generateId = (): string => {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const startConversation = async (participants: ConversationParticipant[] = []): Promise<string> => {
    const id = generateId();
    const now = Date.now();
    
    const conversation: ConversationState = {
      id,
      participants: [...participants],
      turns: [],
      currentSpeaker: null,
      startTime: now,
      lastActivity: now,
      topics: [],
      sentiment: {
        overall: 0,
        byParticipant: {}
      },
      statistics: {
        totalTurns: 0,
        totalDuration: 0,
        avgTurnLength: 0,
        participationRate: {}
      }
    };

    conversations.set(id, conversation);
    return id;
  };

  const endConversation = async (conversationId: string): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    // Update final statistics
    if (configuration.autoSentimentAnalysis) {
      await analyzeSentiment(conversationId);
    }

    // Keep conversation for historical access
    // Could implement archival logic here
  };

  const getConversation = async (conversationId: string): Promise<ConversationState | null> => {
    return conversations.get(conversationId) || null;
  };

  const addParticipant = async (conversationId: string, participant: ConversationParticipant): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    const updated: ConversationState = {
      ...conversation,
      participants: [...conversation.participants, participant],
      lastActivity: Date.now()
    };

    conversations.set(conversationId, updated);
  };

  const removeParticipant = async (conversationId: string, participantId: string): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    const updated: ConversationState = {
      ...conversation,
      participants: conversation.participants.filter(p => p.id !== participantId),
      currentSpeaker: conversation.currentSpeaker === participantId ? null : conversation.currentSpeaker,
      lastActivity: Date.now()
    };

    conversations.set(conversationId, updated);
  };

  const updateParticipant = async (conversationId: string, participant: ConversationParticipant): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    const updated: ConversationState = {
      ...conversation,
      participants: conversation.participants.map(p => 
        p.id === participant.id ? participant : p
      ),
      lastActivity: Date.now()
    };

    conversations.set(conversationId, updated);
  };

  const addTurn = async (conversationId: string, turn: ConversationTurn): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    const newTurns = [...conversation.turns, turn];
    
    // Enforce max turns limit
    if (newTurns.length > configuration.maxTurns) {
      newTurns.shift(); // Remove oldest turn
    }

    // Update statistics
    const totalDuration = newTurns.reduce((sum, t) => sum + (t.duration || 0), 0);
    const participationRate: Record<string, number> = {};
    
    if (configuration.trackParticipation) {
      for (const participant of conversation.participants) {
        const participantTurns = newTurns.filter(t => t.participantId === participant.id);
        participationRate[participant.id] = participantTurns.length / newTurns.length;
      }
    }

    const updated: ConversationState = {
      ...conversation,
      turns: newTurns,
      currentSpeaker: turn.participantId,
      lastActivity: turn.timestamp,
      statistics: {
        totalTurns: newTurns.length,
        totalDuration,
        avgTurnLength: newTurns.length > 0 ? totalDuration / newTurns.length : 0,
        participationRate
      }
    };

    conversations.set(conversationId, updated);
  };

  const getCurrentSpeaker = async (conversationId: string): Promise<string | null> => {
    const conversation = conversations.get(conversationId);
    return conversation?.currentSpeaker || null;
  };

  const setSpeaker = async (conversationId: string, participantId: string): Promise<void> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return;

    const updated: ConversationState = {
      ...conversation,
      currentSpeaker: participantId,
      lastActivity: Date.now()
    };

    conversations.set(conversationId, updated);
  };

  const analyzeSentiment = async (conversationId: string): Promise<{ overall: number; byParticipant: Record<string, number> }> => {
    const conversation = conversations.get(conversationId);
    if (!conversation) return { overall: 0, byParticipant: {} };

    // Simple sentiment analysis - could be enhanced with LLM
    const byParticipant: Record<string, number> = {};
    let totalSentiment = 0;
    let totalTurns = 0;

    for (const turn of conversation.turns) {
      // Placeholder sentiment calculation
      const sentiment = 0.5; // Would use actual analysis
      byParticipant[turn.participantId] = (byParticipant[turn.participantId] || 0) + sentiment;
      totalSentiment += sentiment;
      totalTurns++;
    }

    // Normalize scores
    for (const participantId in byParticipant) {
      const participantTurns = conversation.turns.filter(t => t.participantId === participantId).length;
      byParticipant[participantId] = byParticipant[participantId] / participantTurns;
    }

    const overall = totalTurns > 0 ? totalSentiment / totalTurns : 0;

    // Update conversation state
    const updated: ConversationState = {
      ...conversation,
      sentiment: { overall, byParticipant }
    };

    conversations.set(conversationId, updated);

    return { overall, byParticipant };
  };

  const extractTopics = async (conversationId: string): Promise<string[]> => {
    const conversation = conversations.get(conversationId);
    if (!conversation || !configuration.enableTopicTracking) return [];

    // Simple keyword extraction - could be enhanced with LLM
    const allText = conversation.turns.map(turn => turn.content).join(' ');
    const words = allText.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      if (word.length > 3) { // Filter short words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Get top topics
    const topics = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);

    // Update conversation state
    const updated: ConversationState = {
      ...conversation,
      topics
    };

    conversations.set(conversationId, updated);

    return topics;
  };

  const getStatistics = async (conversationId: string): Promise<ConversationState['statistics']> => {
    const conversation = conversations.get(conversationId);
    return conversation?.statistics || {
      totalTurns: 0,
      totalDuration: 0,
      avgTurnLength: 0,
      participationRate: {}
    };
  };

  const getState = async (conversationId: string): Promise<ConversationState | null> => {
    return conversations.get(conversationId) || null;
  };

  const clearConversation = async (conversationId: string): Promise<void> => {
    conversations.delete(conversationId);
  };

  return {
    startConversation,
    endConversation,
    getConversation,
    addParticipant,
    removeParticipant,
    updateParticipant,
    addTurn,
    getCurrentSpeaker,
    setSpeaker,
    analyzeSentiment,
    extractTopics,
    getStatistics,
    getState,
    clearConversation
  };
};