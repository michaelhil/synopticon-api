/**
 * Emotion Classification Module
 * Classifies emotions based on prosodic features using rule-based and ML approaches
 */

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
    
    // Calculate confidence based on score separation
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const confidence = sortedScores.length > 1 ? 
      (sortedScores[0] - sortedScores[1]) / sortedScores[0] : 0.5;
    
    // Calculate arousal and valence if enabled
    let arousal = 0;
    let valence = 0;
    
    if (state.config.useArousalValence) {
      // Arousal: Energy + Tempo + Pitch Variability
      arousal = Math.min(1, (avgEnergy * 2 + Math.abs(avgTempo - 1) + pitchVar / 100));
      
      // Valence: Happy/Surprised positive, Sad/Angry/Fearful negative
      const positiveEmotions = ['happy', 'surprised'];
      const negativeEmotions = ['sad', 'angry', 'fearful'];
      
      if (positiveEmotions.includes(dominantEmotion)) {
        valence = maxScore;
      } else if (negativeEmotions.includes(dominantEmotion)) {
        valence = -maxScore;
      }
    }
    
    return {
      emotion: dominantEmotion,
      confidence: Math.max(0, Math.min(1, confidence)),
      scores,
      arousal,
      valence
    };
  };

  // Apply temporal smoothing to emotion classification
  const smoothEmotion = (emotionResult) => {
    state.emotionHistory.push(emotionResult);
    
    // Maintain history size
    if (state.emotionHistory.length > 10) {
      state.emotionHistory.shift();
    }
    
    if (state.emotionHistory.length < 3) {
      return emotionResult;
    }
    
    // Simple temporal smoothing - require consistency for emotion changes
    const recentEmotions = state.emotionHistory.slice(-3);
    const currentEmotionCount = recentEmotions.filter(e => e.emotion === emotionResult.emotion).length;
    
    if (currentEmotionCount >= 2 || emotionResult.confidence > 0.8) {
      // High confidence or consistent emotion
      return emotionResult;
    } else {
      // Low confidence, maintain previous emotion but update confidence
      return {
        ...emotionResult,
        emotion: state.currentEmotion,
        confidence: emotionResult.confidence * state.config.smoothingFactor + 
                   state.currentConfidence * (1 - state.config.smoothingFactor)
      };
    }
  };

  // Process features and return emotion classification
  const processFeatures = (features) => {
    // Add features to buffer
    if (Array.isArray(features)) {
      state.featureBuffer = features.slice(-state.config.windowSize);
    } else {
      state.featureBuffer.push(features);
      if (state.featureBuffer.length > state.config.windowSize) {
        state.featureBuffer.shift();
      }
    }
    
    // Classify emotion
    const emotionResult = classifyEmotion(state.featureBuffer);
    
    // Apply temporal smoothing
    const smoothedResult = smoothEmotion(emotionResult);
    
    // Update state
    if (state.currentEmotion !== smoothedResult.emotion) {
      state.stats.transitionCount++;
    }
    
    state.currentEmotion = smoothedResult.emotion;
    state.currentConfidence = smoothedResult.confidence;
    
    // Update statistics
    state.stats.totalClassifications++;
    state.stats.emotionCounts[smoothedResult.emotion]++;
    state.stats.averageConfidence = (state.stats.averageConfidence * (state.stats.totalClassifications - 1) + 
                                   smoothedResult.confidence) / state.stats.totalClassifications;
    
    return {
      ...smoothedResult,
      timestamp: Date.now()
    };
  };

  return {
    processFeatures,
    getCurrentEmotion: () => state.currentEmotion,
    getCurrentConfidence: () => state.currentConfidence,
    getStats: () => ({ ...state.stats }),
    getEmotionHistory: () => [...state.emotionHistory],
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
      // Reinitialize emotion counts
      state.config.emotions.forEach(emotion => {
        state.stats.emotionCounts[emotion] = 0;
      });
    }
  };
};