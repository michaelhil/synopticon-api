/**
 * Speaking Rate Analyzer Module
 * Calculates words per minute, syllable rates, and speaking speed categorization
 */

export const createSpeakingRateAnalyzer = (config = {}) => {
  const state = {
    config: {
      // Rate calculation parameters
      windowSize: config.windowSize || 10000, // ms
      minWordLength: config.minWordLength || 2,
      syllablePattern: config.syllablePattern || /[aeiouyAEIOUY]+/g,
      
      // Smoothing and adaptation
      smoothingFactor: config.smoothingFactor || 0.3,
      adaptiveWindow: config.adaptiveWindow !== false,
      
      // Rate categories (WPM ranges)
      rateCategories: config.rateCategories || {
        verySlow: [0, 80],
        slow: [80, 120],
        normal: [120, 160],
        fast: [160, 200],
        veryFast: [200, 300]
      }
    },
    
    // Speech tracking
    speechSegments: [],
    wordEvents: [],
    syllableEvents: [],
    
    // Current metrics
    currentRate: 0,
    smoothedRate: 0,
    
    // Statistics
    stats: {
      totalWords: 0,
      totalSyllables: 0,
      totalSpeechTime: 0,
      averageRate: 0,
      peakRate: 0,
      rateVariability: 0,
      rateDistribution: {}
    }
  };

  // Initialize rate distribution
  Object.keys(state.config.rateCategories).forEach(category => {
    state.stats.rateDistribution[category] = 0;
  });

  // Estimate syllable count from text
  const estimateSyllables = (word) => {
    if (!word || word.length < state.config.minWordLength) return 0;
    
    // Remove non-alphabetic characters
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length === 0) return 0;
    
    // Count vowel groups
    const syllables = cleanWord.match(state.config.syllablePattern) || [];
    let count = syllables.length;
    
    // Adjust for silent 'e'
    if (cleanWord.endsWith('e') && count > 1) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  };

  // Add speech segment with timing information
  const addSpeechSegment = (text, startTime, endTime, speakerId = null) => {
    if (!text || typeof text !== 'string') return;
    
    const words = text.trim().split(/\s+/).filter(word => 
      word.length >= state.config.minWordLength && /[a-zA-Z]/.test(word)
    );
    
    if (words.length === 0) return;
    
    const duration = endTime - startTime;
    const wordRate = words.length / (duration / 60000); // WPM
    
    // Calculate syllables
    const syllables = words.reduce((sum, word) => sum + estimateSyllables(word), 0);
    const syllableRate = syllables / (duration / 60000); // Syllables per minute
    
    const segment = {
      text,
      startTime,
      endTime,
      duration,
      wordCount: words.length,
      syllableCount: syllables,
      wordRate,
      syllableRate,
      speakerId,
      timestamp: Date.now()
    };
    
    // Add to tracking
    state.speechSegments.push(segment);
    
    // Add individual word events
    const wordDuration = duration / words.length;
    words.forEach((word, index) => {
      const wordTime = startTime + (index * wordDuration);
      state.wordEvents.push({
        word,
        time: wordTime,
        syllables: estimateSyllables(word),
        segmentIndex: state.speechSegments.length - 1
      });
      
      // Add syllable events
      const syllableCount = estimateSyllables(word);
      const syllableDuration = wordDuration / syllableCount;
      for (let s = 0; s < syllableCount; s++) {
        state.syllableEvents.push({
          time: wordTime + (s * syllableDuration),
          wordIndex: state.wordEvents.length - 1,
          syllableIndex: s
        });
      }
    });
    
    // Update current rates
    state.currentRate = wordRate;
    state.smoothedRate = state.smoothedRate === 0 ? wordRate :
      state.config.smoothingFactor * wordRate + (1 - state.config.smoothingFactor) * state.smoothedRate;
    
    // Update statistics
    state.stats.totalWords += words.length;
    state.stats.totalSyllables += syllables;
    state.stats.totalSpeechTime += duration;
    
    const overallRate = state.stats.totalWords / (state.stats.totalSpeechTime / 60000);
    state.stats.averageRate = overallRate;
    state.stats.peakRate = Math.max(state.stats.peakRate, wordRate);
    
    // Update rate distribution
    const category = categorizeRate(wordRate);
    if (category) {
      state.stats.rateDistribution[category]++;
    }
    
    return segment;
  };

  // Categorize speaking rate
  const categorizeRate = (rate) => {
    for (const [category, [min, max]] of Object.entries(state.config.rateCategories)) {
      if (rate >= min && rate < max) {
        return category;
      }
    }
    return null;
  };

  // Calculate rate variability over recent segments
  const calculateRateVariability = (timeWindow = state.config.windowSize) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = state.speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length < 2) return 0;
    
    const rates = recentSegments.map(seg => seg.wordRate);
    const meanRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - meanRate, 2), 0) / rates.length;
    
    state.stats.rateVariability = Math.sqrt(variance);
    return state.stats.rateVariability;
  };

  // Get rate statistics over time window
  const getRateStats = (timeWindow = state.config.windowSize) => {
    const cutoffTime = Date.now() - timeWindow;
    const recentSegments = state.speechSegments.filter(seg => seg.timestamp >= cutoffTime);
    
    if (recentSegments.length === 0) {
      return {
        averageRate: 0,
        medianRate: 0,
        minRate: 0,
        maxRate: 0,
        variability: 0,
        segmentCount: 0
      };
    }
    
    const rates = recentSegments.map(seg => seg.wordRate).sort((a, b) => a - b);
    const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const medianRate = rates[Math.floor(rates.length / 2)];
    
    return {
      averageRate,
      medianRate,
      minRate: rates[0],
      maxRate: rates[rates.length - 1],
      variability: calculateRateVariability(timeWindow),
      segmentCount: recentSegments.length,
      category: categorizeRate(averageRate)
    };
  };

  return {
    addSpeechSegment,
    getCurrentRate: () => state.currentRate,
    getSmoothedRate: () => state.smoothedRate,
    getRateStats,
    calculateRateVariability,
    categorizeRate,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.speechSegments = [];
      state.wordEvents = [];
      state.syllableEvents = [];
      state.currentRate = 0;
      state.smoothedRate = 0;
      state.stats = {
        totalWords: 0,
        totalSyllables: 0,
        totalSpeechTime: 0,
        averageRate: 0,
        peakRate: 0,
        rateVariability: 0,
        rateDistribution: {}
      };
      Object.keys(state.config.rateCategories).forEach(category => {
        state.stats.rateDistribution[category] = 0;
      });
    }
  };
};
