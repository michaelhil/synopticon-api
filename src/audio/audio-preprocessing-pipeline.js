/**
 * Audio Preprocessing Pipeline
 * Advanced audio preprocessing and enhancement
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../utils/enhanced-memory-pool.js';

// Noise reduction using spectral subtraction
export const createNoiseReduction = (config = {}) => {
  const state = {
    config: {
      alpha: config.alpha || 2.0, // Spectral subtraction factor
      beta: config.beta || 0.01, // Noise floor factor
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      learningRate: config.learningRate || 0.95,
      minGain: config.minGain || 0.1, // Minimum gain to prevent over-subtraction
      maxGain: config.maxGain || 2.0
    },
    
    // Noise profile
    noiseProfile: null,
    noiseProfileInitialized: false,
    adaptationFrames: 0,
    targetAdaptationFrames: config.adaptationFrames || 20,
    
    // Processing buffers
    window: null,
    overlapBuffer: null,
    
    stats: {
      totalFrames: 0,
      noiseReductionApplied: 0,
      averageNoiseLevel: 0
    }
  };

  // Initialize Hann window
  const initializeWindow = () => {
    state.window = new Float32Array(state.config.frameSize);
    for (let i = 0; i < state.config.frameSize; i++) {
      state.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (state.config.frameSize - 1)));
    }
    
    state.overlapBuffer = new Float32Array(state.config.frameSize - state.config.hopSize);
  };

  // Apply window function
  const applyWindow = (audioBuffer) => {
    const windowed = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      windowed[i] = audioBuffer[i] * state.window[i];
    }
    return windowed;
  };

  // FFT implementation (simplified)
  const fft = (inputBuffer) => {
    const N = inputBuffer.length;
    const output = new Array(N);
    
    for (let k = 0; k < N; k++) {
      let sumReal = 0;
      let sumImag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        sumReal += inputBuffer[n] * Math.cos(angle);
        sumImag += inputBuffer[n] * Math.sin(angle);
      }
      
      output[k] = { real: sumReal, imag: sumImag };
    }
    
    return output;
  };

  // Inverse FFT
  const ifft = (complexBuffer) => {
    const N = complexBuffer.length;
    const output = new Float32Array(N);
    
    for (let n = 0; n < N; n++) {
      let sum = 0;
      
      for (let k = 0; k < N; k++) {
        const angle = 2 * Math.PI * k * n / N;
        sum += complexBuffer[k].real * Math.cos(angle) - complexBuffer[k].imag * Math.sin(angle);
      }
      
      output[n] = sum / N;
    }
    
    return output;
  };

  // Update noise profile during quiet segments
  const updateNoiseProfile = (magnitudes) => {
    if (!state.noiseProfileInitialized) {
      state.noiseProfile = new Float32Array(magnitudes.length);
      for (let i = 0; i < magnitudes.length; i++) {
        state.noiseProfile[i] = magnitudes[i];
      }
      state.noiseProfileInitialized = true;
    } else {
      // Exponential moving average
      const rate = state.config.learningRate;
      for (let i = 0; i < magnitudes.length; i++) {
        state.noiseProfile[i] = rate * state.noiseProfile[i] + (1 - rate) * magnitudes[i];
      }
    }
    
    state.adaptationFrames++;
  };

  // Apply spectral subtraction
  const processFrame = (audioBuffer, isQuiet = false) => {
    if (!state.window) {
      initializeWindow();
    }
    
    // Apply window
    const windowed = applyWindow(audioBuffer);
    
    // Forward FFT
    const fftResult = fft(windowed);
    
    // Calculate magnitudes and phases
    const magnitudes = new Float32Array(fftResult.length);
    const phases = new Float32Array(fftResult.length);
    
    for (let i = 0; i < fftResult.length; i++) {
      magnitudes[i] = Math.sqrt(fftResult[i].real * fftResult[i].real + fftResult[i].imag * fftResult[i].imag);
      phases[i] = Math.atan2(fftResult[i].imag, fftResult[i].real);
    }
    
    // Update noise profile if in quiet segment
    if (isQuiet || state.adaptationFrames < state.targetAdaptationFrames) {
      updateNoiseProfile(magnitudes);
    }
    
    // Apply spectral subtraction if noise profile is available
    let enhancedMagnitudes = magnitudes;
    if (state.noiseProfile) {
      enhancedMagnitudes = new Float32Array(magnitudes.length);
      
      for (let i = 0; i < magnitudes.length; i++) {
        const signalMag = magnitudes[i];
        const noiseMag = state.noiseProfile[i];
        
        // Spectral subtraction
        const subtractedMag = signalMag - state.config.alpha * noiseMag;
        const flooredMag = Math.max(subtractedMag, state.config.beta * signalMag);
        
        // Apply gain limits
        const gain = signalMag > 0 ? flooredMag / signalMag : 1;
        const limitedGain = Math.max(state.config.minGain, Math.min(state.config.maxGain, gain));
        
        enhancedMagnitudes[i] = signalMag * limitedGain;
      }
    }
    
    // Reconstruct complex spectrum
    const enhancedSpectrum = new Array(fftResult.length);
    for (let i = 0; i < fftResult.length; i++) {
      enhancedSpectrum[i] = {
        real: enhancedMagnitudes[i] * Math.cos(phases[i]),
        imag: enhancedMagnitudes[i] * Math.sin(phases[i])
      };
    }
    
    // Inverse FFT
    let enhanced = ifft(enhancedSpectrum);
    
    // Apply window again for overlap-add
    for (let i = 0; i < enhanced.length; i++) {
      enhanced[i] *= state.window[i];
    }
    
    // Overlap-add processing
    const output = new Float32Array(state.config.hopSize);
    
    // Add overlap from previous frame
    for (let i = 0; i < state.overlapBuffer.length && i < state.config.hopSize; i++) {
      output[i] = enhanced[i] + state.overlapBuffer[i];
    }
    
    // Copy remaining samples
    for (let i = state.overlapBuffer.length; i < state.config.hopSize && i < enhanced.length; i++) {
      output[i] = enhanced[i];
    }
    
    // Save overlap for next frame
    const overlapStart = state.config.hopSize;
    for (let i = 0; i < state.overlapBuffer.length; i++) {
      if (overlapStart + i < enhanced.length) {
        state.overlapBuffer[i] = enhanced[overlapStart + i];
      } else {
        state.overlapBuffer[i] = 0;
      }
    }
    
    // Update statistics
    state.stats.totalFrames++;
    if (state.noiseProfile) {
      state.stats.noiseReductionApplied++;
      const avgNoise = state.noiseProfile.reduce((sum, n) => sum + n, 0) / state.noiseProfile.length;
      state.stats.averageNoiseLevel = avgNoise;
    }
    
    return output;
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.noiseProfile = null;
      state.noiseProfileInitialized = false;
      state.adaptationFrames = 0;
      if (state.overlapBuffer) {
        state.overlapBuffer.fill(0);
      }
    }
  };
};

// Automatic Gain Control (AGC)
export const createAutomaticGainControl = (config = {}) => {
  const state = {
    config: {
      targetLevel: config.targetLevel || -12, // dB
      maxGain: config.maxGain || 20, // dB
      minGain: config.minGain || -10, // dB
      attackTime: config.attackTime || 0.001, // seconds
      releaseTime: config.releaseTime || 0.1, // seconds
      sampleRate: config.sampleRate || 44100,
      lookAheadTime: config.lookAheadTime || 0.005 // seconds
    },
    
    // AGC state
    currentGain: 1.0, // linear gain
    envelope: 0.0,
    lookAheadBuffer: null,
    lookAheadIndex: 0,
    
    // Coefficients
    attackCoeff: 0,
    releaseCoeff: 0,
    
    stats: {
      totalFrames: 0,
      gainAdjustments: 0,
      averageGain: 0,
      peakLevel: -Infinity,
      averageLevel: 0
    }
  };

  // Initialize AGC
  const initialize = () => {
    // Calculate time constants
    state.attackCoeff = Math.exp(-1 / (state.config.attackTime * state.config.sampleRate));
    state.releaseCoeff = Math.exp(-1 / (state.config.releaseTime * state.config.sampleRate));
    
    // Initialize look-ahead buffer
    const lookAheadSamples = Math.floor(state.config.lookAheadTime * state.config.sampleRate);
    state.lookAheadBuffer = new Float32Array(lookAheadSamples);
  };

  // Convert linear to dB
  const linearToDb = (linear) => 20 * Math.log10(Math.max(linear, 1e-10));

  // Convert dB to linear
  const dbToLinear = (db) => Math.pow(10, db / 20);

  // Process audio frame with AGC
  const processFrame = (audioBuffer) => {
    if (!state.lookAheadBuffer) {
      initialize();
    }
    
    const output = new Float32Array(audioBuffer.length);
    const lookAheadSize = state.lookAheadBuffer.length;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      // Store current sample in look-ahead buffer
      state.lookAheadBuffer[state.lookAheadIndex] = audioBuffer[i];
      
      // Get delayed sample for processing
      const delayedIndex = (state.lookAheadIndex + 1) % lookAheadSize;
      const delayedSample = state.lookAheadBuffer[delayedIndex];
      
      // Calculate envelope of current sample
      const inputLevel = Math.abs(audioBuffer[i]);
      
      // Envelope follower
      if (inputLevel > state.envelope) {
        state.envelope = state.attackCoeff * state.envelope + (1 - state.attackCoeff) * inputLevel;
      } else {
        state.envelope = state.releaseCoeff * state.envelope + (1 - state.releaseCoeff) * inputLevel;
      }
      
      // Calculate required gain
      const inputLevelDb = linearToDb(state.envelope);
      const gainNeededDb = state.config.targetLevel - inputLevelDb;
      
      // Limit gain
      const limitedGainDb = Math.max(state.config.minGain, 
                                   Math.min(state.config.maxGain, gainNeededDb));
      
      // Smooth gain changes
      const targetGain = dbToLinear(limitedGainDb);
      const gainDiff = targetGain - state.currentGain;
      state.currentGain += gainDiff * 0.01; // Smooth gain adjustment
      
      // Apply gain to delayed sample
      output[i] = delayedSample * state.currentGain;
      
      // Update buffer index
      state.lookAheadIndex = (state.lookAheadIndex + 1) % lookAheadSize;
    }
    
    // Update statistics
    state.stats.totalFrames++;
    const avgInputLevel = audioBuffer.reduce((sum, s) => sum + Math.abs(s), 0) / audioBuffer.length;
    const inputLevelDb = linearToDb(avgInputLevel);
    
    state.stats.peakLevel = Math.max(state.stats.peakLevel, inputLevelDb);
    state.stats.averageLevel = (state.stats.averageLevel * (state.stats.totalFrames - 1) + inputLevelDb) / state.stats.totalFrames;
    state.stats.averageGain = (state.stats.averageGain * (state.stats.totalFrames - 1) + linearToDb(state.currentGain)) / state.stats.totalFrames;
    
    if (Math.abs(linearToDb(state.currentGain)) > 1) {
      state.stats.gainAdjustments++;
    }
    
    return output;
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      initialize(); // Reinitialize with new config
    },
    reset: () => {
      state.currentGain = 1.0;
      state.envelope = 0.0;
      if (state.lookAheadBuffer) {
        state.lookAheadBuffer.fill(0);
      }
      state.lookAheadIndex = 0;
    }
  };
};

// High-pass filter for DC removal and low-frequency noise
export const createHighPassFilter = (config = {}) => {
  const state = {
    config: {
      cutoffFrequency: config.cutoffFrequency || 80, // Hz
      sampleRate: config.sampleRate || 44100,
      order: config.order || 2 // Filter order
    },
    
    // Filter history (for biquad implementation)
    x1: 0, x2: 0, // Input history
    y1: 0, y2: 0, // Output history
    
    // Biquad coefficients
    b0: 0, b1: 0, b2: 0,
    a1: 0, a2: 0,
    
    stats: {
      totalSamples: 0,
      dcOffset: 0
    }
  };

  // Calculate biquad coefficients for high-pass filter
  const calculateCoefficients = () => {
    const nyquist = state.config.sampleRate / 2;
    const normalizedFreq = state.config.cutoffFrequency / nyquist;
    const omega = 2 * Math.PI * normalizedFreq;
    
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const alpha = sin / (2 * 0.707); // Q = 0.707 for Butterworth response
    
    // High-pass biquad coefficients
    const b0 = (1 + cos) / 2;
    const b1 = -(1 + cos);
    const b2 = (1 + cos) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    
    // Normalize coefficients
    state.b0 = b0 / a0;
    state.b1 = b1 / a0;
    state.b2 = b2 / a0;
    state.a1 = a1 / a0;
    state.a2 = a2 / a0;
  };

  // Process audio buffer
  const processFrame = (audioBuffer) => {
    if (state.b0 === 0) {
      calculateCoefficients();
    }
    
    const output = new Float32Array(audioBuffer.length);
    let dcSum = 0;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const x0 = audioBuffer[i];
      dcSum += x0;
      
      // Biquad filter equation
      const y0 = state.b0 * x0 + state.b1 * state.x1 + state.b2 * state.x2 - 
                 state.a1 * state.y1 - state.a2 * state.y2;
      
      // Update history
      state.x2 = state.x1;
      state.x1 = x0;
      state.y2 = state.y1;
      state.y1 = y0;
      
      output[i] = y0;
    }
    
    // Update statistics
    state.stats.totalSamples += audioBuffer.length;
    const avgDC = dcSum / audioBuffer.length;
    state.stats.dcOffset = (state.stats.dcOffset * 0.99 + avgDC * 0.01);
    
    return output;
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      calculateCoefficients();
    },
    reset: () => {
      state.x1 = state.x2 = 0;
      state.y1 = state.y2 = 0;
    }
  };
};

// Comprehensive audio preprocessing pipeline
export const createAudioPreprocessingPipeline = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100,
      enableNoiseReduction: config.enableNoiseReduction !== false,
      enableAGC: config.enableAGC !== false,
      enableHighPassFilter: config.enableHighPassFilter !== false,
      processingOrder: config.processingOrder || ['highpass', 'agc', 'denoise'],
      ...config
    },
    
    // Processing modules
    noiseReduction: null,
    agc: null,
    highPassFilter: null,
    
    // Processing state
    isInitialized: false,
    
    // Statistics
    stats: {
      totalFrames: 0,
      processingTime: 0,
      averageProcessingTime: 0,
      qualityImprovement: 0
    }
  };

  // Initialize processing modules
  const initialize = () => {
    if (state.config.enableNoiseReduction) {
      state.noiseReduction = createNoiseReduction(state.config.noiseReduction);
    }
    
    if (state.config.enableAGC) {
      state.agc = createAutomaticGainControl(state.config.agc);
    }
    
    if (state.config.enableHighPassFilter) {
      state.highPassFilter = createHighPassFilter(state.config.highpass);
    }
    
    state.isInitialized = true;
  };

  // Register result type
  memoryPool.registerFactory('PreprocessingResult', () => ({
    _pooled: true,
    processedAudio: null,
    processingTime: 0,
    modulesApplied: [],
    qualityMetrics: {
      signalLevel: 0,
      noiseLevel: 0,
      dcOffset: 0
    },
    timestamp: 0
  }));

  // Process audio frame through pipeline
  const processFrame = (audioBuffer, isQuiet = false, timestamp = Date.now()) => {
    if (!state.isInitialized) {
      initialize();
    }
    
    const startTime = performance.now();
    let processedAudio = new Float32Array(audioBuffer);
    const modulesApplied = [];
    
    // Process according to configured order
    for (const module of state.config.processingOrder) {
      switch (module) {
        case 'highpass':
          if (state.highPassFilter) {
            processedAudio = state.highPassFilter.processFrame(processedAudio);
            modulesApplied.push('highpass');
          }
          break;
          
        case 'agc':
          if (state.agc) {
            processedAudio = state.agc.processFrame(processedAudio);
            modulesApplied.push('agc');
          }
          break;
          
        case 'denoise':
          if (state.noiseReduction) {
            processedAudio = state.noiseReduction.processFrame(processedAudio, isQuiet);
            modulesApplied.push('denoise');
          }
          break;
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    // Calculate quality metrics
    const signalLevel = processedAudio.reduce((sum, s) => sum + Math.abs(s), 0) / processedAudio.length;
    const originalLevel = audioBuffer.reduce((sum, s) => sum + Math.abs(s), 0) / audioBuffer.length;
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.processingTime += processingTime;
    state.stats.averageProcessingTime = state.stats.processingTime / state.stats.totalFrames;
    
    // Create result
    const result = memoryPool.acquire('PreprocessingResult');
    result.processedAudio = processedAudio;
    result.processingTime = processingTime;
    result.modulesApplied = modulesApplied;
    result.qualityMetrics = {
      signalLevel: 20 * Math.log10(signalLevel + 1e-10),
      noiseLevel: originalLevel > 0 ? 20 * Math.log10((originalLevel - signalLevel + 1e-10) / originalLevel) : -60,
      dcOffset: state.highPassFilter ? state.highPassFilter.getStats().dcOffset : 0
    };
    result.timestamp = timestamp;
    
    return result;
  };

  // Release result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    modules: {
      noiseReduction: state.noiseReduction ? state.noiseReduction.getStats() : null,
      agc: state.agc ? state.agc.getStats() : null,
      highPassFilter: state.highPassFilter ? state.highPassFilter.getStats() : null
    },
    memoryPool: memoryPool.getStats(),
    processingEfficiency: state.stats.totalFrames > 0 ? 
      (state.config.frameSize / state.config.sampleRate * 1000) / state.stats.averageProcessingTime : 0
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    // Update individual modules
    if (newConfig.noiseReduction && state.noiseReduction) {
      state.noiseReduction.updateConfig(newConfig.noiseReduction);
    }
    if (newConfig.agc && state.agc) {
      state.agc.updateConfig(newConfig.agc);
    }
    if (newConfig.highpass && state.highPassFilter) {
      state.highPassFilter.updateConfig(newConfig.highpass);
    }
  };

  // Reset all modules
  const reset = () => {
    if (state.noiseReduction) state.noiseReduction.reset();
    if (state.agc) state.agc.reset();
    if (state.highPassFilter) state.highPassFilter.reset();
    
    state.stats = {
      totalFrames: 0,
      processingTime: 0,
      averageProcessingTime: 0,
      qualityImprovement: 0
    };
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processFrame,
    releaseResult,
    getStats,
    updateConfig,
    reset,
    cleanup,
    isInitialized: () => state.isInitialized
  };
};