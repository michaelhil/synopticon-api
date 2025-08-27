/**
 * Context Aggregator
 * Combines conversation, speaker, and temporal contexts into a unified interface
 */

import { createConversationContextManager, type ConversationContextManager, type ConversationState } from './conversation-context.js';
import { createSpeakerContextManager, type SpeakerContextManager, type SpeakerProfile } from './speaker-context.js';
import { createTemporalContextManager, type TemporalContextManager, type TemporalSession } from './temporal-context.js';

export interface UnifiedContext {
  conversationId: string;
  sessionId: string;
  currentState: {
    conversation: ConversationState | null;
    session: TemporalSession | null;
    activeSpeakers: SpeakerProfile[];
    currentSpeaker: string | null;
  };
  statistics: {
    totalDuration: number;
    participantCount: number;
    turnCount: number;
    avgConfidence: number;
    topicCount: number;
  };
  insights: {
    dominantTopics: string[];
    speakerBalance: Record<string, number>;
    temporalPatterns: any;
    overallSentiment: number;
  };
}

export interface ContextAggregatorConfig {
  enableConversationTracking?: boolean;
  enableSpeakerTracking?: boolean;
  enableTemporalTracking?: boolean;
  syncContexts?: boolean;
  autoCreateSessions?: boolean;
}

export interface ContextAggregator {
  // Unified session management
  startUnifiedSession: (metadata?: Record<string, any>) => Promise<{
    conversationId: string;
    sessionId: string;
    temporalSessionId: string;
  }>;
  
  endUnifiedSession: () => Promise<void>;
  getUnifiedContext: () => Promise<UnifiedContext | null>;
  
  // Cross-context operations
  processIncomingData: (data: {
    transcript?: string;
    speakerFeatures?: any;
    timestamp: number;
    confidence: number;
  }) => Promise<void>;
  
  generateContextSummary: () => Promise<{
    conversation: any;
    speakers: any;
    temporal: any;
    unified: any;
  }>;
  
  // Individual context access
  conversation: ConversationContextManager;
  speaker: SpeakerContextManager;
  temporal: TemporalContextManager;
  
  // Analytics
  getAnalytics: () => Promise<{
    engagement: number;
    balance: number;
    quality: number;
    insights: string[];
  }>;
  
  exportContextData: (format: 'json' | 'csv' | 'summary') => Promise<any>;
}

/**
 * Create context aggregator with unified management
 */
