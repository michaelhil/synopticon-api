/**
 * Conversation Flow Analysis
 * Analyzes conversation patterns including turn-taking, interruptions, silence patterns, and interaction quality
 */

import { createObjectPool } from '../../shared/utils/object-pool.js';

/**
 * Creates conversation analytics analyzer for dialog flow analysis
 */
export const createConversationAnalytics = (config = {}) => {
  const {
    minSilenceDuration = 0.5,      // Minimum silence for turn boundary (seconds)
    maxSilenceDuration = 3.0,      // Maximum natural pause (seconds)
    interruptionThreshold = 0.2,   // Overlap threshold for interruption detection
    turnLengthWindow = 5.0,        // Window for turn length analysis
    flowAnalysisWindow = 30.0,     // Window for flow pattern analysis
    memoryPoolSize = 100           // Object pooling for performance
  } = config;

  // Enhanced memory pooling system
  const pools = {
    turnData: createObjectPool(memoryPoolSize, () => ({
      speakerId: null,
      startTime: 0,
      endTime: 0,
      duration: 0,
      type: 'speech', // 'speech', 'silence', 'overlap'
      confidence: 0,
      reset() {
        this.speakerId = null;
        this.startTime = 0;
        this.endTime = 0;
        this.duration = 0;
        this.type = 'speech';
        this.confidence = 0;
      }
    })),
    flowMetrics: createObjectPool(memoryPoolSize / 2, () => ({
      turnsPerMinute: 0,
      averageTurnLength: 0,
      silenceRatio: 0,
      interruptionRate: 0,
      participationBalance: 0,
      conversationRhythm: 0,
      reset() {
        this.turnsPerMinute = 0;
        this.averageTurnLength = 0;
        this.silenceRatio = 0;
        this.interruptionRate = 0;
        this.participationBalance = 0;
        this.conversationRhythm = 0;
      }
    }))
  };

  // State management
  let conversationHistory = [];
  let currentTurn = null;
  let silenceStartTime = null;
  let lastAnalysisTime = 0;
  let speakingStates = new Map(); // speakerId -> boolean
  let turnMetrics = [];

  /**
   * Analyzes turn-taking patterns and conversation flow
   */
  const analyzeTurnTaking = (speakerData, timestamp) => {
    const activeSpeakers = Object.keys(speakerData).filter(id => speakerData[id].isActive);
    const previousSpeakers = Array.from(speakingStates.keys()).filter(id => speakingStates.get(id));

    // Detect turn changes
    if (activeSpeakers.length === 1) {
      const currentSpeaker = activeSpeakers[0];
      
      // Start new turn
      if (!currentTurn || currentTurn.speakerId !== currentSpeaker) {
        // End previous turn
        if (currentTurn) {
          currentTurn.endTime = timestamp;
          currentTurn.duration = currentTurn.endTime - currentTurn.startTime;
          turnMetrics.push({ ...currentTurn });
        }

        // Start new turn
        currentTurn = pools.turnData.acquire();
        currentTurn.speakerId = currentSpeaker;
        currentTurn.startTime = timestamp;
        currentTurn.type = 'speech';
        currentTurn.confidence = speakerData[currentSpeaker].confidence || 0.8;
      }
      
      silenceStartTime = null;
    } else if (activeSpeakers.length === 0) {
      // Handle silence
      if (currentTurn && !silenceStartTime) {
        silenceStartTime = timestamp;
      }
      
      // Check for turn boundary silence
      if (silenceStartTime && (timestamp - silenceStartTime) >= minSilenceDuration) {
        if (currentTurn) {
          currentTurn.endTime = silenceStartTime;
          currentTurn.duration = currentTurn.endTime - currentTurn.startTime;
          turnMetrics.push({ ...currentTurn });
          pools.turnData.release(currentTurn);
          currentTurn = null;
        }

        // Create silence turn
        const silenceTurn = pools.turnData.acquire();
        silenceTurn.speakerId = 'silence';
        silenceTurn.startTime = silenceStartTime;
        silenceTurn.endTime = timestamp;
        silenceTurn.duration = timestamp - silenceStartTime;
        silenceTurn.type = 'silence';
        silenceTurn.confidence = 1.0;
        turnMetrics.push({ ...silenceTurn });
        pools.turnData.release(silenceTurn);
      }
    } else if (activeSpeakers.length > 1) {
      // Handle overlapping speech (interruptions)
      const overlapTurn = pools.turnData.acquire();
      overlapTurn.speakerId = activeSpeakers.join('+');
      overlapTurn.startTime = timestamp - 0.1; // Approximate overlap start
      overlapTurn.endTime = timestamp;
      overlapTurn.duration = 0.1;
      overlapTurn.type = 'overlap';
      overlapTurn.confidence = 0.6;
      turnMetrics.push({ ...overlapTurn });
      pools.turnData.release(overlapTurn);
    }

    // Update speaker states
    speakingStates.clear();
    activeSpeakers.forEach(id => speakingStates.set(id, true));

    return {
      currentSpeaker: activeSpeakers.length === 1 ? activeSpeakers[0] : null,
      activeSpeakers: activeSpeakers.length,
      turnBoundary: currentTurn !== null
    };
  };

  /**
   * Calculates conversation flow metrics
   */
  const calculateFlowMetrics = (windowStart, windowEnd) => {
    const windowTurns = turnMetrics.filter(turn => 
      turn.startTime >= windowStart && turn.endTime <= windowEnd
    );
    
    if (windowTurns.length === 0) {
      return null;
    }

    const metrics = pools.flowMetrics.acquire();
    const windowDuration = windowEnd - windowStart;

    // Calculate basic metrics
    const speechTurns = windowTurns.filter(t => t.type === 'speech');
    const silenceTurns = windowTurns.filter(t => t.type === 'silence');
    const overlapTurns = windowTurns.filter(t => t.type === 'overlap');

    // Turns per minute
    metrics.turnsPerMinute = (speechTurns.length / windowDuration) * 60;

    // Average turn length
    const totalSpeechDuration = speechTurns.reduce((sum, t) => sum + t.duration, 0);
    metrics.averageTurnLength = speechTurns.length > 0 ? totalSpeechDuration / speechTurns.length : 0;

    // Silence ratio
    const totalSilenceDuration = silenceTurns.reduce((sum, t) => sum + t.duration, 0);
    metrics.silenceRatio = totalSilenceDuration / windowDuration;

    // Interruption rate
    metrics.interruptionRate = overlapTurns.length / Math.max(speechTurns.length, 1);

    // Participation balance (entropy-based)
    const speakerDurations = new Map();
    speechTurns.forEach(turn => {
      const duration = speakerDurations.get(turn.speakerId) || 0;
      speakerDurations.set(turn.speakerId, duration + turn.duration);
    });

    if (speakerDurations.size > 1) {
      const totalDuration = Array.from(speakerDurations.values()).reduce((sum, d) => sum + d, 0);
      const proportions = Array.from(speakerDurations.values()).map(d => d / totalDuration);
      const entropy = proportions.reduce((sum, p) => sum - (p * Math.log2(p)), 0);
      const maxEntropy = Math.log2(speakerDurations.size);
      metrics.participationBalance = entropy / maxEntropy;
    } else {
      metrics.participationBalance = 0;
    }

    // Conversation rhythm (regularity of turn-taking)
    const turnIntervals = [];
    for (let i = 1; i < speechTurns.length; i++) {
      turnIntervals.push(speechTurns[i].startTime - speechTurns[i-1].endTime);
    }

    if (turnIntervals.length > 1) {
      const meanInterval = turnIntervals.reduce((sum, interval) => sum + interval, 0) / turnIntervals.length;
      const variance = turnIntervals.reduce((sum, interval) => 
        sum + Math.pow(interval - meanInterval, 2), 0) / turnIntervals.length;
      const stdDev = Math.sqrt(variance);
      metrics.conversationRhythm = meanInterval > 0 ? 1 / (1 + (stdDev / meanInterval)) : 0;
    } else {
      metrics.conversationRhythm = 0;
    }

    return metrics;
  };

  /**
   * Detects conversation patterns and anomalies
   */
  const detectConversationPatterns = (metrics) => {
    const patterns = [];

    // Detect dominant speaker
    if (metrics.participationBalance < 0.3) {
      patterns.push({
        type: 'dominant_speaker',
        severity: 1 - metrics.participationBalance,
        description: 'One speaker dominates the conversation'
      });
    }

    // Detect high interruption rate
    if (metrics.interruptionRate > 0.3) {
      patterns.push({
        type: 'high_interruptions',
        severity: Math.min(metrics.interruptionRate, 1),
        description: 'Frequent interruptions detected'
      });
    }

    // Detect awkward silences
    if (metrics.silenceRatio > 0.4) {
      patterns.push({
        type: 'excessive_silence',
        severity: Math.min(metrics.silenceRatio, 1),
        description: 'Unusually long periods of silence'
      });
    }

    // Detect rapid fire conversation
    if (metrics.turnsPerMinute > 30) {
      patterns.push({
        type: 'rapid_fire',
        severity: Math.min(metrics.turnsPerMinute / 40, 1),
        description: 'Very rapid turn-taking detected'
      });
    }

    // Detect poor conversation rhythm
    if (metrics.conversationRhythm < 0.3) {
      patterns.push({
        type: 'irregular_rhythm',
        severity: 1 - metrics.conversationRhythm,
        description: 'Irregular conversation rhythm'
      });
    }

    return patterns;
  };

  /**
   * Main analysis function
   */
  const analyze = (speakerData, audioFeatures, timestamp) => {
    // Analyze turn-taking
    const turnInfo = analyzeTurnTaking(speakerData, timestamp);

    // Periodic flow analysis
    if (timestamp - lastAnalysisTime >= flowAnalysisWindow) {
      const windowStart = timestamp - flowAnalysisWindow;
      const metrics = calculateFlowMetrics(windowStart, timestamp);
      
      if (metrics) {
        const patterns = detectConversationPatterns(metrics);
        
        // Store in conversation history
        conversationHistory.push({
          timestamp,
          windowStart,
          windowEnd: timestamp,
          metrics: { ...metrics },
          patterns,
          turnCount: turnMetrics.length
        });

        pools.flowMetrics.release(metrics);

        // Cleanup old turn metrics
        turnMetrics = turnMetrics.filter(turn => turn.startTime > windowStart - flowAnalysisWindow);
      }

      lastAnalysisTime = timestamp;
    }

    return {
      turnInfo,
      currentMetrics: conversationHistory.length > 0 ? 
        conversationHistory[conversationHistory.length - 1] : null,
      totalTurns: turnMetrics.length,
      poolStats: {
        turnDataUsage: pools.turnData.getStats(),
        flowMetricsUsage: pools.flowMetrics.getStats()
      }
    };
  };

  /**
   * Gets conversation summary statistics
   */
  const getConversationSummary = () => {
    if (conversationHistory.length === 0) {
      return null;
    }

    const latestAnalysis = conversationHistory[conversationHistory.length - 1];
    const allPatterns = conversationHistory.flatMap(h => h.patterns);
    
    return {
      totalDuration: conversationHistory.length * flowAnalysisWindow,
      analysisWindows: conversationHistory.length,
      currentMetrics: latestAnalysis.metrics,
      detectedPatterns: allPatterns,
      patternSummary: {
        dominantSpeaker: allPatterns.filter(p => p.type === 'dominant_speaker').length,
        highInterruptions: allPatterns.filter(p => p.type === 'high_interruptions').length,
        excessiveSilence: allPatterns.filter(p => p.type === 'excessive_silence').length,
        rapidFire: allPatterns.filter(p => p.type === 'rapid_fire').length,
        irregularRhythm: allPatterns.filter(p => p.type === 'irregular_rhythm').length
      },
      overallQuality: calculateOverallConversationQuality()
    };
  };

  /**
   * Calculates overall conversation quality score
   */
  const calculateOverallConversationQuality = () => {
    if (conversationHistory.length === 0) return 0;

    const recent = conversationHistory.slice(-3); // Last 3 windows
    const avgMetrics = recent.reduce((acc, h) => {
      acc.participationBalance += h.metrics.participationBalance;
      acc.conversationRhythm += h.metrics.conversationRhythm;
      acc.interruptionRate += h.metrics.interruptionRate;
      acc.silenceRatio += h.metrics.silenceRatio;
      return acc;
    }, { participationBalance: 0, conversationRhythm: 0, interruptionRate: 0, silenceRatio: 0 });

    const count = recent.length;
    avgMetrics.participationBalance /= count;
    avgMetrics.conversationRhythm /= count;
    avgMetrics.interruptionRate /= count;
    avgMetrics.silenceRatio /= count;

    // Weighted quality score (0-1)
    const balanceScore = avgMetrics.participationBalance * 0.3;
    const rhythmScore = avgMetrics.conversationRhythm * 0.25;
    const interruptionPenalty = Math.max(0, 0.2 - avgMetrics.interruptionRate * 0.2);
    const silencePenalty = Math.max(0, 0.25 - Math.abs(avgMetrics.silenceRatio - 0.15) * 0.25);

    return Math.min(1, balanceScore + rhythmScore + interruptionPenalty + silencePenalty);
  };

  /**
   * Resets analysis state
   */
  const reset = () => {
    conversationHistory = [];
    turnMetrics = [];
    currentTurn = null;
    silenceStartTime = null;
    lastAnalysisTime = 0;
    speakingStates.clear();
    pools.turnData.reset();
    pools.flowMetrics.reset();
  };

  return {
    analyze,
    getConversationSummary,
    reset,
    
    // Configuration access
    getConfig: () => ({
      minSilenceDuration,
      maxSilenceDuration,
      interruptionThreshold,
      turnLengthWindow,
      flowAnalysisWindow,
      memoryPoolSize
    })
  };
};

// Export factory function following functional programming patterns
export default createConversationAnalytics;