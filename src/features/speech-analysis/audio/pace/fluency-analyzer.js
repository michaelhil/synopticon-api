/**
 * Fluency Analyzer Module
 * Analyzes speech fluency through filler words, hesitations, repetitions, and speech flow
 */

export const createFluencyAnalyzer = (config = {}) => {
  const state = {
    config: {
      // Filler word patterns
      fillerWords: config.fillerWords || [
        'um', 'uh', 'er', 'ah', 'like', 'you know', 'so', 'well',
        'actually', 'basically', 'literally', 'sort of', 'kind of'
      ],
      
      // Pause detection
      minPauseLength: config.minPauseLength || 200, // ms
      hesitationPauseLength: config.hesitationPauseLength || 500, // ms
      
      // Repetition detection
      repetitionWindow: config.repetitionWindow || 3, // words
      
      // Fluency scoring
      fluencyWeights: config.fluencyWeights || {
        fillers: 0.3,
        pauses: 0.3,
        repetitions: 0.2,
        flow: 0.2
      }
    },
    
    // Tracking arrays
    fillerEvents: [],
    pauseEvents: [],
    repetitionEvents: [],
    speechFlow: [],
    
    // Current state
    lastWordTime: null,
    recentWords: [],
    
    // Statistics
    stats: {
      totalFillers: 0,
      totalPauses: 0,
      totalRepetitions: 0,
      averagePauseLength: 0,
      fillerRate: 0, // fillers per minute
      fluencyScore: 100, // 0-100 scale
      speechFlowIndex: 0
    }
  };

  // Detect filler words in text
  const detectFillers = (text, timestamp) => {
    if (!text || typeof text !== 'string') return [];
    
    const words = text.toLowerCase().split(/\s+/);
    const fillers = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.!?;:]*/g, ''); // Remove punctuation
      
      // Check single word fillers
      if (state.config.fillerWords.includes(word)) {
        fillers.push({
          type: 'single',
          text: word,
          position: i,
          timestamp: timestamp + (i * 100) // Approximate timing
        });
      }
      
      // Check multi-word fillers
      if (i < words.length - 1) {
        const twoWordPhrase = `${word} ${words[i + 1].replace(/[.!?;:]*/g, '')}`;
        if (state.config.fillerWords.includes(twoWordPhrase)) {
          fillers.push({
            type: 'phrase',
            text: twoWordPhrase,
            position: i,
            timestamp: timestamp + (i * 100)
          });
          i++; // Skip next word
        }
      }
    }
    
    // Add to tracking
    state.fillerEvents.push(...fillers);
    state.stats.totalFillers += fillers.length;
    
    return fillers;
  };

  // Detect repetitions in recent speech
  const detectRepetitions = (text, timestamp) => {
    if (!text || typeof text !== 'string') return [];
    
    const words = text.toLowerCase().split(/\s+/)
      .map(word => word.replace(/[.!?;:]*/g, ''))
      .filter(word => word.length > 0);
    
    const repetitions = [];
    
    // Add new words to recent words buffer
    words.forEach(word => {
      state.recentWords.push({ word, time: timestamp });
    });
    
    // Maintain buffer size
    while (state.recentWords.length > state.config.repetitionWindow * 3) {
      state.recentWords.shift();
    }
    
    // Look for repetitions in recent window
    const recentWordTexts = state.recentWords.map(w => w.word);
    const wordCounts = {};
    
    recentWordTexts.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Find words that appear more than once
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count > 1 && word.length > 2) { // Ignore short words
        repetitions.push({
          word,
          count,
          timestamp,
          severity: count > 2 ? 'high' : 'moderate'
        });
      }
    }
    
    // Add to tracking
    state.repetitionEvents.push(...repetitions);
    state.stats.totalRepetitions += repetitions.length;
    
    return repetitions;
  };

  // Add pause information
  const addPause = (startTime, endTime, type = 'normal') => {
    const duration = endTime - startTime;
    
    if (duration >= state.config.minPauseLength) {
      const pause = {
        startTime,
        endTime,
        duration,
        type: duration >= state.config.hesitationPauseLength ? 'hesitation' : type,
        timestamp: Date.now()
      };
      
      state.pauseEvents.push(pause);
      state.stats.totalPauses++;
      
      // Update average pause length
      const totalPauseDuration = state.pauseEvents.reduce((sum, p) => sum + p.duration, 0);
      state.stats.averagePauseLength = totalPauseDuration / state.pauseEvents.length;
      
      return pause;
    }
    
    return null;
  };

  // Calculate speech flow index
  const calculateSpeechFlow = (speechSegments, timeWindow = 30000) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length === 0) return 0;
    
    // Calculate flow based on segment continuity and duration
    let flowScore = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < recentSegments.length; i++) {
      const segment = recentSegments[i];
      totalDuration += segment.duration;
      
      // Base score from segment length (longer = better flow)
      const lengthScore = Math.min(1, segment.duration / 3000); // 3 seconds max
      
      // Penalty for very short segments (indicates choppy speech)
      const choppyPenalty = segment.duration < 1000 ? 0.5 : 1;
      
      // Bonus for consistent rate within segment
      const rateConsistency = segment.wordCount > 0 ? 
        Math.min(1, segment.wordRate / 150) : 0; // 150 WPM as reference
      
      flowScore += lengthScore * choppyPenalty * rateConsistency * segment.duration;
    }
    
    // Normalize by total duration
    const averageFlow = totalDuration > 0 ? flowScore / totalDuration : 0;
    state.stats.speechFlowIndex = Math.max(0, Math.min(1, averageFlow));
    
    return state.stats.speechFlowIndex;
  };

  // Calculate overall fluency score
  const calculateFluencyScore = (speechDuration = 0, timeWindow = 30000) => {
    if (speechDuration === 0) return state.stats.fluencyScore;
    
    const weights = state.config.fluencyWeights;
    const cutoffTime = Date.now() - timeWindow;
    
    // Filter events to time window
    const recentFillers = state.fillerEvents.filter(f => f.timestamp >= cutoffTime);
    const recentPauses = state.pauseEvents.filter(p => p.timestamp >= cutoffTime);
    const recentRepetitions = state.repetitionEvents.filter(r => r.timestamp >= cutoffTime);
    
    // Calculate component scores (0-100)
    const fillerScore = Math.max(0, 100 - (recentFillers.length / (speechDuration / 60000)) * 10);
    
    const hesitationPauses = recentPauses.filter(p => p.type === 'hesitation').length;
    const pauseScore = Math.max(0, 100 - (hesitationPauses / (speechDuration / 60000)) * 15);
    
    const repetitionScore = Math.max(0, 100 - recentRepetitions.length * 5);
    
    const flowScore = state.stats.speechFlowIndex * 100;
    
    // Weighted combination
    const fluencyScore = 
      (fillerScore * weights.fillers) +
      (pauseScore * weights.pauses) +
      (repetitionScore * weights.repetitions) +
      (flowScore * weights.flow);
    
    state.stats.fluencyScore = Math.max(0, Math.min(100, fluencyScore));
    
    // Update filler rate
    state.stats.fillerRate = speechDuration > 0 ? 
      (recentFillers.length / (speechDuration / 60000)) : 0;
    
    return {
      overall: state.stats.fluencyScore,
      components: {
        fillers: fillerScore,
        pauses: pauseScore,
        repetitions: repetitionScore,
        flow: flowScore
      },
      details: {
        fillerCount: recentFillers.length,
        hesitationPauses,
        repetitionCount: recentRepetitions.length,
        flowIndex: state.stats.speechFlowIndex
      }
    };
  };

  // Process speech segment for fluency analysis
  const processSegment = (text, startTime, endTime, speechSegments = []) => {
    const fillers = detectFillers(text, startTime);
    const repetitions = detectRepetitions(text, startTime);
    const speechFlow = calculateSpeechFlow(speechSegments);
    const fluency = calculateFluencyScore(endTime - startTime);
    
    return {
      fillers,
      repetitions,
      speechFlow,
      fluency,
      timestamp: Date.now()
    };
  };

  return {
    detectFillers,
    detectRepetitions,
    addPause,
    calculateSpeechFlow,
    calculateFluencyScore,
    processSegment,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.fillerEvents = [];
      state.pauseEvents = [];
      state.repetitionEvents = [];
      state.speechFlow = [];
      state.lastWordTime = null;
      state.recentWords = [];
      state.stats = {
        totalFillers: 0,
        totalPauses: 0,
        totalRepetitions: 0,
        averagePauseLength: 0,
        fillerRate: 0,
        fluencyScore: 100,
        speechFlowIndex: 0
      };
    }
  };
};
