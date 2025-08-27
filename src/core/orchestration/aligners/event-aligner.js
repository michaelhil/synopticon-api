/**
 * Event-Driven Aligner
 * Trigger-based synchronization using external events
 */

import { createSyncMetrics } from '../sync-metrics.js';

// Event-driven synchronization (trigger-based)
export const createEventDrivenAligner = () => {
  const state = {
    events: [],
    eventWindow: 100, // 100ms window around events
    lastEventTime: null,
    eventTypes: new Set(),
    alignmentStats: {
      totalAlignments: 0,
      successfulAlignments: 0,
      averageEventDistance: 0
    }
  };

  const registerEvent = (eventType, timestamp = Date.now(), metadata = {}) => {
    const event = { 
      type: eventType, 
      timestamp, 
      metadata,
      id: `${eventType}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    state.events.push(event);
    state.lastEventTime = timestamp;
    state.eventTypes.add(eventType);
    
    // Keep only recent events
    const cutoff = timestamp - 60000; // 1 minute
    state.events = state.events.filter(e => e.timestamp > cutoff);
    
    return event.id;
  };

  const align = (streamData, eventType = null) => {
    const timestamp = streamData.timestamp || Date.now();
    
    // Find the nearest event
    let nearestEvent = null;
    let minDistance = Infinity;
    
    for (const event of state.events) {
      if (eventType && event.type !== eventType) continue;
      
      const distance = Math.abs(timestamp - event.timestamp);
      if (distance < minDistance && distance <= state.eventWindow) {
        minDistance = distance;
        nearestEvent = event;
      }
    }

    // Update alignment statistics
    state.alignmentStats.totalAlignments++;
    
    if (nearestEvent) {
      state.alignmentStats.successfulAlignments++;
      state.alignmentStats.averageEventDistance = 
        (state.alignmentStats.averageEventDistance * (state.alignmentStats.successfulAlignments - 1) + minDistance) / 
        state.alignmentStats.successfulAlignments;
      
      return {
        alignedTimestamp: nearestEvent.timestamp,
        confidence: Math.max(0, 1 - minDistance / state.eventWindow),
        offset: timestamp - nearestEvent.timestamp,
        event: nearestEvent,
        streamId: streamData.streamId,
        eventDistance: minDistance
      };
    }

    return {
      alignedTimestamp: timestamp,
      confidence: 0.1, // Low confidence without event alignment
      offset: 0,
      event: null,
      streamId: streamData.streamId,
      eventDistance: null
    };
  };

  const alignToEvent = (streamDataArray, eventId) => {
    const event = state.events.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`);
    }

    const results = [];
    for (const streamData of streamDataArray) {
      const timestamp = streamData.timestamp || Date.now();
      const distance = Math.abs(timestamp - event.timestamp);
      
      if (distance <= state.eventWindow) {
        results.push({
          alignedTimestamp: event.timestamp,
          confidence: Math.max(0, 1 - distance / state.eventWindow),
          offset: timestamp - event.timestamp,
          event,
          streamId: streamData.streamId,
          eventDistance: distance,
          data: streamData
        });
      }
    }
    
    return results;
  };

  const getQuality = () => {
    const successRate = state.alignmentStats.totalAlignments > 0 ? 
      state.alignmentStats.successfulAlignments / state.alignmentStats.totalAlignments : 0;
    
    const avgDistance = state.alignmentStats.averageEventDistance;
    const distanceQuality = Math.max(0, 1 - avgDistance / state.eventWindow);
    
    return createSyncMetrics({
      quality: successRate * distanceQuality,
      latency: avgDistance,
      jitter: Math.max(0, avgDistance - state.eventWindow / 2),
      alignmentAccuracy: avgDistance
    });
  };

  const getEventHistory = (eventType = null, limit = 50) => {
    let events = [...state.events];
    
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }
    
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  };

  const getEventTypes = () => Array.from(state.eventTypes);

  const removeOldEvents = (maxAge = 60000) => {
    const cutoff = Date.now() - maxAge;
    const originalLength = state.events.length;
    state.events = state.events.filter(e => e.timestamp > cutoff);
    return originalLength - state.events.length;
  };

  const updateConfig = (newConfig) => {
    if (newConfig.eventWindow !== undefined) {
      state.eventWindow = newConfig.eventWindow;
    }
  };

  const reset = () => {
    state.events = [];
    state.lastEventTime = null;
    state.eventTypes.clear();
    state.alignmentStats = {
      totalAlignments: 0,
      successfulAlignments: 0,
      averageEventDistance: 0
    };
  };

  const getStats = () => ({
    totalEvents: state.events.length,
    eventTypes: Array.from(state.eventTypes),
    lastEventTime: state.lastEventTime,
    eventWindow: state.eventWindow,
    alignmentStats: { ...state.alignmentStats }
  });

  return { 
    align, 
    alignToEvent,
    registerEvent,
    getQuality,
    getEventHistory,
    getEventTypes,
    removeOldEvents,
    updateConfig,
    reset,
    getStats,
    strategy: 'event_driven'
  };
};