export const createContextAggregator = (config: ContextAggregatorConfig = {}): ContextAggregator => {
  const configuration = {
    enableConversationTracking: config.enableConversationTracking !== false,
    enableSpeakerTracking: config.enableSpeakerTracking !== false,
    enableTemporalTracking: config.enableTemporalTracking !== false,
    syncContexts: config.syncContexts !== false,
    autoCreateSessions: config.autoCreateSessions !== false
  };

  // Create individual context managers
  const conversation = configuration.enableConversationTracking
    ? createConversationContextManager()
    : null;
  
  const speaker = configuration.enableSpeakerTracking
    ? createSpeakerContextManager()
    : null;
  
  const temporal = configuration.enableTemporalTracking
    ? createTemporalContextManager()
    : null;

  // State management
  let activeConversationId: string | null = null;
  let activeSessionId: string | null = null;
  let activeTemporalSessionId: string | null = null;

  const startUnifiedSession = async (metadata: Record<string, any> = {}) => {
    const promises = [];
    
    // Start conversation context
    if (conversation) {
      promises.push(conversation.startConversation());
    }
    
    // Start temporal context
    if (temporal) {
      promises.push(temporal.startSession(metadata));
    }

    const results = await Promise.all(promises);
    
    if (conversation) activeConversationId = results[0];
    if (temporal) activeTemporalSessionId = results[conversation ? 1 : 0];
    
    activeSessionId = activeConversationId || activeTemporalSessionId || `unified_${Date.now()}`;

    return {
      conversationId: activeConversationId || '',
      sessionId: activeSessionId,
      temporalSessionId: activeTemporalSessionId || ''
    };
  };

  const endUnifiedSession = async (): Promise<void> => {
    const promises = [];

    if (conversation && activeConversationId) {
      promises.push(conversation.endConversation(activeConversationId));
    }

    if (temporal && activeTemporalSessionId) {
      promises.push(temporal.endSession(activeTemporalSessionId));
    }

    await Promise.all(promises);

    activeConversationId = null;
    activeSessionId = null;
    activeTemporalSessionId = null;
  };

  const getUnifiedContext = async (): Promise<UnifiedContext | null> => {
    if (!activeSessionId) return null;

    const [conversationState, temporalState, activeSpeakers, currentSpeaker] = await Promise.all([
      conversation && activeConversationId ? conversation.getConversation(activeConversationId) : null,
      temporal && activeTemporalSessionId ? temporal.getSession(activeTemporalSessionId) : null,
      speaker ? speaker.getActiveSpeakers() : [],
      speaker ? speaker.getCurrentSpeaker() : null
    ]);

    // Calculate unified statistics
    const statistics = {
      totalDuration: temporalState?.statistics.totalDuration || 0,
      participantCount: conversationState?.participants.length || 0,
      turnCount: conversationState?.turns.length || 0,
      avgConfidence: conversationState?.turns.reduce((sum, turn) => sum + turn.confidence, 0) / (conversationState?.turns.length || 1) || 0,
      topicCount: conversationState?.topics.length || 0
    };

    // Generate insights
    const insights = {
      dominantTopics: conversationState?.topics.slice(0, 5) || [],
      speakerBalance: conversationState?.statistics.participationRate || {},
      temporalPatterns: temporal && activeTemporalSessionId ? await temporal.analyzeTemporalPatterns(activeTemporalSessionId) : null,
      overallSentiment: conversationState?.sentiment.overall || 0
    };

    return {
      conversationId: activeConversationId || '',
      sessionId: activeSessionId,
      currentState: {
        conversation: conversationState,
        session: temporalState,
        activeSpeakers: activeSpeakers || [],
        currentSpeaker
      },
      statistics,
      insights
    };
  };

  const processIncomingData = async (data: {
    transcript?: string;
    speakerFeatures?: any;
    timestamp: number;
    confidence: number;
  }): Promise<void> => {
    const { transcript, speakerFeatures, timestamp, confidence } = data;

    // Process speaker identification
    let speakerId: string | null = null;
    if (speaker && speakerFeatures) {
      speakerId = await speaker.identifySpeaker(speakerFeatures);
      
      if (!speakerId && configuration.autoCreateSessions) {
        // Register new speaker
        speakerId = await speaker.registerSpeaker({
          voiceCharacteristics: speakerFeatures,
          metadata: { confidence }
        });
      }
    }

    // Add conversation turn
    if (conversation && activeConversationId && transcript && speakerId) {
      await conversation.addTurn(activeConversationId, {
        id: `turn_${timestamp}`,
        participantId: speakerId,
        content: transcript,
        timestamp,
        confidence
      });
    }

    // Add temporal event
    if (temporal && activeTemporalSessionId) {
      await temporal.addEvent(activeTemporalSessionId, {
        timestamp,
        type: transcript ? 'speech' : 'pause',
        data: {
          transcript,
          speakerId,
          confidence,
          duration: 0 // Would be calculated from audio data
        }
      });
    }

    // Track speaker activity
    if (speaker && speakerId) {
      await speaker.trackSpeakerChange({
        speakerId,
        startTime: timestamp,
        endTime: timestamp, // Would be calculated from actual speech segment
        confidence,
        audioFeatures: speakerFeatures,
        transcript
      });
    }
  };

  const generateContextSummary = async () => {
    const unified = await getUnifiedContext();
    
    return {
      conversation: conversation && activeConversationId 
        ? await conversation.getConversation(activeConversationId)
        : null,
      
      speakers: speaker 
        ? await speaker.getAllSpeakers()
        : null,
      
      temporal: temporal && activeTemporalSessionId
        ? await temporal.getSession(activeTemporalSessionId)
        : null,
      
      unified
    };
  };

  const getAnalytics = async () => {
    const unified = await getUnifiedContext();
    
    if (!unified) {
      return {
        engagement: 0,
        balance: 0,
        quality: 0,
        insights: []
      };
    }

    // Calculate engagement (based on participation and turn frequency)
    const engagement = Math.min(1, (unified.statistics.turnCount / Math.max(1, unified.statistics.totalDuration / 60000)) / 5);
    
    // Calculate balance (evenness of speaker participation)
    const participationValues = Object.values(unified.insights.speakerBalance);
    const balance = participationValues.length > 1 
      ? 1 - (Math.max(...participationValues) - Math.min(...participationValues))
      : 1;
    
    // Calculate quality (based on confidence and other factors)
    const quality = unified.statistics.avgConfidence;
    
    // Generate insights
    const insights = [];
    if (engagement < 0.3) insights.push('Low engagement detected');
    if (balance < 0.5) insights.push('Uneven speaker participation');
    if (quality < 0.7) insights.push('Audio quality issues detected');
    if (unified.statistics.topicCount > 5) insights.push('Diverse topic coverage');
    
    return {
      engagement,
      balance,
      quality,
      insights
    };
  };

  const exportContextData = async (format: 'json' | 'csv' | 'summary') => {
    const summary = await generateContextSummary();
    
    switch (format) {
      case 'json':
        return JSON.stringify(summary, null, 2);
      
      case 'csv':
        // Simple CSV export for conversation turns
        if (summary.conversation) {
          const header = 'timestamp,speaker,content,confidence\n';
          const rows = summary.conversation.turns.map(turn =>
            `${turn.timestamp},${turn.participantId},"${turn.content}",${turn.confidence}`
          ).join('\n');
          return header + rows;
        }
        return '';
      
      case 'summary':
        const unified = summary.unified;
        return {
          sessionInfo: {
            duration: unified?.statistics.totalDuration || 0,
            participants: unified?.statistics.participantCount || 0,
            turns: unified?.statistics.turnCount || 0
          },
          keyInsights: unified?.insights.dominantTopics || [],
          sentiment: unified?.insights.overallSentiment || 0,
          quality: unified?.statistics.avgConfidence || 0
        };
      
      default:
        return summary;
    }
  };

  // Create proxy objects to handle null cases gracefully
  const conversationProxy: ConversationContextManager = new Proxy({} as ConversationContextManager, {
    get: (target, prop) => {
      if (conversation) return conversation[prop as keyof ConversationContextManager];
      return async () => null; // No-op for disabled features
    }
  });

  const speakerProxy: SpeakerContextManager = new Proxy({} as SpeakerContextManager, {
    get: (target, prop) => {
      if (speaker) return speaker[prop as keyof SpeakerContextManager];
      return async () => null; // No-op for disabled features
    }
  });

  const temporalProxy: TemporalContextManager = new Proxy({} as TemporalContextManager, {
    get: (target, prop) => {
      if (temporal) return temporal[prop as keyof TemporalContextManager];
      return async () => null; // No-op for disabled features
    }
  });

  return {
    startUnifiedSession,
    endUnifiedSession,
    getUnifiedContext,
    processIncomingData,
    generateContextSummary,
    conversation: conversationProxy,
    speaker: speakerProxy,
    temporal: temporalProxy,
    getAnalytics,
    exportContextData
  };
};