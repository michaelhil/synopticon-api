/**
 * Pipeline Events System
 * Event management for pipeline communication
 * Following functional programming patterns with factory functions
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export type EventCallback = (...args: any[]) => void;
export type UnsubscribeFunction = () => void;

export interface PipelineEvents {
  on: (event: string, callback: EventCallback) => UnsubscribeFunction;
  off: (event: string, callback: EventCallback) => void;
  once: (event: string, callback: EventCallback) => UnsubscribeFunction;
  emit: (event: string, data?: any) => void;
  removeAllListeners: (event?: string) => void;
  listenerCount: (event: string) => number;
  eventNames: () => string[];
  setMaxListeners: (max: number) => void;
  getMaxListeners: () => number;
  
  // Aliases for compatibility
  addEventListener: (event: string, callback: EventCallback) => UnsubscribeFunction;
  removeEventListener: (event: string, callback: EventCallback) => void;
  dispatch: (event: string, data?: any) => void;
}

export interface EventsConfig {
  maxListeners: number;
  errorHandling: 'log' | 'throw' | 'silent';
  async: boolean;
}

interface PipelineEventsState {
  listeners: Map<string, EventCallback[]>;
  maxListeners: number;
}

// Create pipeline events factory
export const createPipelineEvents = (): PipelineEvents => {
  const state: PipelineEventsState = {
    listeners: new Map(),
    maxListeners: 100
  };

  // Add event listener
  const on = (event: string, callback: EventCallback): UnsubscribeFunction => {
    if (!state.listeners.has(event)) {
      state.listeners.set(event, []);
    }
    
    const listeners = state.listeners.get(event)!;
    
    if (listeners.length >= state.maxListeners) {
      console.warn(`Max listeners (${state.maxListeners}) reached for event: ${event}`);
    }
    
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => off(event, callback);
  };

  // Remove event listener
  const off = (event: string, callback: EventCallback): void => {
    if (!state.listeners.has(event)) return;
    
    const listeners = state.listeners.get(event)!;
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    // Clean up empty listener arrays
    if (listeners.length === 0) {
      state.listeners.delete(event);
    }
  };

  // Add one-time event listener
  const once = (event: string, callback: EventCallback): UnsubscribeFunction => {
    const wrappedCallback = (...args: any[]) => {
      callback(...args);
      off(event, wrappedCallback);
    };
    
    return on(event, wrappedCallback);
  };

  // Emit event
  const emit = (event: string, data?: any): void => {
    if (!state.listeners.has(event)) return;
    
    const listeners = [...state.listeners.get(event)!]; // Create copy to avoid mutation during iteration
    
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  };

  // Remove all listeners for an event or all events
  const removeAllListeners = (event?: string): void => {
    if (event) {
      state.listeners.delete(event);
    } else {
      state.listeners.clear();
    }
  };

  // Get listener count for an event
  const listenerCount = (event: string): number => {
    if (!state.listeners.has(event)) return 0;
    return state.listeners.get(event)!.length;
  };

  // Get all event names
  const eventNames = (): string[] => Array.from(state.listeners.keys());

  // Set max listeners
  const setMaxListeners = (max: number): void => {
    state.maxListeners = max;
  };

  // Get max listeners
  const getMaxListeners = (): number => state.maxListeners;

  return {
    on,
    off,
    once,
    emit,
    removeAllListeners,
    listenerCount,
    eventNames,
    setMaxListeners,
    getMaxListeners,
    
    // Aliases for compatibility
    addEventListener: on,
    removeEventListener: off,
    dispatch: emit
  };
};

// Export default events configuration
export const DEFAULT_EVENTS_CONFIG: EventsConfig = {
  maxListeners: 100,
  errorHandling: 'log', // 'log', 'throw', or 'silent'
  async: false
};