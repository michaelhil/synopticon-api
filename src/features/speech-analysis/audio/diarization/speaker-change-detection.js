/**
 * Speaker Change Detection Module
 * Detects speaker transitions using audio features and change point detection
 */

// Speaker change detection using audio features
export const createSpeakerChangeDetection = (config = {}) => {
  const state = {
    config: {
      windowSize: config.windowSize || 2000, // ms
      stepSize: config.stepSize || 500, // ms
      changeThreshold: config.changeThreshold || 0.3,
      minSegmentDuration: config.minSegmentDuration || 1000, // ms
      
      // Feature parameters
      spectralFeatures: config.spectralFeatures !== false,
      pitchFeatures: config.pitchFeatures !== false,
      energyFeatures: config.energyFeatures !== false
    },
    
    // Sliding window for change detection
    featureHistory: [],
    currentSegment: null,
    segments: [],
    
    stats: {
      totalSegments: 0,
      averageSegmentDuration: 0,
      changePointsDetected: 0
    }
  };

  // Extract features for change detection
  const extractFeatures = (audioBuffer) => {
    const features = {};
    
    if (state.config.spectralFeatures) {
      // Spectral centroid and rolloff
      const fft = performSimpleFFT(audioBuffer);
      const magnitudes = fft.map(bin => Math.sqrt(bin.real * bin.real + bin.imag * bin.imag));
      
      let weightedSum = 0, totalMagnitude = 0;
      for (let i = 0; i < magnitudes.length; i++) {
        weightedSum += i * magnitudes[i];
        totalMagnitude += magnitudes[i];
      }
      features.spectralCentroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
      
      // Spectral rolloff (95% of energy)
      let cumulativeEnergy = 0;
      const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
      const rolloffThreshold = totalEnergy * 0.95;
      
      for (let i = 0; i < magnitudes.length; i++) {
        cumulativeEnergy += magnitudes[i] * magnitudes[i];
        if (cumulativeEnergy >= rolloffThreshold) {
          features.spectralRolloff = i;
          break;
        }
      }
    }
    
    if (state.config.pitchFeatures) {
      // Simple pitch estimation using autocorrelation
      const pitch = estimatePitch(audioBuffer);
      features.pitch = pitch;
    }
    
    if (state.config.energyFeatures) {
      // RMS energy and zero crossing rate
      let rms = 0, zcr = 0;
      for (let i = 0; i < audioBuffer.length; i++) {
        rms += audioBuffer[i] * audioBuffer[i];
        if (i > 0 && Math.sign(audioBuffer[i]) !== Math.sign(audioBuffer[i - 1])) {
          zcr++;
        }
      }
      features.rms = Math.sqrt(rms / audioBuffer.length);
      features.zcr = zcr / (audioBuffer.length - 1);
    }
    
    return features;
  };

  // Simple pitch estimation
  const estimatePitch = (audioBuffer) => {
    const sampleRate = 44100; // Assume standard rate
    const minPitch = 80, maxPitch = 400;
    const minPeriod = Math.floor(sampleRate / maxPitch);
    const maxPeriod = Math.floor(sampleRate / minPitch);
    
    let bestCorrelation = 0;
    let bestPeriod = minPeriod;
    
    for (let period = minPeriod; period <= maxPeriod && period < audioBuffer.length / 2; period++) {
      let correlation = 0;
      const samples = audioBuffer.length - period;
      
      for (let i = 0; i < samples; i++) {
        correlation += audioBuffer[i] * audioBuffer[i + period];
      }
      
      correlation /= samples;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestCorrelation > 0.3 ? sampleRate / bestPeriod : 0;
  };

  // Simple FFT for spectral analysis
  const performSimpleFFT = (audioBuffer) => {
    const N = Math.min(audioBuffer.length, 1024); // Limit size for performance
    const output = new Array(N / 2);
    
    for (let k = 0; k < N / 2; k++) {
      let sumReal = 0;
      let sumImag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        sumReal += audioBuffer[n] * Math.cos(angle);
        sumImag += audioBuffer[n] * Math.sin(angle);
      }
      
      output[k] = { real: sumReal, imag: sumImag };
    }
    
    return output;
  };

  // Calculate feature distance
  const calculateFeatureDistance = (features1, features2) => {
    const keys = Object.keys(features1);
    let totalDistance = 0;
    let count = 0;
    
    for (const key of keys) {
      if (features2.hasOwnProperty(key)) {
        const val1 = features1[key];
        const val2 = features2[key];
        
        // Normalize based on feature type
        let distance;
        if (key === 'pitch') {
          distance = Math.abs(val1 - val2) / Math.max(val1, val2, 100); // Normalize by frequency
        } else if (key === 'spectralCentroid' || key === 'spectralRolloff') {
          distance = Math.abs(val1 - val2) / Math.max(val1, val2, 1);
        } else {
          distance = Math.abs(val1 - val2) / (Math.abs(val1) + Math.abs(val2) + 1e-10);
        }
        
        totalDistance += distance;
        count++;
      }
    }
    
    return count > 0 ? totalDistance / count : 1;
  };

  // Process audio frame for change detection
  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    const features = extractFeatures(audioBuffer);
    
    // Add to history
    state.featureHistory.push({ features, timestamp });
    
    // Remove old entries outside window
    const windowStart = timestamp - state.config.windowSize;
    state.featureHistory = state.featureHistory.filter(entry => entry.timestamp >= windowStart);
    
    // Detect change if we have enough history
    if (state.featureHistory.length >= 4) { // Need at least 4 points
      const recent = state.featureHistory.slice(-2);
      const older = state.featureHistory.slice(0, -2);
      
      // Calculate average features for each group
      const recentAvg = averageFeatures(recent);
      const olderAvg = averageFeatures(older);
      
      const distance = calculateFeatureDistance(recentAvg, olderAvg);
      
      // Check for speaker change
      if (distance > state.config.changeThreshold) {
        // End current segment if it exists and is long enough
        if (state.currentSegment && 
            (timestamp - state.currentSegment.startTime) >= state.config.minSegmentDuration) {
          
          state.currentSegment.endTime = timestamp;
          state.currentSegment.duration = state.currentSegment.endTime - state.currentSegment.startTime;
          state.segments.push({ ...state.currentSegment });
          
          state.stats.totalSegments++;
          state.stats.averageSegmentDuration = 
            (state.stats.averageSegmentDuration * (state.stats.totalSegments - 1) + 
             state.currentSegment.duration) / state.stats.totalSegments;
          state.stats.changePointsDetected++;
        }
        
        // Start new segment
        state.currentSegment = {
          startTime: timestamp,
          endTime: null,
          duration: null,
          features: recentAvg,
          changeDistance: distance
        };
        
        return {
          changeDetected: true,
          timestamp,
          distance,
          segment: { ...state.currentSegment }
        };
      }
    }
    
    // Initialize first segment
    if (!state.currentSegment) {
      state.currentSegment = {
        startTime: timestamp,
        endTime: null,
        duration: null,
        features,
        changeDistance: 0
      };
    }
    
    return {
      changeDetected: false,
      timestamp,
      distance: 0,
      segment: state.currentSegment
    };
  };

  // Calculate average features
  const averageFeatures = (entries) => {
    if (entries.length === 0) return {};
    
    const keys = Object.keys(entries[0].features);
    const avg = {};
    
    for (const key of keys) {
      avg[key] = entries.reduce((sum, entry) => sum + entry.features[key], 0) / entries.length;
    }
    
    return avg;
  };

  // Get detected segments
  const getSegments = () => {
    const allSegments = [...state.segments];
    
    // Add current segment if it exists
    if (state.currentSegment) {
      const current = { ...state.currentSegment };
      current.endTime = Date.now();
      current.duration = current.endTime - current.startTime;
      allSegments.push(current);
    }
    
    return allSegments;
  };

  return {
    processFrame,
    getSegments,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.featureHistory = [];
      state.currentSegment = null;
      state.segments = [];
      state.stats = {
        totalSegments: 0,
        averageSegmentDuration: 0,
        changePointsDetected: 0
      };
    }
  };
};