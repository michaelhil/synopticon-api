/**
 * Voice Activity Detection (VAD) Module
 * Advanced speech detection using multiple algorithms
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

// Energy-based VAD using RMS and spectral energy
export const createEnergyBasedVAD = (config = {}) => {
  const state = {
    config: {
      // Energy thresholds
      energyThreshold: config.energyThreshold || 0.01,
      minSpeechDuration: config.minSpeechDuration || 100, // ms
      minSilenceDuration: config.minSilenceDuration || 200, // ms
      
      // Adaptive thresholds
      adaptiveThreshold: config.adaptiveThreshold || true,
      adaptationRate: config.adaptationRate || 0.95,
      
      // Frame parameters
      frameSize: config.frameSize || 1024,
      hopSize: config.hopSize || 512,
      sampleRate: config.sampleRate || 44100,
      
      // Frequency analysis
      speechFreqMin: config.speechFreqMin || 80, // Hz
      speechFreqMax: config.speechFreqMax || 8000, // Hz
    },
    
    // Adaptive state
    backgroundEnergyLevel: 0.001,
    dynamicThreshold: 0.01,
    energyBuffer: [],
    bufferSize: 50,
    
    // Speech state tracking
    currentState: 'silence', // 'silence' | 'speech' | 'transition'
    speechStartTime: null,
    silenceStartTime: null,
    consecutiveSpeechFrames: 0,
    consecutiveSilenceFrames: 0,
    
    // Statistics
    stats: {
      totalFrames: 0,
      speechFrames: 0,
      silenceFrames: 0,
      voiceActivityRatio: 0,
      averageEnergy: 0,
      backgroundNoise: 0
    }
  };

  // Calculate RMS energy of audio buffer
  const calculateRMSEnergy = (audioBuffer) => {
    let sumSquares = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      sumSquares += audioBuffer[i] * audioBuffer[i];
    }
    return Math.sqrt(sumSquares / audioBuffer.length);
  };

  // Calculate spectral energy in speech frequency range
  const calculateSpectralEnergy = (fftData, sampleRate) => {
    const binWidth = sampleRate / fftData.length;
    const minBin = Math.floor(state.config.speechFreqMin / binWidth);
    const maxBin = Math.floor(state.config.speechFreqMax / binWidth);
    
    let spectralEnergy = 0;
    for (let i = minBin; i <= maxBin && i < fftData.length; i++) {
      spectralEnergy += fftData[i] * fftData[i];
    }
    
    return Math.sqrt(spectralEnergy / (maxBin - minBin + 1));
  };

  // Update background energy level adaptively
  const updateBackgroundLevel = (energy) => {
    if (state.currentState === 'silence') {
      state.backgroundEnergyLevel = state.backgroundEnergyLevel * state.config.adaptationRate + 
                                   energy * (1 - state.config.adaptationRate);
    }
    
    // Update energy buffer for statistics
    state.energyBuffer.push(energy);
    if (state.energyBuffer.length > state.bufferSize) {
      state.energyBuffer.shift();
    }
    
    // Calculate dynamic threshold
    if (state.config.adaptiveThreshold) {
      const avgEnergy = state.energyBuffer.reduce((sum, e) => sum + e, 0) / state.energyBuffer.length;
      state.dynamicThreshold = Math.max(
        state.backgroundEnergyLevel * 3,
        avgEnergy * 1.5,
        state.config.energyThreshold
      );
    }
  };

  // Process audio frame and detect voice activity
  const processFrame = (audioBuffer, fftData = null, timestamp = Date.now()) => {
    const rmsEnergy = calculateRMSEnergy(audioBuffer);
    let spectralEnergy = 0;
    
    if (fftData) {
      spectralEnergy = calculateSpectralEnergy(fftData, state.config.sampleRate);
    }
    
    // Combined energy metric
    const combinedEnergy = rmsEnergy + (spectralEnergy * 0.3);
    
    // Update background level
    updateBackgroundLevel(combinedEnergy);
    
    // Determine voice activity
    const threshold = state.config.adaptiveThreshold ? state.dynamicThreshold : state.config.energyThreshold;
    const isVoiceActive = combinedEnergy > threshold;
    
    // State transition logic with hysteresis
    let newState = state.currentState;
    const frameDuration = (state.config.frameSize / state.config.sampleRate) * 1000; // ms
    
    if (isVoiceActive) {
      state.consecutiveSpeechFrames++;
      state.consecutiveSilenceFrames = 0;
      
      if (state.currentState === 'silence' && 
          state.consecutiveSpeechFrames * frameDuration >= state.config.minSpeechDuration) {
        newState = 'speech';
        state.speechStartTime = timestamp;
      }
    } else {
      state.consecutiveSilenceFrames++;
      state.consecutiveSpeechFrames = 0;
      
      if (state.currentState === 'speech' && 
          state.consecutiveSilenceFrames * frameDuration >= state.config.minSilenceDuration) {
        newState = 'silence';
        state.silenceStartTime = timestamp;
      }
    }
    
    state.currentState = newState;
    
    // Update statistics
    state.stats.totalFrames++;
    if (newState === 'speech') {
      state.stats.speechFrames++;
    } else {
      state.stats.silenceFrames++;
    }
    
    state.stats.voiceActivityRatio = state.stats.speechFrames / state.stats.totalFrames;
    state.stats.averageEnergy = state.energyBuffer.reduce((sum, e) => sum + e, 0) / state.energyBuffer.length;
    state.stats.backgroundNoise = state.backgroundEnergyLevel;
    
    return {
      isVoiceActive: newState === 'speech',
      energy: combinedEnergy,
      threshold,
      state: newState,
      timestamp,
      confidence: Math.min(combinedEnergy / threshold, 2.0) / 2.0
    };
  };

  // Reset VAD state
  const reset = () => {
    state.currentState = 'silence';
    state.speechStartTime = null;
    state.silenceStartTime = null;
    state.consecutiveSpeechFrames = 0;
    state.consecutiveSilenceFrames = 0;
    state.energyBuffer.length = 0;
    state.stats = {
      totalFrames: 0,
      speechFrames: 0,
      silenceFrames: 0,
      voiceActivityRatio: 0,
      averageEnergy: 0,
      backgroundNoise: 0
    };
  };

  // Get current statistics
  const getStats = () => ({ ...state.stats });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
  };

  return {
    processFrame,
    reset,
    getStats,
    updateConfig,
    getCurrentState: () => state.currentState,
    getThreshold: () => state.config.adaptiveThreshold ? state.dynamicThreshold : state.config.energyThreshold
  };
};

// Zero Crossing Rate (ZCR) based VAD
export const createZCRBasedVAD = (config = {}) => {
  const state = {
    config: {
      zcrThreshold: config.zcrThreshold || 0.1,
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100
    },
    stats: {
      totalFrames: 0,
      averageZCR: 0
    }
  };

  // Calculate zero crossing rate
  const calculateZCR = (audioBuffer) => {
    let crossings = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i-1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (audioBuffer.length - 1);
  };

  const processFrame = (audioBuffer, timestamp = Date.now()) => {
    const zcr = calculateZCR(audioBuffer);
    const isVoiceActive = zcr > state.config.zcrThreshold;
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.averageZCR = (state.stats.averageZCR * (state.stats.totalFrames - 1) + zcr) / state.stats.totalFrames;
    
    return {
      isVoiceActive,
      zcr,
      threshold: state.config.zcrThreshold,
      timestamp,
      confidence: Math.min(zcr / state.config.zcrThreshold, 2.0) / 2.0
    };
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig)
  };
};

// Spectral entropy based VAD
export const createSpectralEntropyVAD = (config = {}) => {
  const state = {
    config: {
      entropyThreshold: config.entropyThreshold || 0.7,
      frameSize: config.frameSize || 1024
    },
    stats: {
      totalFrames: 0,
      averageEntropy: 0
    }
  };

  // Calculate spectral entropy
  const calculateSpectralEntropy = (fftMagnitudes) => {
    // Normalize magnitudes to probabilities
    const totalEnergy = fftMagnitudes.reduce((sum, mag) => sum + mag, 0);
    if (totalEnergy === 0) return 0;
    
    let entropy = 0;
    for (let i = 0; i < fftMagnitudes.length; i++) {
      const probability = fftMagnitudes[i] / totalEnergy;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    // Normalize entropy
    return entropy / Math.log2(fftMagnitudes.length);
  };

  const processFrame = (fftMagnitudes, timestamp = Date.now()) => {
    const entropy = calculateSpectralEntropy(fftMagnitudes);
    const isVoiceActive = entropy > state.config.entropyThreshold;
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.averageEntropy = (state.stats.averageEntropy * (state.stats.totalFrames - 1) + entropy) / state.stats.totalFrames;
    
    return {
      isVoiceActive,
      entropy,
      threshold: state.config.entropyThreshold,
      timestamp,
      confidence: Math.min(entropy / state.config.entropyThreshold, 2.0) / 2.0
    };
  };

  return {
    processFrame,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig)
  };
};

// Combined multi-algorithm VAD
export const createAdvancedVAD = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      // Algorithm weights
      energyWeight: config.energyWeight || 0.5,
      zcrWeight: config.zcrWeight || 0.2,
      entropyWeight: config.entropyWeight || 0.3,
      
      // Consensus threshold
      consensusThreshold: config.consensusThreshold || 0.6,
      
      // Smoothing parameters
      smoothingWindow: config.smoothingWindow || 5,
      hangoverFrames: config.hangoverFrames || 3, // Extend speech detection
      
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100
    },
    
    // Individual VAD algorithms
    energyVAD: createEnergyBasedVAD(config.energy),
    zcrVAD: createZCRBasedVAD(config.zcr),
    entropyVAD: createSpectralEntropyVAD(config.entropy),
    
    // Decision smoothing
    decisionBuffer: [],
    hangoverCount: 0,
    
    // Statistics
    stats: {
      totalFrames: 0,
      speechFrames: 0,
      consensusDecisions: 0,
      algorithmAgreement: {
        all: 0,
        majority: 0,
        minority: 0
      }
    }
  };

  // Process frame with all algorithms
  const processFrame = (audioBuffer, fftData = null, timestamp = Date.now()) => {
    // Get decisions from individual algorithms
    const energyResult = state.energyVAD.processFrame(audioBuffer, fftData, timestamp);
    const zcrResult = state.zcrVAD.processFrame(audioBuffer, timestamp);
    
    let entropyResult = { isVoiceActive: false, confidence: 0 };
    if (fftData) {
      entropyResult = state.entropyVAD.processFrame(fftData, timestamp);
    }

    // Calculate weighted consensus
    const weightedScore = 
      (energyResult.confidence * state.config.energyWeight) +
      (zcrResult.confidence * state.config.zcrWeight) +
      (entropyResult.confidence * state.config.entropyWeight);

    let isVoiceActive = weightedScore > state.config.consensusThreshold;

    // Apply smoothing and hangover
    state.decisionBuffer.push(isVoiceActive);
    if (state.decisionBuffer.length > state.config.smoothingWindow) {
      state.decisionBuffer.shift();
    }

    // Smoothed decision
    const speechCount = state.decisionBuffer.filter(d => d).length;
    const smoothedDecision = speechCount > state.decisionBuffer.length / 2;

    // Apply hangover (extend speech detection)
    if (smoothedDecision) {
      state.hangoverCount = state.config.hangoverFrames;
      isVoiceActive = true;
    } else if (state.hangoverCount > 0) {
      state.hangoverCount--;
      isVoiceActive = true;
    } else {
      isVoiceActive = false;
    }

    // Update statistics
    state.stats.totalFrames++;
    if (isVoiceActive) {
      state.stats.speechFrames++;
    }

    // Algorithm agreement tracking
    const decisions = [energyResult.isVoiceActive, zcrResult.isVoiceActive, entropyResult.isVoiceActive];
    const activeCount = decisions.filter(d => d).length;
    
    if (activeCount === 3) {
      state.stats.algorithmAgreement.all++;
    } else if (activeCount >= 2) {
      state.stats.algorithmAgreement.majority++;
    } else {
      state.stats.algorithmAgreement.minority++;
    }

    if (smoothedDecision) {
      state.stats.consensusDecisions++;
    }

    // Create pooled result object
    const result = memoryPool.acquire('VADResult');
    Object.assign(result, {
      isVoiceActive,
      confidence: weightedScore,
      timestamp,
      smoothedDecision,
      algorithms: {
        energy: energyResult,
        zcr: zcrResult,
        entropy: entropyResult
      },
      consensus: {
        score: weightedScore,
        threshold: state.config.consensusThreshold,
        agreement: activeCount / 3
      }
    });

    return result;
  };

  // Register custom result type with memory pool
  memoryPool.registerFactory('VADResult', () => ({
    _pooled: true,
    isVoiceActive: false,
    confidence: 0,
    timestamp: 0,
    smoothedDecision: false,
    algorithms: null,
    consensus: null
  }));

  // Release VAD result back to pool
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Reset all VAD algorithms
  const reset = () => {
    state.energyVAD.reset();
    state.decisionBuffer.length = 0;
    state.hangoverCount = 0;
    state.stats = {
      totalFrames: 0,
      speechFrames: 0,
      consensusDecisions: 0,
      algorithmAgreement: {
        all: 0,
        majority: 0,
        minority: 0
      }
    };
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    voiceActivityRatio: state.stats.totalFrames > 0 ? state.stats.speechFrames / state.stats.totalFrames : 0,
    consensusRatio: state.stats.totalFrames > 0 ? state.stats.consensusDecisions / state.stats.totalFrames : 0,
    algorithmAgreementRatios: {
      all: state.stats.totalFrames > 0 ? state.stats.algorithmAgreement.all / state.stats.totalFrames : 0,
      majority: state.stats.totalFrames > 0 ? state.stats.algorithmAgreement.majority / state.stats.totalFrames : 0,
      minority: state.stats.totalFrames > 0 ? state.stats.algorithmAgreement.minority / state.stats.totalFrames : 0
    },
    individual: {
      energy: state.energyVAD.getStats(),
      zcr: state.zcrVAD.getStats(),
      entropy: state.entropyVAD.getStats()
    },
    memoryPool: memoryPool.getStats()
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.energy) {
      state.energyVAD.updateConfig(newConfig.energy);
    }
    if (newConfig.zcr) {
      state.zcrVAD.updateConfig(newConfig.zcr);
    }
    if (newConfig.entropy) {
      state.entropyVAD.updateConfig(newConfig.entropy);
    }
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    processFrame,
    releaseResult,
    reset,
    getStats,
    updateConfig,
    cleanup,
    getCurrentState: () => state.energyVAD.getCurrentState(),
    getThreshold: () => state.config.consensusThreshold
  };
};

// VAD integration with Web Audio API
export const createWebAudioVAD = (config = {}) => {
  const state = {
    audioContext: null,
    analyserNode: null,
    scriptProcessor: null,
    vad: createAdvancedVAD(config.vad),
    isActive: false,
    
    config: {
      fftSize: config.fftSize || 1024,
      smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
      minDecibels: config.minDecibels || -90,
      maxDecibels: config.maxDecibels || -10
    },
    
    callbacks: {
      onVoiceStart: config.onVoiceStart || (() => {}),
      onVoiceEnd: config.onVoiceEnd || (() => {}),
      onVoiceActivity: config.onVoiceActivity || (() => {})
    },
    
    lastState: 'silence'
  };

  // Initialize Web Audio API components
  const initialize = async (audioStream) => {
    try {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: config.sampleRate || 44100
      });

      // Create analyser node
      state.analyserNode = state.audioContext.createAnalyser();
      state.analyserNode.fftSize = state.config.fftSize;
      state.analyserNode.smoothingTimeConstant = state.config.smoothingTimeConstant;
      state.analyserNode.minDecibels = state.config.minDecibels;
      state.analyserNode.maxDecibels = state.config.maxDecibels;

      // Create script processor for real-time analysis
      state.scriptProcessor = state.audioContext.createScriptProcessor(
        state.config.fftSize, 1, 1
      );

      // Connect audio stream
      const source = state.audioContext.createMediaStreamSource(audioStream);
      source.connect(state.analyserNode);
      state.analyserNode.connect(state.scriptProcessor);
      state.scriptProcessor.connect(state.audioContext.destination);

      // Process audio frames
      state.scriptProcessor.onaudioprocess = (event) => {
        if (!state.isActive) return;

        const audioBuffer = event.inputBuffer.getChannelData(0);
        const fftData = new Float32Array(state.analyserNode.frequencyBinCount);
        state.analyserNode.getFloatFrequencyData(fftData);

        // Convert dB to linear magnitude
        const magnitudes = fftData.map(db => Math.pow(10, db / 20));

        const result = state.vad.processFrame(audioBuffer, magnitudes);
        
        // Trigger callbacks
        state.callbacks.onVoiceActivity(result);
        
        if (result.isVoiceActive && state.lastState !== 'speech') {
          state.callbacks.onVoiceStart(result);
          state.lastState = 'speech';
        } else if (!result.isVoiceActive && state.lastState !== 'silence') {
          state.callbacks.onVoiceEnd(result);
          state.lastState = 'silence';
        }

        // Release result back to pool
        state.vad.releaseResult(result);
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize Web Audio VAD:', error);
      return false;
    }
  };

  // Start voice activity detection
  const start = () => {
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
    state.isActive = true;
  };

  // Stop voice activity detection
  const stop = () => {
    state.isActive = false;
  };

  // Cleanup resources
  const cleanup = () => {
    stop();
    
    if (state.scriptProcessor) {
      state.scriptProcessor.disconnect();
      state.scriptProcessor = null;
    }
    
    if (state.analyserNode) {
      state.analyserNode.disconnect();
      state.analyserNode = null;
    }
    
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }
    
    state.vad.cleanup();
  };

  return {
    initialize,
    start,
    stop,
    cleanup,
    getStats: () => state.vad.getStats(),
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      if (newConfig.vad) {
        state.vad.updateConfig(newConfig.vad);
      }
    },
    isActive: () => state.isActive
  };
};