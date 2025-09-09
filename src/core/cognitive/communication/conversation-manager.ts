/**
 * Conversation Context Manager
 * Manages conversation history and context for communication sessions
 */

import type { Conversation, ConversationTurn, ConversationManager } from './types.js';

export interface ConversationManagerConfig {
  maxTurns?: number;
  maxAge?: number;
  cleanupInterval?: number;
}

/**
 * Create a conversation context manager
 */
export const createConversationManager = (config: ConversationManagerConfig = {}): ConversationManager => {
  const conversations = new Map<string, Conversation>();
  const maxTurns = config.maxTurns || 100;
  const maxAge = config.maxAge || 3600000; // 1 hour default
  
  let cleanupTimer: NodeJS.Timeout | null = null;
  
  // Start automatic cleanup if interval is specified
  if (config.cleanupInterval) {
    cleanupTimer = setInterval(() => cleanup(maxAge), config.cleanupInterval);
  }
  
  const getOrCreate = (sessionId: string): Conversation => {
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, {
        id: sessionId,
        turns: [],
        context: {},
        startTime: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      });
    }
    const conversation = conversations.get(sessionId)!;
    conversation.lastActivity = Date.now();
    return conversation;
  };
  
  const addTurn = (
    sessionId: string, 
    role: string, 
    content: string, 
    metadata: Record<string, any> = {}
  ): void => {
    const conversation = getOrCreate(sessionId);
    
    conversation.turns.push({
      role,
      content,
      timestamp: Date.now(),
      metadata
    });
    
    conversation.lastActivity = Date.now();
    
    // Keep conversation history manageable
    if (conversation.turns.length > maxTurns) {
      // Keep the last half of max turns
      conversation.turns = conversation.turns.slice(-(maxTurns / 2));
    }
  };
  
  const getContext = (sessionId: string, requestedTurns: number = 10): ConversationTurn[] => {
    const conversation = conversations.get(sessionId);
    if (!conversation) return [];
    
    return conversation.turns.slice(-requestedTurns);
  };
  
  const updateContext = (sessionId: string, key: string, value: any): void => {
    const conversation = getOrCreate(sessionId);
    conversation.context[key] = value;
    conversation.lastActivity = Date.now();
  };
  
  const cleanup = (ageThreshold: number = maxAge): void => {
    const now = Date.now();
    const sessionsToDelete: string[] = [];
    
    for (const [id, conv] of conversations.entries()) {
      if (now - conv.lastActivity > ageThreshold) {
        sessionsToDelete.push(id);
      }
    }
    
    sessionsToDelete.forEach(id => conversations.delete(id));
    
    if (sessionsToDelete.length > 0) {
      console.log(`Cleaned up ${sessionsToDelete.length} inactive conversations`);
    }
  };
  
  const getConversation = (sessionId: string): Conversation | undefined => {
    return conversations.get(sessionId);
  };
  
  const getAllConversations = (): Conversation[] => {
    return Array.from(conversations.values());
  };
  
  const deleteConversation = (sessionId: string): boolean => {
    return conversations.delete(sessionId);
  };
  
  const getStats = (): Record<string, any> => {
    const convArray = Array.from(conversations.values());
    const now = Date.now();
    
    return {
      totalConversations: conversations.size,
      activeConversations: convArray.filter(c => now - c.lastActivity < 300000).length, // Active in last 5 min
      totalTurns: convArray.reduce((sum, c) => sum + c.turns.length, 0),
      averageTurnsPerConversation: conversations.size > 0 
        ? convArray.reduce((sum, c) => sum + c.turns.length, 0) / conversations.size 
        : 0,
      oldestConversation: convArray.reduce((oldest, c) => 
        c.startTime < oldest ? c.startTime : oldest, now),
      newestActivity: convArray.reduce((newest, c) => 
        c.lastActivity > newest ? c.lastActivity : newest, 0)
    };
  };
  
  const destroy = (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    conversations.clear();
  };
  
  return { 
    getOrCreate, 
    addTurn, 
    getContext, 
    updateContext, 
    cleanup,
    getConversation,
    getAllConversations,
    deleteConversation,
    getStats,
    destroy
  };
};