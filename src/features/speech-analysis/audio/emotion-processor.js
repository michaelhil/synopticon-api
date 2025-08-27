/**
 * Emotion processing logic for audio frame analysis
 */

export const createEmotionProcessor = (config, memoryPool) => {
  const state = {
    config,
    lastEmotionUpdate: 0,
    isInitialized: false,
    
    // Components
    prosodicAnalyzer: null,
    emotionClassifier: null
  };

  // Initialize emotion processing components
  const initialize = (createProsodicAnalyzer, createEmotionClassifier) => {
    if (state.config.enableProsodics && createProsodicAnalyzer) {
      state.prosodicAnalyzer = createProsodicAnalyzer(state.config.prosodics);
    }
    
    if (state.config.enableClassification && createEmotionClassifier) {
      state.emotionClassifier = createEmotionClassifier(state.config.classifier);
    }
    
    state.isInitialized = true;
  };

  // Register the emotion result factory with memory pool
  const registerResultFactory = () => {
    memoryPool.registerFactory('EmotionResult', () => ({
      _pooled: true,
      timestamp: 0,
      emotion: 'neutral',
      confidence: 0,
      arousal: 0,
      valence: 0,
      prosodicFeatures: null,
      processing: {
        prosodicExtracted: false,
        emotionClassified: false,
        processingTime: 0
      }
    }));
  };

  // Process a single audio frame for emotion detection
  const processFrame = (audioBuffer, timestamp) => {
    const startTime = performance.now();
    let prosodicFeatures = null;
    let emotionResult = null;
    
    // Extract prosodic features if enabled
    if (state.prosodicAnalyzer) {
      prosodicFeatures = state.prosodicAnalyzer.processFrame(audioBuffer, timestamp);
    }
    
    // Classify emotion periodically to avoid excessive computation
    const shouldClassifyEmotion = state.emotionClassifier && 
      (timestamp - state.lastEmotionUpdate) >= state.config.emotionUpdateInterval;
    
    if (shouldClassifyEmotion && prosodicFeatures) {
      emotionResult = state.emotionClassifier.classifyFromFeatures(prosodicFeatures);
      if (emotionResult) {
        state.lastEmotionUpdate = timestamp;
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    // Create result if we have meaningful data
    if (emotionResult || prosodicFeatures) {
      return createEmotionResult(emotionResult, prosodicFeatures, timestamp, processingTime);
    }
    
    return null;
  };

  // Create emotion result object using memory pool
  const createEmotionResult = (emotionResult, prosodicFeatures, timestamp, processingTime) => {
    const result = memoryPool.acquire('EmotionResult');
    
    result.timestamp = timestamp;
    result.prosodicFeatures = prosodicFeatures;
    result.processing = {
      prosodicExtracted: prosodicFeatures !== null,
      emotionClassified: emotionResult !== null,
      processingTime
    };
    
    if (emotionResult) {
      // Use new emotion classification
      result.emotion = emotionResult.emotion;
      result.confidence = emotionResult.confidence;
      result.arousal = emotionResult.rawClassification.arousal;
      result.valence = emotionResult.rawClassification.valence;
    } else if (state.emotionClassifier) {
      // Use current emotion state if no new classification
      const current = state.emotionClassifier.getCurrentEmotion();
      result.emotion = current.emotion;
      result.confidence = current.confidence;
      result.arousal = current.arousal || 0;
      result.valence = current.valence || 0;
    } else {
      // Default neutral state
      result.emotion = 'neutral';
      result.confidence = 0;
      result.arousal = 0;
      result.valence = 0;
    }
    
    return result;
  };

  // Get current emotion state
  const getCurrentEmotion = () => {
    if (!state.emotionClassifier) {
      return { emotion: 'neutral', confidence: 0, arousal: 0, valence: 0 };
    }
    return state.emotionClassifier.getCurrentEmotion();
  };

  // Get emotion timeline for a time window
  const getEmotionTimeline = (timeWindow = 30000) => {
    if (!state.emotionClassifier) return [];
    return state.emotionClassifier.getEmotionTimeline(timeWindow);
  };

  // Reset processor state
  const reset = () => {
    if (state.prosodicAnalyzer) state.prosodicAnalyzer.reset();
    if (state.emotionClassifier) state.emotionClassifier.reset();
    state.lastEmotionUpdate = 0;
  };

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.prosodics && state.prosodicAnalyzer) {
      state.prosodicAnalyzer.updateConfig(newConfig.prosodics);
    }
    if (newConfig.classifier && state.emotionClassifier) {
      state.emotionClassifier.updateConfig(newConfig.classifier);
    }
  };

  // Get processor state
  const getState = () => ({
    isInitialized: state.isInitialized,
    lastEmotionUpdate: state.lastEmotionUpdate,
    hasProsodicAnalyzer: !!state.prosodicAnalyzer,
    hasEmotionClassifier: !!state.emotionClassifier,
    config: { ...state.config }
  });

  // Get individual component statistics
  const getComponentStats = () => ({
    prosodic: state.prosodicAnalyzer ? state.prosodicAnalyzer.getStats() : null,
    classifier: state.emotionClassifier ? state.emotionClassifier.getStats() : null
  });

  return {
    initialize,
    registerResultFactory,
    processFrame,
    getCurrentEmotion,
    getEmotionTimeline,
    reset,
    updateConfig,
    getState,
    getComponentStats,
    
    // Direct component access for testing
    getProsodicAnalyzer: () => state.prosodicAnalyzer,
    getEmotionClassifier: () => state.emotionClassifier,
    
    // Memory management
    releaseResult: (result) => memoryPool.release(result)
  };
};