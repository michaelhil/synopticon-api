/**
 * Real-time Audio Analysis Pipeline
 * Advanced audio processing and feature extraction for speech analysis
 * Following functional programming patterns with factory functions
 */

// Import modular components
import { createAudioProcessingChain } from './processing-chain.js';
import { createFeatureExtractor } from './feature-extractor.js';
import { createAnalysisProcessor } from './analysis-processor.js';
import { createCallbackNotifier } from './callback-notifier.js';

// Create real-time audio analyzer factory
export const createRealtimeAudioAnalyzer = (config = {}) => {
  const state = {
    audioContext: null,
    analyser: null,
    microphone: null,
    scriptProcessor: null,
    
    // Analysis buffers
    buffers: {
      time: null,
      frequency: null,
      fftSize: config.fftSize || 2048,
      smoothing: config.smoothingTimeConstant || 0.8
    },
    
    // Feature extraction
    features: {
      pitch: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      mfcc: [],
      formants: []
    },
    
    // Configuration
    config: {
      sampleRate: config.sampleRate || 48000,
      fftSize: config.fftSize || 2048,
      smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
      minPitch: config.minPitch || 50, // Hz
      maxPitch: config.maxPitch || 400, // Hz
      frameSize: config.frameSize || 512,
      hopSize: config.hopSize || 256,
      enablePreprocessing: config.enablePreprocessing !== false,
      enableNoiseSuppression: config.enableNoiseSuppression !== false,
      ...config
    },
    
    // State tracking
    isInitialized: false,
    isAnalyzing: false,
    
    // Callbacks
    callbacks: {
      onFeatures: [],
      onPitch: [],
      onEnergy: [],
      onSpectrum: [],
      onError: []
    },
    
    // Performance metrics
    metrics: {
      framesProcessed: 0,
      lastProcessTime: 0,
      averageLatency: 0
    }
  };

  // Create modular components
  const callbackNotifier = createCallbackNotifier(state);
  const featureExtractor = createFeatureExtractor(state.config);
  const analysisProcessor = createAnalysisProcessor(state, featureExtractor, callbackNotifier);
  let processingChain = null;

  // Initialize audio context and analyzer
  const initialize = async () => {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.audioContext = new AudioContext({
        sampleRate: state.config.sampleRate,
        latencyHint: 'interactive'
      });
      
      // Create analyser node
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = state.config.fftSize;
      state.analyser.smoothingTimeConstant = state.config.smoothingTimeConstant;
      
      // Initialize buffers
      state.buffers.time = new Float32Array(state.analyser.fftSize);
      state.buffers.frequency = new Float32Array(state.analyser.frequencyBinCount);
      
      // Create processing chain
      processingChain = createAudioProcessingChain(state.audioContext, state.config);
      
      // Create preprocessing chain if enabled
      if (state.config.enablePreprocessing) {
        processingChain.createPreprocessingChain();
      }
      
      state.isInitialized = true;
      console.log('✅ Real-time audio analyzer initialized');
      console.log(`📊 Sample rate: ${state.audioContext.sampleRate}Hz`);
      console.log(`📊 FFT size: ${state.analyser.fftSize}`);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
      callbackNotifier.notifyError(error);
      throw error;
    }
  };

  // Start audio analysis
  const startAnalysis = async (stream) => {
    if (!state.isInitialized) {
      await initialize();
    }
    
    if (state.isAnalyzing) {
      console.warn('Already analyzing audio');
      return;
    }
    
    try {
      // Create microphone source
      state.microphone = state.audioContext.createMediaStreamSource(stream);
      
      // Create script processor for real-time processing
      state.scriptProcessor = state.audioContext.createScriptProcessor(
        state.config.frameSize,
        1, // mono input
        1  // mono output
      );
      
      // Setup audio processing callback
      state.scriptProcessor.onaudioprocess = analysisProcessor.processAudioFrame;
      
      // Connect audio graph
      if (state.config.enablePreprocessing) {
        processingChain.connectPreprocessingChain(state.microphone, state.analyser, state.scriptProcessor);
      } else {
        processingChain.connectSimpleChain(state.microphone, state.analyser, state.scriptProcessor);
      }
      
      state.scriptProcessor.connect(state.audioContext.destination);
      
      state.isAnalyzing = true;
      console.log('🎤 Started real-time audio analysis');
      
    } catch (error) {
      console.error('Failed to start audio analysis:', error);
      callbackNotifier.notifyError(error);
      throw error;
    }
  };

  // Stop audio analysis
  const stopAnalysis = () => {
    if (!state.isAnalyzing) return;
    
    try {
      if (state.scriptProcessor) {
        state.scriptProcessor.disconnect();
        state.scriptProcessor.onaudioprocess = null;
        state.scriptProcessor = null;
      }
      
      if (state.microphone) {
        state.microphone.disconnect();
        state.microphone = null;
      }
      
      // Cleanup processing chain
      if (processingChain) {
        processingChain.cleanup();
      }
      
      state.isAnalyzing = false;
      console.log('🛑 Stopped real-time audio analysis');
      
    } catch (error) {
      console.error('Error stopping audio analysis:', error);
      callbackNotifier.notifyError(error);
    }
  };

  // Data access methods
  const getFeatures = () => ({ ...state.features });
  
  const getSpectrum = () => new Float32Array(state.buffers.frequency);
  
  const getWaveform = () => new Float32Array(state.buffers.time);
  
  const getMetrics = () => analysisProcessor.getProcessingStats();

  // Configuration methods
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (state.analyser) {
      if (newConfig.fftSize) {
        state.analyser.fftSize = newConfig.fftSize;
        state.buffers.time = new Float32Array(state.analyser.fftSize);
        state.buffers.frequency = new Float32Array(state.analyser.frequencyBinCount);
      }
      
      if (newConfig.smoothingTimeConstant !== undefined) {
        state.analyser.smoothingTimeConstant = newConfig.smoothingTimeConstant;
      }
    }

    // Update processing chain parameters if needed
    if (processingChain && newConfig.gain !== undefined) {
      processingChain.updateParameters({ gain: newConfig.gain });
    }
  };

  // Cleanup
  const cleanup = () => {
    stopAnalysis();
    
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }
    
    if (processingChain) {
      processingChain.cleanup();
    }

    callbackNotifier.clearAllCallbacks();
    
    state.isInitialized = false;
    console.log('🧹 Audio analyzer cleaned up');
  };

  return {
    // Core functionality
    initialize,
    startAnalysis,
    stopAnalysis,
    cleanup,
    
    // Data access
    getFeatures,
    getSpectrum,
    getWaveform,
    getMetrics,
    
    // Configuration
    updateConfig,
    getConfig: () => ({ ...state.config }),
    
    // Status
    isInitialized: () => state.isInitialized,
    isAnalyzing: () => state.isAnalyzing,
    
    // Event handlers - delegated to callbackNotifier
    onFeatures: callbackNotifier.onFeatures,
    onPitch: callbackNotifier.onPitch,
    onEnergy: callbackNotifier.onEnergy,
    onSpectrum: callbackNotifier.onSpectrum,
    onError: callbackNotifier.onError
  };
};
