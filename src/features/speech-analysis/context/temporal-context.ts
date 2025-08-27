/**
 * Temporal Context Manager
 * Manages time-based context, session boundaries, and temporal relationships
 */

export interface TimeWindow {
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
}

export interface TemporalEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'speech' | 'pause' | 'interrupt' | 'topic_change' | 'speaker_change';
  readonly data: any;
  readonly metadata?: Record<string, any>;
}

export interface TemporalSession {
  readonly id: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly events: TemporalEvent[];
  readonly boundaries: {
    automatic: TimeWindow[];
    manual: TimeWindow[];
  };
  readonly statistics: {
    totalDuration: number;
    activeSpeechTime: number;
    pauseTime: number;
    eventCount: number;
    avgEventGap: number;
  };
  readonly metadata: Record<string, any>;
}

export interface TemporalContextConfig {
  sessionTimeoutMs?: number;
  maxSessionDuration?: number;
  pauseThresholdMs?: number;
  topicChangeThresholdMs?: number;
  enableAutoBoundaries?: boolean;
  boundaryDetectionSensitivity?: number;
}

export interface TemporalContextManager {
  // Session management
  startSession: (metadata?: Record<string, any>) => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  getSession: (sessionId: string) => Promise<TemporalSession | null>;
  getCurrentSession: () => Promise<TemporalSession | null>;
  
  // Event tracking
  addEvent: (sessionId: string, event: Omit<TemporalEvent, 'id'>) => Promise<void>;
  getEvents: (sessionId: string, timeWindow?: TimeWindow) => Promise<TemporalEvent[]>;
  getEventsInRange: (sessionId: string, startTime: number, endTime: number) => Promise<TemporalEvent[]>;
  
  // Boundary detection
  detectAutoBoundaries: (sessionId: string) => Promise<TimeWindow[]>;
  addManualBoundary: (sessionId: string, boundary: TimeWindow) => Promise<void>;
  getBoundaries: (sessionId: string) => Promise<{ automatic: TimeWindow[]; manual: TimeWindow[] }>;
  
  // Temporal analysis
  analyzeTemporalPatterns: (sessionId: string) => Promise<{
    speechPatterns: { avgDuration: number; frequency: number };
    pausePatterns: { avgDuration: number; frequency: number };
    interactionPatterns: { turnTaking: number; overlap: number };
  }>;
  
  getTemporalStatistics: (sessionId: string) => Promise<TemporalSession['statistics']>;
  
  // Context queries
  getContextAtTime: (sessionId: string, timestamp: number, windowMs?: number) => Promise<{
    events: TemporalEvent[];
    boundaries: TimeWindow[];
    speakerActivity: any[];
  }>;
  
  findSimilarTimeWindows: (sessionId: string, referenceWindow: TimeWindow) => Promise<TimeWindow[]>;
  
  // Session lifecycle
  getAllSessions: () => Promise<TemporalSession[]>;
  getActiveSessions: () => Promise<TemporalSession[]>;
  clearSession: (sessionId: string) => Promise<void>;
}

/**
 * Create temporal context manager
 */
