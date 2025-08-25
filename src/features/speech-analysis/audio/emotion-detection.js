/**
 * Emotion Detection from Voice Module
 * Advanced emotional state analysis from speech audio features
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

// Prosodic feature extraction for emotion detection
export const createProsodicAnalyzer = (config = {}) => {
  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      sampleRate: config.sampleRate || 44100,
      
      // Prosodic parameters
      pitchRange: config.pitchRange || [80, 400], // Hz
      energySmoothing: config.energySmoothing || 0.3,
      timingWindowSize: config.timingWindowSize || 10, // frames
      
      // Feature normalization
      normalizeFeatures: config.normalizeFeatures !== false,
      adaptiveNormalization: config.adaptiveNormalization !== false
    },
    
    // Feature history for temporal analysis
    featureHistory: [],
    normalizationStats: {
      pitch: { mean: 150, std: 50 },
      energy: { mean: 0.1, std: 0.05 },
      tempo: { mean: 1.0, std: 0.3 }
    },
    
    // Statistics
    stats: {
      totalFrames: 0,
      averagePitch: 0,
      averageEnergy: 0,
      pitchVariability: 0,
      energyVariability: 0
    }
  };

  // Extract pitch using autocorrelation
  const extractPitch = (audioBuffer) => {
    const [minPeriod, maxPeriod] = [
      Math.floor(state.config.sampleRate / state.config.pitchRange[1]),
      Math.floor(state.config.sampleRate / state.config.pitchRange[0])
    ];
    
    let bestCorrelation = 0;
    let bestPeriod = minPeriod;
    
    for (let period = minPeriod; period <= maxPeriod && period < audioBuffer.length / 2; period++) {
      let correlation = 0;
      const samples = audioBuffer.length - period;
      
      for (let i = 0; i < samples; i++) {
        correlation += audioBuffer[i] * audioBuffer[i + period];
      }
      
      correlation /= samples;
      
      // Normalize by energy
      let energy = 0;
      for (let i = 0; i < samples; i++) {
        energy += audioBuffer[i] * audioBuffer[i];
      }
      energy = Math.sqrt(energy / samples);
      
      if (energy > 0.001) { // Only consider frames with significant energy
        correlation /= (energy * energy);
        
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }
    
    // Convert to frequency
    const pitch = bestCorrelation > 0.3 ? state.config.sampleRate / bestPeriod : 0;
    
    // Apply smoothing and bounds checking
    return pitch > state.config.pitchRange[0] && pitch < state.config.pitchRange[1] ? pitch : 0;
  };

  // Extract energy features
  const extractEnergy = (audioBuffer) => {
    // RMS energy
    let rms = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      rms += audioBuffer[i] * audioBuffer[i];
    }
    rms = Math.sqrt(rms / audioBuffer.length);
    
    // Short-time energy (with smoothing)
    const smoothed = state.stats.totalFrames > 0 ? 
      state.config.energySmoothing * rms + (1 - state.config.energySmoothing) * state.stats.averageEnergy : 
      rms;
    
    // Energy dynamics (difference from recent average)
    const recentFrames = state.featureHistory.slice(-5);
    const recentAvgEnergy = recentFrames.length > 0 ? 
      recentFrames.reduce((sum, f) => sum + f.energy, 0) / recentFrames.length : rms;
    
    const energyDelta = rms - recentAvgEnergy;
    
    return {
      rms,
      smoothed,
      delta: energyDelta,
      relative: recentAvgEnergy > 0 ? rms / recentAvgEnergy : 1
    };
  };

  // Extract timing features
  const extractTiming = (audioBuffer, timestamp) => {
    // Speaking rate estimation (simplified)
    let zeroCrossingRate = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i-1] >= 0)) {
        zeroCrossingRate++;
      }
    }
    zeroCrossingRate /= (audioBuffer.length - 1);
    
    // Tempo estimation from recent timing
    let tempo = 1.0;
    if (state.featureHistory.length >= 2) {
      const recent = state.featureHistory.slice(-state.config.timingWindowSize);
      const timeDiffs = [];
      for (let i = 1; i < recent.length; i++) {
        timeDiffs.push(recent[i].timestamp - recent[i-1].timestamp);
      }
      
      if (timeDiffs.length > 0) {
        const avgInterval = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        tempo = avgInterval > 0 ? 1000 / avgInterval : 1.0; // Convert to relative rate
      }
    }
    
    // Rhythm variability
    const recentZCRs = state.featureHistory.slice(-5).map(f => f.timing.zcr);
    const zcrVariability = recentZCRs.length > 1 ? 
      Math.sqrt(recentZCRs.reduce((sum, zcr) => sum + Math.pow(zcr - zeroCrossingRate, 2), 0) / recentZCRs.length) :
      0;
    
    return {
      zcr: zeroCrossingRate,
      tempo,
      rhythmVariability: zcrVariability,
      timestamp
    };
  };

  // Normalize features adaptively
  const normalizeFeatures = (features) => {
    if (!state.config.normalizeFeatures) {
      return features;
    }
    
    const normalized = { ...features };
    
    // Normalize pitch
    if (features.pitch > 0) {
      normalized.pitchNorm = (features.pitch - state.normalizationStats.pitch.mean) / 
                            state.normalizationStats.pitch.std;
      
      if (state.config.adaptiveNormalization && state.stats.totalFrames > 10) {
        // Update normalization stats
        const alpha = 0.01; // Learning rate
        state.normalizationStats.pitch.mean = 
          (1 - alpha) * state.normalizationStats.pitch.mean + alpha * features.pitch;
      }
    } else {
      normalized.pitchNorm = 0;
    }
    
    // Normalize energy
    normalized.energyNorm = (features.energy.rms - state.normalizationStats.energy.mean) / 
                           state.normalizationStats.energy.std;
    
    if (state.config.adaptiveNormalization && state.stats.totalFrames > 10) {
      const alpha = 0.01;
      state.normalizationStats.energy.mean = 
        (1 - alpha) * state.normalizationStats.energy.mean + alpha * features.energy.rms;
    }
    
    // Normalize tempo
    normalized.tempoNorm = (features.timing.tempo - state.normalizationStats.tempo.mean) / 
                          state.normalizationStats.tempo.std;
    
    return normalized;
  };

  // Process audio frame and extract prosodic features
  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    const pitch = extractPitch(audioBuffer);
    const energy = extractEnergy(audioBuffer);
    const timing = extractTiming(audioBuffer, timestamp);
    
    const features = {
      pitch,
      energy,
      timing,
      timestamp
    };
    
    // Normalize features
    const normalizedFeatures = normalizeFeatures(features);
    
    // Add to history
    state.featureHistory.push(normalizedFeatures);
    
    // Maintain history size
    if (state.featureHistory.length > 100) {
      state.featureHistory.shift();
    }
    
    // Update statistics
    state.stats.totalFrames++;
    if (pitch > 0) {
      state.stats.averagePitch = (state.stats.averagePitch * (state.stats.totalFrames - 1) + pitch) / state.stats.totalFrames;
      
      // Calculate pitch variability
      const recentPitches = state.featureHistory.slice(-10).map(f => f.pitch).filter(p => p > 0);
      if (recentPitches.length > 1) {
        const pitchMean = recentPitches.reduce((sum, p) => sum + p, 0) / recentPitches.length;
        state.stats.pitchVariability = Math.sqrt(
          recentPitches.reduce((sum, p) => sum + Math.pow(p - pitchMean, 2), 0) / recentPitches.length
        );
      }
    }
    
    state.stats.averageEnergy = (state.stats.averageEnergy * (state.stats.totalFrames - 1) + energy.rms) / state.stats.totalFrames;
    
    // Calculate energy variability
    const recentEnergies = state.featureHistory.slice(-10).map(f => f.energy.rms);
    if (recentEnergies.length > 1) {
      const energyMean = recentEnergies.reduce((sum, e) => sum + e, 0) / recentEnergies.length;
      state.stats.energyVariability = Math.sqrt(
        recentEnergies.reduce((sum, e) => sum + Math.pow(e - energyMean, 2), 0) / recentEnergies.length
      );
    }
    
    return normalizedFeatures;
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.featureHistory = [];
      state.stats = {
        totalFrames: 0,
        averagePitch: 0,
        averageEnergy: 0,
        pitchVariability: 0,
        energyVariability: 0
      };
    }
  };
};

// Emotion classification using prosodic features
export const createEmotionClassifier = (config = {}) => {
  const state = {
    config: {
      // Classification parameters
      windowSize: config.windowSize || 5, // frames to analyze
      confidenceThreshold: config.confidenceThreshold || 0.6,
      smoothingFactor: config.smoothingFactor || 0.3,
      
      // Emotion model parameters
      emotions: config.emotions || ['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised'],
      useArousalValence: config.useArousalValence !== false
    },
    
    // Feature buffer for classification
    featureBuffer: [],
    
    // Emotion history for smoothing
    emotionHistory: [],
    currentEmotion: 'neutral',
    currentConfidence: 0,
    
    // Statistics
    stats: {
      totalClassifications: 0,
      emotionCounts: {},
      averageConfidence: 0,
      transitionCount: 0
    }
  };

  // Initialize emotion counts
  state.config.emotions.forEach(emotion => {
    state.stats.emotionCounts[emotion] = 0;
  });

  // Simple emotion classification using prosodic features
  const classifyEmotion = (features) => {
    if (features.length < state.config.windowSize) {
      return {
        emotion: 'neutral',
        confidence: 0.5,
        scores: {},
        arousal: 0,
        valence: 0
      };
    }
    
    // Calculate aggregate features over window
    const validFeatures = features.filter(f => f.pitch > 0);
    if (validFeatures.length === 0) {
      return {
        emotion: 'neutral',
        confidence: 0.3,
        scores: {},
        arousal: 0,
        valence: 0
      };
    }
    
    // Aggregate prosodic features
    const avgPitch = validFeatures.reduce((sum, f) => sum + f.pitch, 0) / validFeatures.length;
    const avgEnergy = features.reduce((sum, f) => sum + f.energy.rms, 0) / features.length;
    const avgTempo = features.reduce((sum, f) => sum + f.timing.tempo, 0) / features.length;
    
    const pitchVar = Math.sqrt(
      validFeatures.reduce((sum, f) => sum + Math.pow(f.pitch - avgPitch, 2), 0) / validFeatures.length
    );
    const energyVar = Math.sqrt(
      features.reduce((sum, f) => sum + Math.pow(f.energy.rms - avgEnergy, 2), 0) / features.length
    );
    
    // Simple rule-based classification (can be replaced with ML model)
    const scores = {};
    
    // Happy: Higher pitch, higher energy, more variability
    scores.happy = 
      (avgPitch > 180 ? 0.3 : 0) + 
      (avgEnergy > 0.15 ? 0.3 : 0) + 
      (pitchVar > 30 ? 0.2 : 0) + 
      (avgTempo > 1.1 ? 0.2 : 0);
    
    // Sad: Lower pitch, lower energy, less variability
    scores.sad = 
      (avgPitch < 120 ? 0.4 : 0) + 
      (avgEnergy < 0.08 ? 0.3 : 0) + 
      (pitchVar < 20 ? 0.2 : 0) + 
      (avgTempo < 0.9 ? 0.1 : 0);
    
    // Angry: Higher pitch, much higher energy, high variability
    scores.angry = 
      (avgPitch > 200 ? 0.2 : 0) + 
      (avgEnergy > 0.25 ? 0.4 : 0) + 
      (pitchVar > 50 ? 0.2 : 0) + 
      (energyVar > 0.1 ? 0.2 : 0);
    
    // Fearful: Higher pitch, moderate energy, high variability
    scores.fearful = 
      (avgPitch > 220 ? 0.3 : 0) + 
      (avgEnergy > 0.12 && avgEnergy < 0.2 ? 0.2 : 0) + 
      (pitchVar > 40 ? 0.3 : 0) + 
      (avgTempo > 1.2 ? 0.2 : 0);
    
    // Surprised: Sudden pitch/energy changes
    const recentChanges = features.slice(-3);
    const pitchChange = recentChanges.length >= 2 ? 
      Math.abs(recentChanges[recentChanges.length - 1].pitch - recentChanges[0].pitch) : 0;
    const energyChange = recentChanges.length >= 2 ? 
      Math.abs(recentChanges[recentChanges.length - 1].energy.rms - recentChanges[0].energy.rms) : 0;
    
    scores.surprised = 
      (pitchChange > 50 ? 0.4 : 0) + 
      (energyChange > 0.1 ? 0.3 : 0) + 
      (avgEnergy > 0.15 ? 0.2 : 0) + 
      (avgTempo > 1.3 ? 0.1 : 0);
    
    // Neutral: Moderate values, low variability
    scores.neutral = 
      (avgPitch > 130 && avgPitch < 180 ? 0.3 : 0) + 
      (avgEnergy > 0.08 && avgEnergy < 0.2 ? 0.3 : 0) + 
      (pitchVar < 25 ? 0.2 : 0) + 
      (avgTempo > 0.9 && avgTempo < 1.1 ? 0.2 : 0);
    
    // Find dominant emotion
    let maxScore = 0;
    let dominantEmotion = 'neutral';
    
    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }
    
    // Calculate arousal and valence for dimensional model
    let arousal = 0; // Energy/activation level
    let valence = 0; // Positive/negative sentiment
    
    if (state.config.useArousalValence) {
      // Arousal: based on energy and pitch variability
      arousal = Math.min(1, (avgEnergy / 0.3 + pitchVar / 60 + avgTempo / 1.5) / 3);
      
      // Valence: based on pitch and energy patterns
      if (dominantEmotion === 'happy') valence = 0.8;
      else if (dominantEmotion === 'sad') valence = -0.7;
      else if (dominantEmotion === 'angry') valence = -0.6;
      else if (dominantEmotion === 'fearful') valence = -0.5;
      else if (dominantEmotion === 'surprised') valence = 0.2;
      else valence = 0;
    }
    
    // Confidence based on score separation
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const confidence = sortedScores.length >= 2 ? 
      Math.min(1, maxScore / Math.max(sortedScores[1], 0.1)) : maxScore;
    
    return {
      emotion: dominantEmotion,
      confidence,
      scores,
      arousal,
      valence,
      features: {
        avgPitch,
        avgEnergy,
        avgTempo,
        pitchVariability: pitchVar,
        energyVariability: energyVar
      }
    };
  };

  // Process prosodic features and classify emotion
  const classifyFromFeatures = (prosodicFeatures) => {
    // Add to feature buffer
    state.featureBuffer.push(prosodicFeatures);
    
    // Maintain buffer size
    if (state.featureBuffer.length > state.config.windowSize * 2) {
      state.featureBuffer.shift();
    }
    
    // Classify if we have enough features
    if (state.featureBuffer.length >= state.config.windowSize) {
      const classification = classifyEmotion(state.featureBuffer.slice(-state.config.windowSize));
      
      // Apply smoothing
      if (state.emotionHistory.length > 0) {
        const prevConfidence = state.currentConfidence;
        const smoothingFactor = state.config.smoothingFactor;
        
        // If new classification is confident enough, blend with previous
        if (classification.confidence > state.config.confidenceThreshold) {
          if (classification.emotion === state.currentEmotion) {
            // Same emotion, increase confidence
            state.currentConfidence = Math.min(1, 
              prevConfidence * (1 - smoothingFactor) + classification.confidence * smoothingFactor
            );
          } else {
            // Different emotion, check if confident enough to switch
            if (classification.confidence > prevConfidence + 0.1) {
              state.currentEmotion = classification.emotion;
              state.currentConfidence = classification.confidence * smoothingFactor + prevConfidence * (1 - smoothingFactor);
              state.stats.transitionCount++;
            }
          }
        }
      } else {
        // First classification
        state.currentEmotion = classification.emotion;
        state.currentConfidence = classification.confidence;
      }
      
      // Add to history
      state.emotionHistory.push({
        emotion: state.currentEmotion,
        confidence: state.currentConfidence,
        timestamp: Date.now(),
        ...classification
      });
      
      // Maintain history size
      if (state.emotionHistory.length > 50) {
        state.emotionHistory.shift();
      }
      
      // Update statistics
      state.stats.totalClassifications++;
      state.stats.emotionCounts[state.currentEmotion]++;
      state.stats.averageConfidence = 
        (state.stats.averageConfidence * (state.stats.totalClassifications - 1) + state.currentConfidence) / 
        state.stats.totalClassifications;
      
      return {
        emotion: state.currentEmotion,
        confidence: state.currentConfidence,
        rawClassification: classification,
        timestamp: Date.now()
      };
    }
    
    return null;
  };

  // Get emotion timeline
  const getEmotionTimeline = (timeWindow = 30000) => {
    const cutoff = Date.now() - timeWindow;
    return state.emotionHistory.filter(entry => entry.timestamp >= cutoff);
  };

  return {
    classifyFromFeatures,
    getEmotionTimeline,
    getCurrentEmotion: () => ({ emotion: state.currentEmotion, confidence: state.currentConfidence }),
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.featureBuffer = [];
      state.emotionHistory = [];
      state.currentEmotion = 'neutral';
      state.currentConfidence = 0;
      state.stats = {
        totalClassifications: 0,
        emotionCounts: {},
        averageConfidence: 0,
        transitionCount: 0
      };
      state.config.emotions.forEach(emotion => {
        state.stats.emotionCounts[emotion] = 0;
      });
    }
  };
};

// Complete emotion detection system
export const createEmotionDetection = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100,
      
      // Processing configuration
      enableProsodics: config.enableProsodics !== false,
      enableClassification: config.enableClassification !== false,
      
      // Update intervals
      emotionUpdateInterval: config.emotionUpdateInterval || 500, // ms
      
      ...config
    },
    
    // Components
    prosodicAnalyzer: null,
    emotionClassifier: null,
    
    // Processing state
    lastEmotionUpdate: 0,
    isInitialized: false,
    
    // Statistics
    stats: {
      totalFrames: 0,
      emotionUpdates: 0,
      processingTime: 0
    }
  };

  // Initialize components
  const initialize = () => {
    if (state.config.enableProsodics) {
      state.prosodicAnalyzer = createProsodicAnalyzer(state.config);
    }
    
    if (state.config.enableClassification) {
      state.emotionClassifier = createEmotionClassifier(state.config);
    }
    
    state.isInitialized = true;
  };

  // Register emotion result type
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

  // Process audio frame for emotion detection
  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    if (!state.isInitialized) {
      initialize();
    }
    
    const startTime = performance.now();
    let prosodicFeatures = null;
    let emotionResult = null;
    
    // Extract prosodic features
    if (state.prosodicAnalyzer) {
      prosodicFeatures = state.prosodicAnalyzer.processFrame(audioBuffer, timestamp);
    }
    
    // Classify emotion periodically
    if (state.emotionClassifier && 
        (timestamp - state.lastEmotionUpdate) >= state.config.emotionUpdateInterval) {
      
      if (prosodicFeatures) {
        emotionResult = state.emotionClassifier.classifyFromFeatures(prosodicFeatures);
        if (emotionResult) {
          state.lastEmotionUpdate = timestamp;
          state.stats.emotionUpdates++;
        }
      }
    }
    
    const processingTime = performance.now() - startTime;
    state.stats.processingTime += processingTime;
    state.stats.totalFrames++;
    
    // Create result if we have emotion data or significant prosodic features
    if (emotionResult || prosodicFeatures) {
      const result = memoryPool.acquire('EmotionResult');
      
      result.timestamp = timestamp;
      
      if (emotionResult) {
        result.emotion = emotionResult.emotion;
        result.confidence = emotionResult.confidence;
        result.arousal = emotionResult.rawClassification.arousal;
        result.valence = emotionResult.rawClassification.valence;
      } else if (state.emotionClassifier) {
        // Use current emotion state
        const current = state.emotionClassifier.getCurrentEmotion();
        result.emotion = current.emotion;
        result.confidence = current.confidence;
      }
      
      result.prosodicFeatures = prosodicFeatures;
      result.processing = {
        prosodicExtracted: prosodicFeatures !== null,
        emotionClassified: emotionResult !== null,
        processingTime
      };
      
      return result;
    }
    
    return null;
  };

  // Release emotion result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get current emotion state
  const getCurrentEmotion = () => {
    if (!state.emotionClassifier) {
      return { emotion: 'neutral', confidence: 0 };
    }
    return state.emotionClassifier.getCurrentEmotion();
  };

  // Get emotion timeline
  const getEmotionTimeline = (timeWindow = 30000) => {
    if (!state.emotionClassifier) return [];
    return state.emotionClassifier.getEmotionTimeline(timeWindow);
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    averageProcessingTime: state.stats.totalFrames > 0 ? 
      state.stats.processingTime / state.stats.totalFrames : 0,
    components: {
      prosodics: state.prosodicAnalyzer ? state.prosodicAnalyzer.getStats() : null,
      classifier: state.emotionClassifier ? state.emotionClassifier.getStats() : null
    },
    memoryPool: memoryPool.getStats()
  });

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

  // Reset system
  const reset = () => {
    if (state.prosodicAnalyzer) state.prosodicAnalyzer.reset();
    if (state.emotionClassifier) state.emotionClassifier.reset();
    
    state.lastEmotionUpdate = 0;
    state.stats = {
      totalFrames: 0,
      emotionUpdates: 0,
      processingTime: 0
    };
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processFrame,
    releaseResult,
    getCurrentEmotion,
    getEmotionTimeline,
    getStats,
    updateConfig,
    reset,
    cleanup,
    isInitialized: () => state.isInitialized
  };
};