/**
 * Voice Fingerprinting Module
 * Advanced speaker identification using MFCC features and acoustic fingerprinting
 */

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
    for (const frame of mfccSequence) {
      for (let i = 0; i < state.config.mfccCoefficients; i++) {
        fingerprint.mean[i] += frame[i];
      }
    }
    for (let i = 0; i < state.config.mfccCoefficients; i++) {
      fingerprint.mean[i] /= mfccSequence.length;
    }
    
    // Calculate variances
    for (const frame of mfccSequence) {
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