export const createTemporalContextManager = (config: TemporalContextConfig = {}): TemporalContextManager => {
  const configuration = {
    sessionTimeoutMs: config.sessionTimeoutMs || 1800000, // 30 minutes
    maxSessionDuration: config.maxSessionDuration || 7200000, // 2 hours
    pauseThresholdMs: config.pauseThresholdMs || 2000,
    topicChangeThresholdMs: config.topicChangeThresholdMs || 30000,
    enableAutoBoundaries: config.enableAutoBoundaries !== false,
    boundaryDetectionSensitivity: config.boundaryDetectionSensitivity || 0.7
  };

  const sessions = new Map<string, TemporalSession>();
  let currentSessionId: string | null = null;

  const generateId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateEventId = (): string => {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const startSession = async (metadata: Record<string, any> = {}): Promise<string> => {
    const id = generateId();
    const now = Date.now();
    
    const session: TemporalSession = {
      id,
      startTime: now,
      events: [],
      boundaries: {
        automatic: [],
        manual: []
      },
      statistics: {
        totalDuration: 0,
        activeSpeechTime: 0,
        pauseTime: 0,
        eventCount: 0,
        avgEventGap: 0
      },
      metadata
    };

    sessions.set(id, session);
    currentSessionId = id;
    
    return id;
  };

  const endSession = async (sessionId: string): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const now = Date.now();
    const updated: TemporalSession = {
      ...session,
      endTime: now,
      statistics: await calculateSessionStatistics(session)
    };

    sessions.set(sessionId, updated);
    
    if (currentSessionId === sessionId) {
      currentSessionId = null;
    }
  };

  const getSession = async (sessionId: string): Promise<TemporalSession | null> => {
    return sessions.get(sessionId) || null;
  };

  const getCurrentSession = async (): Promise<TemporalSession | null> => {
    return currentSessionId ? sessions.get(currentSessionId) || null : null;
  };

  const addEvent = async (sessionId: string, eventData: Omit<TemporalEvent, 'id'>): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const event: TemporalEvent = {
      ...eventData,
      id: generateEventId()
    };

    const events = [...session.events, event];
    
    // Auto-detect boundaries if enabled
    let autoBoundaries = session.boundaries.automatic;
    if (configuration.enableAutoBoundaries) {
      autoBoundaries = await detectAutoBoundariesFromEvents(events);
    }

    const updated: TemporalSession = {
      ...session,
      events,
      boundaries: {
        ...session.boundaries,
        automatic: autoBoundaries
      }
    };

    sessions.set(sessionId, updated);
  };

  const getEvents = async (sessionId: string, timeWindow?: TimeWindow): Promise<TemporalEvent[]> => {
    const session = sessions.get(sessionId);
    if (!session) return [];

    if (!timeWindow) {
      return session.events;
    }

    return session.events.filter(event =>
      event.timestamp >= timeWindow.startTime &&
      event.timestamp <= timeWindow.endTime
    );
  };

  const getEventsInRange = async (sessionId: string, startTime: number, endTime: number): Promise<TemporalEvent[]> => {
    return getEvents(sessionId, { startTime, endTime, duration: endTime - startTime });
  };

  const detectAutoBoundaries = async (sessionId: string): Promise<TimeWindow[]> => {
    const session = sessions.get(sessionId);
    if (!session) return [];

    return detectAutoBoundariesFromEvents(session.events);
  };

  const addManualBoundary = async (sessionId: string, boundary: TimeWindow): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const updated: TemporalSession = {
      ...session,
      boundaries: {
        ...session.boundaries,
        manual: [...session.boundaries.manual, boundary]
      }
    };

    sessions.set(sessionId, updated);
  };

  const getBoundaries = async (sessionId: string): Promise<{ automatic: TimeWindow[]; manual: TimeWindow[] }> => {
    const session = sessions.get(sessionId);
    return session?.boundaries || { automatic: [], manual: [] };
  };

  const analyzeTemporalPatterns = async (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        speechPatterns: { avgDuration: 0, frequency: 0 },
        pausePatterns: { avgDuration: 0, frequency: 0 },
        interactionPatterns: { turnTaking: 0, overlap: 0 }
      };
    }

    const speechEvents = session.events.filter(e => e.type === 'speech');
    const pauseEvents = session.events.filter(e => e.type === 'pause');
    const speakerChangeEvents = session.events.filter(e => e.type === 'speaker_change');

    const totalDuration = session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime;

    return {
      speechPatterns: {
        avgDuration: speechEvents.length > 0 ? speechEvents.reduce((sum, e) => sum + (e.data.duration || 0), 0) / speechEvents.length : 0,
        frequency: speechEvents.length / (totalDuration / 60000) // per minute
      },
      pausePatterns: {
        avgDuration: pauseEvents.length > 0 ? pauseEvents.reduce((sum, e) => sum + (e.data.duration || 0), 0) / pauseEvents.length : 0,
        frequency: pauseEvents.length / (totalDuration / 60000) // per minute
      },
      interactionPatterns: {
        turnTaking: speakerChangeEvents.length / (totalDuration / 60000), // per minute
        overlap: 0 // Would calculate from overlapping speech events
      }
    };
  };

  const getTemporalStatistics = async (sessionId: string): Promise<TemporalSession['statistics']> => {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        totalDuration: 0,
        activeSpeechTime: 0,
        pauseTime: 0,
        eventCount: 0,
        avgEventGap: 0
      };
    }

    return calculateSessionStatistics(session);
  };

  const getContextAtTime = async (sessionId: string, timestamp: number, windowMs: number = 30000) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        events: [],
        boundaries: [],
        speakerActivity: []
      };
    }

    const startTime = timestamp - windowMs / 2;
    const endTime = timestamp + windowMs / 2;

    const events = session.events.filter(event =>
      event.timestamp >= startTime && event.timestamp <= endTime
    );

    const boundaries = [
      ...session.boundaries.automatic,
      ...session.boundaries.manual
    ].filter(boundary =>
      (boundary.startTime <= timestamp && boundary.endTime >= timestamp) ||
      (boundary.startTime >= startTime && boundary.startTime <= endTime) ||
      (boundary.endTime >= startTime && boundary.endTime <= endTime)
    );

    return {
      events,
      boundaries,
      speakerActivity: events.filter(e => e.type === 'speaker_change' || e.type === 'speech')
    };
  };

  const findSimilarTimeWindows = async (sessionId: string, referenceWindow: TimeWindow): Promise<TimeWindow[]> => {
    const session = sessions.get(sessionId);
    if (!session) return [];

    // Simple implementation - find windows with similar event patterns
    const refEvents = await getEvents(sessionId, referenceWindow);
    const allBoundaries = [...session.boundaries.automatic, ...session.boundaries.manual];

    const similarWindows: TimeWindow[] = [];

    for (const boundary of allBoundaries) {
      if (Math.abs(boundary.duration - referenceWindow.duration) < referenceWindow.duration * 0.2) {
        const boundaryEvents = await getEvents(sessionId, boundary);
        
        // Simple similarity metric based on event types
        const similarity = calculateEventSimilarity(refEvents, boundaryEvents);
        
        if (similarity > 0.7) {
          similarWindows.push(boundary);
        }
      }
    }

    return similarWindows;
  };

  const getAllSessions = async (): Promise<TemporalSession[]> => {
    return Array.from(sessions.values());
  };

  const getActiveSessions = async (): Promise<TemporalSession[]> => {
    const now = Date.now();
    return Array.from(sessions.values()).filter(session =>
      !session.endTime && (now - session.startTime) < configuration.sessionTimeoutMs
    );
  };

  const clearSession = async (sessionId: string): Promise<void> => {
    sessions.delete(sessionId);
    if (currentSessionId === sessionId) {
      currentSessionId = null;
    }
  };

  return {
    startSession,
    endSession,
    getSession,
    getCurrentSession,
    addEvent,
    getEvents,
    getEventsInRange,
    detectAutoBoundaries,
    addManualBoundary,
    getBoundaries,
    analyzeTemporalPatterns,
    getTemporalStatistics,
    getContextAtTime,
    findSimilarTimeWindows,
    getAllSessions,
    getActiveSessions,
    clearSession
  };
};

