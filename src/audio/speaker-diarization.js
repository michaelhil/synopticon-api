/**
 * Speaker Diarization Module
 * Advanced speaker identification and segmentation for multi-speaker conversations
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../utils/enhanced-memory-pool.js';

// Voice fingerprinting using MFCC features
export const createVoiceFingerprinting = (config = {}) => {
  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      sampleRate: config.sampleRate || 44100,
      mfccCoefficients: config.mfccCoefficients || 13,
      melFilters: config.melFilters || 26,
      minFreq: config.minFreq || 80,
      maxFreq: config.maxFreq || 8000,
      
      // Fingerprint parameters
      fingerprintLength: config.fingerprintLength || 50, // Number of MFCC frames
      updateThreshold: config.updateThreshold || 0.8, // Similarity threshold for updates
      minSpeechDuration: config.minSpeechDuration || 1000 // ms
    },
    
    // Speaker fingerprints database
    fingerprints: new Map(),
    speakerCounter: 0,
    
    // Mel filter bank
    melFilterBank: null,
    
    // Statistics
    stats: {
      totalSpeakers: 0,
      totalFingerprints: 0,
      averageSimilarity: 0,
      identificationsPerformed: 0
    }
  };

  // Initialize mel filter bank
  const initializeMelFilterBank = () => {
    const nyquist = state.config.sampleRate / 2;
    const fftSize = state.config.frameSize / 2 + 1;
    const melLow = melScale(state.config.minFreq);
    const melHigh = melScale(state.config.maxFreq);
    
    const melPoints = [];
    for (let i = 0; i <= state.config.melFilters + 1; i++) {
      const mel = melLow + (melHigh - melLow) * i / (state.config.melFilters + 1);
      melPoints.push(invMelScale(mel));
    }
    
    // Convert to FFT bin indices
    const binPoints = melPoints.map(freq => Math.floor(freq * fftSize / nyquist));
    
    // Create triangular filters
    state.melFilterBank = [];
    for (let i = 1; i <= state.config.melFilters; i++) {
      const filter = new Float32Array(fftSize);
      const left = binPoints[i - 1];
      const center = binPoints[i];
      const right = binPoints[i + 1];
      
      // Left slope
      for (let j = left; j <= center; j++) {
        if (center > left) {
          filter[j] = (j - left) / (center - left);
        }
      }
      
      // Right slope
      for (let j = center; j <= right; j++) {
        if (right > center) {
          filter[j] = (right - j) / (right - center);
        }
      }
      
      state.melFilterBank.push(filter);
    }
  };

  // Mel scale conversion
  const melScale = (freq) => 2595 * Math.log10(1 + freq / 700);
  const invMelScale = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);

  // Calculate MFCC features from audio
  const calculateMFCC = (audioBuffer) => {
    const fft = performFFT(audioBuffer);
    const powerSpectrum = fft.map(bin => bin.real * bin.real + bin.imag * bin.imag);
    
    // Apply mel filter bank
    const melEnergies = new Array(state.config.melFilters);
    for (let i = 0; i < state.config.melFilters; i++) {
      let energy = 0;
      for (let j = 0; j < powerSpectrum.length; j++) {
        energy += powerSpectrum[j] * state.melFilterBank[i][j];
      }
      melEnergies[i] = Math.log(energy + 1e-10); // Add small epsilon
    }
    
    // Discrete Cosine Transform
    const mfccCoeffs = new Array(state.config.mfccCoefficients);
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      let coeff = 0;
      for (let j = 0; j < state.config.melFilters; j++) {
        coeff += melEnergies[j] * Math.cos(i * (j + 0.5) * Math.PI / state.config.melFilters);
      }
      mfccCoeffs[i] = coeff;
    }
    
    return mfccCoeffs;
  };

  // Simple FFT implementation
  const performFFT = (audioBuffer) => {
    const N = audioBuffer.length;
    const output = new Array(N);
    
    for (let k = 0; k < N; k++) {
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

  // Create voice fingerprint from MFCC sequence
  const createFingerprint = (mfccSequence) => {
    if (mfccSequence.length < state.config.fingerprintLength) {
      return null;
    }
    
    // Use statistical measures across the sequence
    const fingerprint = {
      mean: new Array(state.config.mfccCoefficients).fill(0),
      variance: new Array(state.config.mfccCoefficients).fill(0),
      delta: new Array(state.config.mfccCoefficients).fill(0),
      deltaDelta: new Array(state.config.mfccCoefficients).fill(0)
    };
    
    // Calculate means
    for (let frame of mfccSequence) {
      for (let i = 0; i < state.config.mfccCoefficients; i++) {
        fingerprint.mean[i] += frame[i];
      }
    }
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      fingerprint.mean[i] /= mfccSequence.length;
    }
    
    // Calculate variances
    for (let frame of mfccSequence) {
      for (let i = 0; i < state.config.mfccCoefficients; i++) {
        const diff = frame[i] - fingerprint.mean[i];
        fingerprint.variance[i] += diff * diff;
      }
    }
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      fingerprint.variance[i] /= mfccSequence.length;
    }
    
    // Calculate delta coefficients (derivatives)
    if (mfccSequence.length >= 3) {
      for (let t = 1; t < mfccSequence.length - 1; t++) {
        for (let i = 0; i < state.config.mfccCoefficients; i++) {
          fingerprint.delta[i] += (mfccSequence[t + 1][i] - mfccSequence[t - 1][i]) / 2;
        }
      }
      for (let i = 0; i < state.config.mfccCoefficients; i++) {
        fingerprint.delta[i] /= (mfccSequence.length - 2);
      }
    }
    
    return fingerprint;
  };

  // Calculate similarity between fingerprints
  const calculateSimilarity = (fp1, fp2) => {
    if (!fp1 || !fp2) return 0;
    
    let totalDistance = 0;
    let components = 0;
    
    // Mean similarity (using cosine similarity)
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      dot += fp1.mean[i] * fp2.mean[i];
      norm1 += fp1.mean[i] * fp1.mean[i];
      norm2 += fp2.mean[i] * fp2.mean[i];
    }
    const meanSimilarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-10);
    totalDistance += meanSimilarity;
    components++;
    
    // Variance similarity (using negative normalized difference)
    let varianceDiff = 0;
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      varianceDiff += Math.abs(fp1.variance[i] - fp2.variance[i]) / 
                      (Math.max(fp1.variance[i], fp2.variance[i]) + 1e-10);
    }
    const varianceSimilarity = 1 - (varianceDiff / state.config.mfccCoefficients);
    totalDistance += varianceSimilarity;
    components++;
    
    return totalDistance / components;
  };

  // Process audio segment and return speaker identification
  const processAudioSegment = (audioBuffer, timestamp = Date.now()) => {
    if (!state.melFilterBank) {
      initializeMelFilterBank();
    }
    
    const mfccFeatures = calculateMFCC(audioBuffer);
    
    // For longer segments, collect multiple MFCC frames
    const mfccSequence = [mfccFeatures]; // In real implementation, collect over time
    const fingerprint = createFingerprint(mfccSequence);
    
    if (!fingerprint) {
      return {
        speakerId: null,
        confidence: 0,
        newSpeaker: false,
        timestamp
      };
    }
    
    // Find best matching speaker
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [speakerId, storedFingerprint] of state.fingerprints.entries()) {
      const similarity = calculateSimilarity(fingerprint, storedFingerprint);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = speakerId;
      }
    }
    
    let speakerId;
    let newSpeaker = false;
    
    if (bestSimilarity > state.config.updateThreshold) {
      // Existing speaker
      speakerId = bestMatch;
      
      // Update fingerprint (adaptive learning)
      const stored = state.fingerprints.get(speakerId);
      const alpha = 0.1; // Learning rate
      for (let i = 0; i < state.config.mfccCoefficients; i++) {
        stored.mean[i] = (1 - alpha) * stored.mean[i] + alpha * fingerprint.mean[i];
        stored.variance[i] = (1 - alpha) * stored.variance[i] + alpha * fingerprint.variance[i];
      }
    } else {
      // New speaker
      speakerId = `speaker_${++state.speakerCounter}`;
      state.fingerprints.set(speakerId, fingerprint);
      newSpeaker = true;
      state.stats.totalSpeakers++;
    }
    
    // Update statistics
    state.stats.identificationsPerformed++;
    state.stats.averageSimilarity = (state.stats.averageSimilarity * (state.stats.identificationsPerformed - 1) + 
                                   bestSimilarity) / state.stats.identificationsPerformed;
    
    return {
      speakerId,
      confidence: bestSimilarity,
      newSpeaker,
      fingerprint,
      timestamp
    };
  };

  // Get speaker information
  const getSpeakerInfo = (speakerId) => {
    const fingerprint = state.fingerprints.get(speakerId);
    if (!fingerprint) return null;
    
    return {
      speakerId,
      fingerprintExists: true,
      mfccDimensions: state.config.mfccCoefficients,
      lastUpdated: Date.now()
    };
  };

  // Reset speaker database
  const resetSpeakers = () => {
    state.fingerprints.clear();
    state.speakerCounter = 0;
    state.stats.totalSpeakers = 0;
  };

  return {
    processAudioSegment,
    getSpeakerInfo,
    resetSpeakers,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    getSpeakerCount: () => state.fingerprints.size,
    getAllSpeakers: () => Array.from(state.fingerprints.keys())
  };
};

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

// Complete speaker diarization system
export const createSpeakerDiarization = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      sampleRate: config.sampleRate || 44100,
      
      // Processing parameters
      enableChangeDetection: config.enableChangeDetection !== false,
      enableVoiceFingerprinting: config.enableVoiceFingerprinting !== false,
      minSpeakerDuration: config.minSpeakerDuration || 2000, // ms
      
      ...config
    },
    
    // Components
    voiceFingerprinting: null,
    changeDetection: null,
    
    // Current processing state
    currentSpeaker: null,
    speakerSegments: [],
    isInitialized: false,
    
    // Statistics
    stats: {
      totalFrames: 0,
      totalSpeakers: 0,
      totalSpeakerSwitches: 0,
      averageSegmentDuration: 0,
      confidence: 0
    }
  };

  // Initialize components
  const initialize = () => {
    if (state.config.enableVoiceFingerprinting) {
      state.voiceFingerprinting = createVoiceFingerprinting(state.config);
    }
    
    if (state.config.enableChangeDetection) {
      state.changeDetection = createSpeakerChangeDetection(state.config);
    }
    
    state.isInitialized = true;
  };

  // Register diarization result type
  memoryPool.registerFactory('DiarizationResult', () => ({
    _pooled: true,
    timestamp: 0,
    speakerId: null,
    confidence: 0,
    speakerChanged: false,
    segmentInfo: null,
    processing: {
      changeDetected: false,
      fingerprinted: false,
      processingTime: 0
    }
  }));

  // Process audio frame for diarization
  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    if (!state.isInitialized) {
      initialize();
    }
    
    const startTime = performance.now();
    let speakerId = null;
    let confidence = 0;
    let speakerChanged = false;
    let segmentInfo = null;
    
    // Run change detection
    let changeResult = null;
    if (state.changeDetection) {
      changeResult = state.changeDetection.processFrame(audioBuffer, timestamp);
    }
    
    // Run voice fingerprinting
    let fingerprintResult = null;
    if (state.voiceFingerprinting) {
      fingerprintResult = state.voiceFingerprinting.processAudioSegment(audioBuffer, timestamp);
      speakerId = fingerprintResult.speakerId;
      confidence = fingerprintResult.confidence;
    }
    
    // Combine results
    if (changeResult && changeResult.changeDetected) {
      // Speaker change detected, trust the change detection
      if (state.currentSpeaker) {
        // End current segment
        const segment = {
          speakerId: state.currentSpeaker.speakerId,
          startTime: state.currentSpeaker.startTime,
          endTime: timestamp,
          duration: timestamp - state.currentSpeaker.startTime,
          confidence: state.currentSpeaker.confidence
        };
        
        if (segment.duration >= state.config.minSpeakerDuration) {
          state.speakerSegments.push(segment);
          state.stats.totalSpeakerSwitches++;
        }
      }
      
      // Start new segment
      if (speakerId) {
        state.currentSpeaker = {
          speakerId,
          startTime: timestamp,
          confidence
        };
        speakerChanged = true;
        
        if (fingerprintResult && fingerprintResult.newSpeaker) {
          state.stats.totalSpeakers++;
        }
      }
      
      segmentInfo = changeResult.segment;
    } else if (speakerId && speakerId !== (state.currentSpeaker?.speakerId)) {
      // Voice fingerprinting detected different speaker
      if (confidence > 0.7) { // High confidence threshold
        if (state.currentSpeaker) {
          // End current segment
          const segment = {
            speakerId: state.currentSpeaker.speakerId,
            startTime: state.currentSpeaker.startTime,
            endTime: timestamp,
            duration: timestamp - state.currentSpeaker.startTime,
            confidence: state.currentSpeaker.confidence
          };
          
          if (segment.duration >= state.config.minSpeakerDuration) {
            state.speakerSegments.push(segment);
            state.stats.totalSpeakerSwitches++;
          }
        }
        
        // Start new segment
        state.currentSpeaker = {
          speakerId,
          startTime: timestamp,
          confidence
        };
        speakerChanged = true;
        
        if (fingerprintResult && fingerprintResult.newSpeaker) {
          state.stats.totalSpeakers++;
        }
      }
    } else if (state.currentSpeaker) {
      // Continue with current speaker
      speakerId = state.currentSpeaker.speakerId;
      
      // Update confidence with moving average
      if (confidence > 0) {
        state.currentSpeaker.confidence = 
          state.currentSpeaker.confidence * 0.9 + confidence * 0.1;
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    // Update statistics
    state.stats.totalFrames++;
    if (confidence > 0) {
      state.stats.confidence = (state.stats.confidence * (state.stats.totalFrames - 1) + 
                               confidence) / state.stats.totalFrames;
    }
    
    // Create result
    const result = memoryPool.acquire('DiarizationResult');
    result.timestamp = timestamp;
    result.speakerId = speakerId;
    result.confidence = confidence;
    result.speakerChanged = speakerChanged;
    result.segmentInfo = segmentInfo;
    result.processing = {
      changeDetected: changeResult?.changeDetected || false,
      fingerprinted: fingerprintResult !== null,
      processingTime
    };
    
    return result;
  };

  // Release diarization result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get all speaker segments
  const getSegments = () => {
    const allSegments = [...state.speakerSegments];
    
    // Add current segment if it exists
    if (state.currentSpeaker) {
      const current = {
        speakerId: state.currentSpeaker.speakerId,
        startTime: state.currentSpeaker.startTime,
        endTime: Date.now(),
        duration: Date.now() - state.currentSpeaker.startTime,
        confidence: state.currentSpeaker.confidence,
        active: true
      };
      allSegments.push(current);
    }
    
    return allSegments;
  };

  // Get speaker information
  const getSpeakerInfo = () => {
    const speakers = new Map();
    
    for (const segment of state.speakerSegments) {
      if (!speakers.has(segment.speakerId)) {
        speakers.set(segment.speakerId, {
          speakerId: segment.speakerId,
          totalDuration: 0,
          segmentCount: 0,
          averageConfidence: 0,
          firstAppearance: segment.startTime,
          lastAppearance: segment.endTime
        });
      }
      
      const speaker = speakers.get(segment.speakerId);
      speaker.totalDuration += segment.duration;
      speaker.segmentCount++;
      speaker.averageConfidence = (speaker.averageConfidence * (speaker.segmentCount - 1) + 
                                  segment.confidence) / speaker.segmentCount;
      speaker.lastAppearance = Math.max(speaker.lastAppearance, segment.endTime);
    }
    
    return Array.from(speakers.values());
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    components: {
      voiceFingerprinting: state.voiceFingerprinting ? state.voiceFingerprinting.getStats() : null,
      changeDetection: state.changeDetection ? state.changeDetection.getStats() : null
    },
    memoryPool: memoryPool.getStats(),
    currentSegments: state.speakerSegments.length,
    activeSpeaker: state.currentSpeaker?.speakerId || null
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.voiceFingerprinting && state.voiceFingerprinting) {
      state.voiceFingerprinting.updateConfig(newConfig.voiceFingerprinting);
    }
    if (newConfig.changeDetection && state.changeDetection) {
      state.changeDetection.updateConfig(newConfig.changeDetection);
    }
  };

  // Reset system
  const reset = () => {
    state.currentSpeaker = null;
    state.speakerSegments = [];
    state.stats = {
      totalFrames: 0,
      totalSpeakers: 0,
      totalSpeakerSwitches: 0,
      averageSegmentDuration: 0,
      confidence: 0
    };
    
    if (state.voiceFingerprinting) {
      state.voiceFingerprinting.resetSpeakers();
    }
    if (state.changeDetection) {
      state.changeDetection.reset();
    }
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processFrame,
    releaseResult,
    getSegments,
    getSpeakerInfo,
    getStats,
    updateConfig,
    reset,
    cleanup,
    isInitialized: () => state.isInitialized
  };
};