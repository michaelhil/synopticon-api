/**
 * Event-Driven Aligner
 * Alignment using event correlation and pattern matching
 */

import { SynchronizationStrategy } from '../strategies/sync-strategies.js';
import { createSyncMetrics } from '../metrics/sync-metrics.js';

/**
 * Event correlation-based synchronization
 * Uses pattern matching and event correlation to align streams
 */
export const createEventDrivenAligner = (config = {}) => {
  const alignerConfig = {
    correlationWindow: config.correlationWindow || 1000, // ms
    minCorrelationScore: config.minCorrelationScore || 0.6,
    maxEventAge: config.maxEventAge || 5000, // ms
    patternMatchThreshold: config.patternMatchThreshold || 0.7,
    confidenceThreshold: config.confidenceThreshold || 0.6,
    ...config
  };

  const state = {
    eventStreams: new Map(),
    correlationMatrix: new Map(),
    patternLibrary: new Map(),
    alignmentHistory: [],
    metrics: {
      totalEvents: 0,
      correlationHits: 0,
      patternMatches: 0,
      avgCorrelationScore: 0
    }
  };

  // Create event stream tracker
  const createEventStream = (streamId) => ({
    id: streamId,
    events: [],
    patterns: [],
    correlationScore: 0,
    lastEventTime: 0
  });

  // Extract features from stream data for pattern matching
  const extractEventFeatures = (streamData) => {
    const features = {
      timestamp: streamData.timestamp,
      type: streamData.type || 'unknown',
      magnitude: streamData.magnitude || streamData.amplitude || 1,
      duration: streamData.duration || 0,
      frequency: streamData.frequency || 0
    };

    // Add contextual features
    if (streamData.audio) {
      features.audioEnergy = streamData.audio.energy || 0;
      features.audioFreq = streamData.audio.dominantFreq || 0;
    }

    if (streamData.video) {
      features.motionLevel = streamData.video.motion || 0;
      features.brightness = streamData.video.brightness || 0;
    }

    return features;
  };

  // Calculate correlation between two event sequences
  const calculateEventCorrelation = (events1, events2, timeWindow) => {
    if (events1.length === 0 || events2.length === 0) return 0;

    const correlationScores = [];

    for (const event1 of events1) {
      const correlatedEvents = events2.filter(event2 => 
        Math.abs(event1.timestamp - event2.timestamp) <= timeWindow
      );

      for (const event2 of correlatedEvents) {
        // Calculate feature similarity
        const featureSimilarity = calculateFeatureSimilarity(event1.features, event2.features);
        const timeSimilarity = 1 - (Math.abs(event1.timestamp - event2.timestamp) / timeWindow);
        
        correlationScores.push(featureSimilarity * 0.7 + timeSimilarity * 0.3);
      }
    }

    return correlationScores.length > 0 
      ? correlationScores.reduce((sum, score) => sum + score, 0) / correlationScores.length
      : 0;
  };

  // Calculate similarity between two feature vectors
  const calculateFeatureSimilarity = (features1, features2) => {
    const keys = new Set([...Object.keys(features1), ...Object.keys(features2)]);
    let similarity = 0;
    let validComparisons = 0;

    for (const key of keys) {
      if (features1[key] !== undefined && features2[key] !== undefined) {
        // Normalize feature values for comparison
        const val1 = typeof features1[key] === 'number' ? features1[key] : 0;
        const val2 = typeof features2[key] === 'number' ? features2[key] : 0;
        
        const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1);
        const diff = Math.abs(val1 - val2) / maxVal;
        
        similarity += (1 - diff);
        validComparisons++;
      }
    }

    return validComparisons > 0 ? similarity / validComparisons : 0;
  };

  // Detect patterns in event sequences
  const detectEventPatterns = (events) => {
    const patterns = [];
    const minPatternLength = 3;

    if (events.length < minPatternLength) return patterns;

    // Look for repeating patterns
    for (let i = 0; i < events.length - minPatternLength; i++) {
      for (let len = minPatternLength; len <= Math.min(10, events.length - i); len++) {
        const pattern = events.slice(i, i + len);
        const patternFeatures = pattern.map(e => e.features);
        
        // Check if this pattern repeats later
        for (let j = i + len; j <= events.length - len; j++) {
          const candidate = events.slice(j, j + len);
          const candidateFeatures = candidate.map(e => e.features);
          
          const similarity = calculatePatternSimilarity(patternFeatures, candidateFeatures);
          
          if (similarity > alignerConfig.patternMatchThreshold) {
            patterns.push({
              startIndex: i,
              length: len,
              repeatIndex: j,
              similarity,
              pattern: patternFeatures
            });
          }
        }
      }
    }

    return patterns;
  };

  // Calculate similarity between two patterns
  const calculatePatternSimilarity = (pattern1, pattern2) => {
    if (pattern1.length !== pattern2.length) return 0;

    const similarities = pattern1.map((features1, index) => 
      calculateFeatureSimilarity(features1, pattern2[index])
    );

    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  };

  const align = (streamData) => {
    const { streamId, timestamp } = streamData;
    const now = Date.now();

    // Initialize stream if needed
    if (!state.eventStreams.has(streamId)) {
      state.eventStreams.set(streamId, createEventStream(streamId));
    }

    const stream = state.eventStreams.get(streamId);
    const features = extractEventFeatures(streamData);

    // Add event to stream
    const event = {
      timestamp,
      arrivalTime: now,
      features,
      streamId
    };

    stream.events.push(event);
    stream.lastEventTime = timestamp;
    state.metrics.totalEvents++;

    // Cleanup old events
    const maxAge = alignerConfig.maxEventAge;
    stream.events = stream.events.filter(e => (now - e.arrivalTime) < maxAge);

    // Find correlations with other streams
    let bestCorrelationScore = 0;
    let alignedTimestamp = timestamp;
    let correlationOffset = 0;

    for (const [otherStreamId, otherStream] of state.eventStreams) {
      if (otherStreamId === streamId || otherStream.events.length === 0) continue;

      const correlationScore = calculateEventCorrelation(
        [event],
        otherStream.events.slice(-10), // Recent events
        alignerConfig.correlationWindow
      );

      if (correlationScore > bestCorrelationScore && correlationScore > alignerConfig.minCorrelationScore) {
        bestCorrelationScore = correlationScore;
        state.metrics.correlationHits++;

        // Find best matching event for alignment
        const matchingEvent = otherStream.events
          .slice(-10)
          .filter(e => Math.abs(e.timestamp - timestamp) <= alignerConfig.correlationWindow)
          .sort((a, b) => {
            const simA = calculateFeatureSimilarity(features, a.features);
            const simB = calculateFeatureSimilarity(features, b.features);
            return simB - simA;
          })[0];

        if (matchingEvent) {
          correlationOffset = timestamp - matchingEvent.timestamp;
          alignedTimestamp = matchingEvent.timestamp;
        }
      }
    }

    // Update correlation matrix
    if (bestCorrelationScore > 0) {
      const matrixKey = `${streamId}:correlation`;
      if (!state.correlationMatrix.has(matrixKey)) {
        state.correlationMatrix.set(matrixKey, []);
      }
      state.correlationMatrix.get(matrixKey).push(bestCorrelationScore);

      // Keep recent correlation scores
      const scores = state.correlationMatrix.get(matrixKey);
      if (scores.length > 20) {
        scores.splice(0, 10);
      }

      state.metrics.avgCorrelationScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    }

    // Detect patterns in current stream
    if (stream.events.length >= 10) {
      const patterns = detectEventPatterns(stream.events.slice(-20));
      if (patterns.length > 0) {
        stream.patterns = patterns;
        state.metrics.patternMatches++;
      }
    }

    // Calculate confidence based on correlation and pattern strength
    const correlationConfidence = Math.min(bestCorrelationScore, 1);
    const patternConfidence = stream.patterns.length > 0 
      ? Math.max(...stream.patterns.map(p => p.similarity))
      : 0;

    const confidence = Math.max(
      alignerConfig.confidenceThreshold,
      (correlationConfidence * 0.7 + patternConfidence * 0.3)
    );

    return {
      alignedTimestamp,
      confidence: Math.min(confidence, 1),
      offset: correlationOffset,
      correlationScore: bestCorrelationScore,
      patternScore: patternConfidence,
      strategy: SynchronizationStrategy.EVENT_DRIVEN
    };
  };

  const getQuality = () => {
    const correlationRate = state.metrics.totalEvents > 0 
      ? state.metrics.correlationHits / state.metrics.totalEvents
      : 0;
    
    const patternRate = state.metrics.totalEvents > 0
      ? state.metrics.patternMatches / state.metrics.totalEvents
      : 0;

    return createSyncMetrics({
      quality: (correlationRate * 0.6 + patternRate * 0.4) * alignerConfig.confidenceThreshold,
      latency: 20, // Event correlation adds latency
      jitter: 1 - state.metrics.avgCorrelationScore, // Lower correlation = higher jitter
      droppedSamples: 0,
      alignmentAccuracy: state.metrics.avgCorrelationScore * 100,
      correlationRate,
      patternRate
    });
  };

  const getStats = () => ({
    ...state.metrics,
    activeStreams: state.eventStreams.size,
    totalCorrelations: state.correlationMatrix.size,
    avgEventsPerStream: state.metrics.totalEvents / Math.max(1, state.eventStreams.size),
    patternLibrarySize: state.patternLibrary.size
  });

  const cleanup = async () => {
    state.eventStreams.clear();
    state.correlationMatrix.clear();
    state.patternLibrary.clear();
    state.alignmentHistory = [];
    state.metrics = {
      totalEvents: 0,
      correlationHits: 0,
      patternMatches: 0,
      avgCorrelationScore: 0
    };
  };

  return { 
    align, 
    getQuality, 
    getStats,
    cleanup,
    strategy: SynchronizationStrategy.EVENT_DRIVEN 
  };
};