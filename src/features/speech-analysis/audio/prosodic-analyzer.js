/**
 * Prosodic Analysis Module
 * Extracts pitch, energy, and timing features from speech audio
 */

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
    
    // Peak energy
    let peak = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      const abs = Math.abs(audioBuffer[i]);
      if (abs > peak) peak = abs;
    }
    
    // Zero crossing rate (for voicing detection)
    let zcr = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        zcr++;
      }
    }
    zcr /= audioBuffer.length;
    
    return {
      rms: rms * (1 - state.config.energySmoothing) + 
           (state.featureHistory.length > 0 ? 
             state.featureHistory[state.featureHistory.length - 1].energy?.rms || 0 : 0) * 
           state.config.energySmoothing,
      peak,
      zcr
    };
  };

  // Extract timing and rhythm features
  const extractTiming = (audioBuffer, timestamp) => {
    // Simple tempo estimation based on energy peaks
    const windowSize = state.config.timingWindowSize;
    
    if (state.featureHistory.length < windowSize) {
      return {
        tempo: 1.0,
        rhythm: 0.5,
        pauses: 0
      };
    }
    
    // Calculate inter-peak intervals
    const recent = state.featureHistory.slice(-windowSize);
    const energyThreshold = recent.reduce((sum, f) => sum + f.energy.rms, 0) / recent.length * 1.5;
    
    const peaks = [];
    for (let i = 1; i < recent.length - 1; i++) {
      if (recent[i].energy.rms > energyThreshold &&
          recent[i].energy.rms > recent[i-1].energy.rms &&
          recent[i].energy.rms > recent[i+1].energy.rms) {
        peaks.push(i);
      }
    }
    
    // Estimate tempo from peak intervals
    let tempo = 1.0;
    if (peaks.length > 1) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      tempo = 60 / (avgInterval * state.config.hopSize / state.config.sampleRate); // BPM converted to relative
      tempo = Math.max(0.5, Math.min(2.0, tempo / 120)); // Normalize around 120 BPM
    }
    
    // Simple pause detection
    const silenceThreshold = 0.01;
    const silentFrames = recent.filter(f => f.energy.rms < silenceThreshold).length;
    const pauseRatio = silentFrames / recent.length;
    
    return {
      tempo,
      rhythm: 1 - pauseRatio, // Inverse of pause ratio
      pauses: pauseRatio
    };
  };

  // Normalize features using adaptive or fixed normalization
  const normalizeFeatures = (features) => {
    if (!state.config.normalizeFeatures) {
      return features;
    }
    
    const normalizedFeatures = { ...features };
    
    if (state.config.adaptiveNormalization && state.featureHistory.length > 10) {
      // Update normalization statistics
      const recentFeatures = state.featureHistory.slice(-50);
      const validPitches = recentFeatures.map(f => f.pitch).filter(p => p > 0);
      const energies = recentFeatures.map(f => f.energy.rms);
      const tempos = recentFeatures.map(f => f.timing.tempo);
      
      if (validPitches.length > 0) {
        state.normalizationStats.pitch.mean = validPitches.reduce((sum, p) => sum + p, 0) / validPitches.length;
        state.normalizationStats.pitch.std = Math.sqrt(
          validPitches.reduce((sum, p) => sum + Math.pow(p - state.normalizationStats.pitch.mean, 2), 0) / validPitches.length
        );
      }
      
      state.normalizationStats.energy.mean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
      state.normalizationStats.energy.std = Math.sqrt(
        energies.reduce((sum, e) => sum + Math.pow(e - state.normalizationStats.energy.mean, 2), 0) / energies.length
      );
      
      state.normalizationStats.tempo.mean = tempos.reduce((sum, t) => sum + t, 0) / tempos.length;
      state.normalizationStats.tempo.std = Math.sqrt(
        tempos.reduce((sum, t) => sum + Math.pow(t - state.normalizationStats.tempo.mean, 2), 0) / tempos.length
      );
    }
    
    // Apply normalization
    if (features.pitch > 0) {
      normalizedFeatures.pitch = (features.pitch - state.normalizationStats.pitch.mean) / 
                                (state.normalizationStats.pitch.std || 1);
    }
    
    normalizedFeatures.energy = {
      ...features.energy,
      rms: (features.energy.rms - state.normalizationStats.energy.mean) / 
           (state.normalizationStats.energy.std || 1)
    };
    
    normalizedFeatures.timing = {
      ...features.timing,
      tempo: (features.timing.tempo - state.normalizationStats.tempo.mean) / 
             (state.normalizationStats.tempo.std || 1)
    };
    
    return normalizedFeatures;
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
    getFeatureHistory: () => [...state.featureHistory],
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
