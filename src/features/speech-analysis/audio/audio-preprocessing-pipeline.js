/**
 * Audio Preprocessing Pipeline
 * Advanced audio preprocessing and enhancement
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';
import { createNoiseReductionConfig, createNoiseReductionState } from './noise-reduction-config.js';
import { createFFTProcessor } from './noise-reduction-fft.js';
import { createWindowProcessor } from './noise-reduction-window.js';
import { createSpectralProcessor } from './noise-reduction-spectral.js';
import { createAGCConfig, createAGCState } from './agc-config.ts';
import { createAGCProcessor } from './agc-processor.js';
import { createPreprocessingConfig, createPreprocessingState } from './preprocessing-config.js';
import { createModulesManager } from './preprocessing-modules.js';
import { createQualityCalculator } from './preprocessing-quality.js';

// Noise reduction using spectral subtraction
export const createNoiseReduction = (config = {}) => {
  const noiseConfig = createNoiseReductionConfig(config);
  const state = createNoiseReductionState(noiseConfig);
  
  // Create modular processors
  const fftProcessor = createFFTProcessor();
  const windowProcessor = createWindowProcessor(state);
  const spectralProcessor = createSpectralProcessor(state);

  // Apply spectral subtraction
  const processFrame = (audioBuffer, isQuiet = false) => {
    if (!state.window) {
      windowProcessor.initializeWindow();
    }
    
    // Apply window
    const windowed = windowProcessor.applyWindow(audioBuffer);
    
    // Forward FFT
    const fftResult = fftProcessor.fft(windowed);
    
    // Calculate magnitudes and phases
    const { magnitudes, phases } = fftProcessor.extractMagnitudesAndPhases(fftResult);
    
    // Update noise profile if in quiet segment
    if (isQuiet || state.adaptationFrames < state.targetAdaptationFrames) {
      spectralProcessor.updateNoiseProfile(magnitudes);
    }
    
    // Apply spectral subtraction
    const enhancedMagnitudes = spectralProcessor.applySpectralSubtraction(magnitudes);
    
    // Reconstruct complex spectrum
    const enhancedSpectrum = fftProcessor.reconstructSpectrum(enhancedMagnitudes, phases);
    
    // Inverse FFT
    const enhanced = fftProcessor.ifft(enhancedSpectrum);
    
    // Process overlap-add
    const output = windowProcessor.processOverlapAdd(enhanced);
    
    // Update statistics
    spectralProcessor.updateStats();
    
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
  const agcConfig = createAGCConfig(config);
  const state = createAGCState(agcConfig);
  const processor = createAGCProcessor(state);

  // Process audio frame with AGC
  const processFrame = (audioBuffer) => {
    if (!state.lookAheadBuffer) {
      processor.initialize();
    }
    
    const output = new Float32Array(audioBuffer.length);
    const lookAheadSize = state.lookAheadBuffer.length;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      output[i] = processor.processSample(audioBuffer[i], lookAheadSize);
    }
    
    // Update statistics
    processor.updateStats(audioBuffer);
    
    return output;
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      processor.initialize(); // Reinitialize with new config
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
  const preprocessingConfig = createPreprocessingConfig(config);
  const state = createPreprocessingState(preprocessingConfig);
  
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: state.config.maxPoolSize,
    enableMetrics: true
  });
  memoryPool.initialize();
  
  // Create modular components
  const modulesManager = createModulesManager(
    state, 
    createNoiseReduction, 
    createAutomaticGainControl, 
    createHighPassFilter
  );
  const qualityCalculator = createQualityCalculator(state);

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
      modulesManager.initialize();
    }
    
    const startTime = performance.now();
    
    // Process through modules
    const { processedAudio, modulesApplied } = modulesManager.processAudio(audioBuffer, isQuiet);
    
    const processingTime = performance.now() - startTime;
    
    // Calculate quality metrics and update statistics
    const qualityMetrics = qualityCalculator.calculateQualityMetrics(processedAudio, audioBuffer);
    qualityCalculator.updateStats(processingTime);
    
    // Create result
    const result = memoryPool.acquire('PreprocessingResult');
    result.processedAudio = processedAudio;
    result.processingTime = processingTime;
    result.modulesApplied = modulesApplied;
    result.qualityMetrics = qualityMetrics;
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
    modules: modulesManager.getModuleStats(),
    memoryPool: memoryPool.getStats(),
    processingEfficiency: qualityCalculator.getProcessingEfficiency()
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    modulesManager.updateConfig(newConfig);
  };

  // Reset all modules
  const reset = () => {
    modulesManager.reset();
    qualityCalculator.resetStats();
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