// Helper functions

async function calculateSessionStatistics(session: TemporalSession): Promise<TemporalSession['statistics']> {
  const totalDuration = session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime;
  
  const speechEvents = session.events.filter(e => e.type === 'speech');
  const pauseEvents = session.events.filter(e => e.type === 'pause');
  
  const activeSpeechTime = speechEvents.reduce((sum, e) => sum + (e.data.duration || 0), 0);
  const pauseTime = pauseEvents.reduce((sum, e) => sum + (e.data.duration || 0), 0);
  
  const eventGaps = [];
  for (let i = 1; i < session.events.length; i++) {
    eventGaps.push(session.events[i].timestamp - session.events[i - 1].timestamp);
  }
  
  const avgEventGap = eventGaps.length > 0 ? eventGaps.reduce((a, b) => a + b, 0) / eventGaps.length : 0;

  return {
    totalDuration,
    activeSpeechTime,
    pauseTime,
    eventCount: session.events.length,
    avgEventGap
  };
}

async function detectAutoBoundariesFromEvents(events: TemporalEvent[]): Promise<TimeWindow[]> {
  const boundaries: TimeWindow[] = [];
  
  if (events.length < 2) return boundaries;
  
  // Simple gap-based boundary detection
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timestamp - events[i - 1].timestamp;
    
    if (gap > 30000) { // 30 second gap
      boundaries.push({
        startTime: events[i - 1].timestamp,
        endTime: events[i].timestamp,
        duration: gap
      });
    }
  }
  
  return boundaries;
}

function calculateEventSimilarity(events1: TemporalEvent[], events2: TemporalEvent[]): number {
  if (events1.length === 0 && events2.length === 0) return 1;
  if (events1.length === 0 || events2.length === 0) return 0;
  
  const types1 = events1.map(e => e.type).sort();
  const types2 = events2.map(e => e.type).sort();
  
  const intersection = types1.filter(type => types2.includes(type)).length;
  const union = new Set([...types1, ...types2]).size;
  
  return union > 0 ? intersection / union : 0;
}