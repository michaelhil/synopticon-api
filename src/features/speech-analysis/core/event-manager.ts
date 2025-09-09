/**
 * Speech Analysis Event Management System
 * Handles event subscriptions, dispatching, and callback management
 */

export type EventCallback = (data: any) => void;

export interface EventSubscription {
  unsubscribe: () => void;
}

export interface SpeechAnalysisEvents {
  onReady: (data: { api: string; components: string[]; configuration: any }) => void;
  onTranscription: (data: { text: string; confidence: number; timestamp: number }) => void;
  onAnalysis: (data: { results: any[]; processingTime: number; timestamp: number }) => void;
  onError: (data: { error: string; source: string; timestamp: number }) => void;
  onStatusChange: (data: { status: string; details?: any; timestamp: number }) => void;
  onQualityUpdate: (data: { quality: any; metrics: any; timestamp: number }) => void;
  onAnalyticsUpdate: (data: { type: string; data: any; timestamp: number }) => void;
}

export type EventType = keyof SpeechAnalysisEvents;

/**
 * Creates an event manager for speech analysis
 */
export const createEventManager = () => {
  const callbacks: Record<EventType, EventCallback[]> = {
    onReady: [],
    onTranscription: [],
    onAnalysis: [],
    onError: [],
    onStatusChange: [],
    onQualityUpdate: [],
    onAnalyticsUpdate: []
  };

  let qualityUpdateInterval: NodeJS.Timeout | null = null;
  let analyticsUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Subscribe to an event
   */
  const subscribe = (eventType: EventType, callback: EventCallback): EventSubscription => {
    if (!callbacks[eventType]) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    callbacks[eventType].push(callback);

    return {
      unsubscribe: () => {
        const index = callbacks[eventType].indexOf(callback);
        if (index !== -1) {
          callbacks[eventType].splice(index, 1);
        }
      }
    };
  };

  /**
   * Emit an event to all subscribers
   */
  const emit = (eventType: EventType, data: any): void => {
    const eventCallbacks = callbacks[eventType];
    if (eventCallbacks.length === 0) return;

    eventCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Event callback error for ${eventType}:`, error);
      }
    });
  };

  /**
   * Setup event forwarding from streaming system
   */
  const setupEventForwarding = (streamingSystem: any): void => {
    if (!streamingSystem) return;

    // Forward transcription events
    streamingSystem.onTranscription?.((data: any) => {
      emit('onTranscription', {
        text: data.text,
        confidence: data.confidence || 0.95,
        timestamp: Date.now(),
        sessionId: data.sessionId,
        isFinal: data.isFinal
      });
    });

    // Forward analysis events
    streamingSystem.onAnalysis?.((data: any) => {
      emit('onAnalysis', {
        results: data.results || data,
        processingTime: data.processingTime || 0,
        timestamp: Date.now(),
        sessionId: data.sessionId,
        text: data.text
      });
    });

    // Forward error events
    streamingSystem.onError?.((data: any) => {
      emit('onError', {
        error: data.error || data.message || String(data),
        source: data.source || 'streaming_system',
        timestamp: Date.now(),
        sessionId: data.sessionId,
        details: data.details
      });
    });

    // Forward status change events
    streamingSystem.onStatusChange?.((data: any) => {
      emit('onStatusChange', {
        status: data.status,
        details: data.details,
        timestamp: Date.now(),
        sessionId: data.sessionId,
        component: 'streaming_system'
      });
    });
  };

  /**
   * Setup audio quality event updates
   */
  const setupAudioQualityEvents = (audioQualityAnalyzer: any): void => {
    if (!audioQualityAnalyzer || qualityUpdateInterval) return;

    qualityUpdateInterval = setInterval(() => {
      if (audioQualityAnalyzer.isAnalyzing?.()) {
        try {
          const quality = audioQualityAnalyzer.getCurrentQuality?.();
          const stats = audioQualityAnalyzer.getQualityStats?.();

          if (quality || stats) {
            emit('onQualityUpdate', {
              quality,
              metrics: stats,
              timestamp: Date.now(),
              type: 'audio_quality_update'
            });
          }
        } catch (error) {
          console.warn('Audio quality update error:', error);
        }
      }
    }, 1000); // Update every second
  };

  /**
   * Setup analytics event updates
   */
  const setupAnalyticsEvents = (conversationAnalytics: any): void => {
    if (!conversationAnalytics || analyticsUpdateInterval) return;

    analyticsUpdateInterval = setInterval(() => {
      if (conversationAnalytics.isAnalyzing?.()) {
        try {
          const metrics = conversationAnalytics.getMetrics?.();

          if (metrics) {
            emit('onAnalyticsUpdate', {
              type: 'analytics_update',
              data: metrics,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.warn('Analytics update error:', error);
        }
      }
    }, 5000); // Update every 5 seconds
  };

  /**
   * Cleanup all intervals and subscriptions
   */
  const cleanup = (): void => {
    if (qualityUpdateInterval) {
      clearInterval(qualityUpdateInterval);
      qualityUpdateInterval = null;
    }

    if (analyticsUpdateInterval) {
      clearInterval(analyticsUpdateInterval);
      analyticsUpdateInterval = null;
    }

    // Clear all callbacks
    Object.keys(callbacks).forEach(eventType => {
      callbacks[eventType as EventType] = [];
    });
  };

  /**
   * Get current subscriber counts
   */
  const getSubscriberCounts = (): Record<EventType, number> => {
    const counts = {} as Record<EventType, number>;
    Object.keys(callbacks).forEach(eventType => {
      counts[eventType as EventType] = callbacks[eventType as EventType].length;
    });
    return counts;
  };

  /**
   * Check if any event has subscribers
   */
  const hasSubscribers = (eventType?: EventType): boolean => {
    if (eventType) {
      return callbacks[eventType].length > 0;
    }
    return Object.values(callbacks).some(callbackList => callbackList.length > 0);
  };

  return {
    // Core event methods
    subscribe,
    emit,

    // Event setup methods
    setupEventForwarding,
    setupAudioQualityEvents,
    setupAnalyticsEvents,

    // Management methods
    cleanup,
    getSubscriberCounts,
    hasSubscribers,

    // Convenience event subscription methods
    onReady: (callback: EventCallback) => subscribe('onReady', callback),
    onTranscription: (callback: EventCallback) => subscribe('onTranscription', callback),
    onAnalysis: (callback: EventCallback) => subscribe('onAnalysis', callback),
    onError: (callback: EventCallback) => subscribe('onError', callback),
    onStatusChange: (callback: EventCallback) => subscribe('onStatusChange', callback),
    onQualityUpdate: (callback: EventCallback) => subscribe('onQualityUpdate', callback),
    onAnalyticsUpdate: (callback: EventCallback) => subscribe('onAnalyticsUpdate', callback)
  };
};

export type EventManager = ReturnType<typeof createEventManager>;
