/**
 * Audio Quality Analysis
 * Real-time audio quality monitoring and enhancement
 * Following functional programming patterns with factory functions
 */

import { detectRuntime, checkFeatures } from '../utils/runtime-detector.js';
import { createSpeechEvent } from '../core/types.js';

// Audio quality metrics factory
export const createAudioQualityMetrics = (config = {}) => ({
  signalToNoise: config.signalToNoise || 0,
  volumeLevel: config.volumeLevel || 0,
  backgroundNoise: config.backgroundNoise || 0,
  clarity: config.clarity || 0,
  distortion: config.distortion || 0,
  timestamp: config.timestamp || Date.now(),
  quality: config.quality || 'unknown' // 'excellent', 'good', 'fair', 'poor'
});

// Audio quality analyzer factory
export const createAudioQualityAnalyzer = (config = {}) => {
  const state = {
    runtime: detectRuntime(),
    features: checkFeatures(),
    audioContext: null,
    analyser: null,
    microphone: null,
    isInitialized: false,
    isAnalyzing: false,
    
    // Configuration
    config: {
      fftSize: config.fftSize || 2048,
      smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
      minDecibels: config.minDecibels || -90,
      maxDecibels: config.maxDecibels || -10,
      sampleRate: config.sampleRate || 44100,
      ...config
    },
    
    // Analysis buffers
    frequencyData: null,
    timeData: null,
    
    // Quality history for trend analysis
    qualityHistory: [],
    maxHistoryLength: config.maxHistoryLength || 100,
    
    // Thresholds for quality assessment
    thresholds: {
      excellent: { snr: 20, volume: 0.3, noise: 0.1 },
      good: { snr: 15, volume: 0.2, noise: 0.2 },
      fair: { snr: 10, volume: 0.1, noise: 0.3 },
      poor: { snr: 5, volume: 0.05, noise: 0.5 }
    },
    
    // Callbacks
    callbacks: {
      onQualityUpdate: [],
      onQualityChange: [],
      onError: []
    }
  };

  // Initialize audio quality analyzer
  const initialize = async () => {
    if (!state.runtime.isBrowser) {
      console.log('⚠️ Audio quality analysis requires browser environment');
      return false;
    }

    if (!state.features.webAudio) {
      console.log('⚠️ Web Audio API not supported');
      return false;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: state.config.sampleRate
        }
      });

      // Create audio context
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: state.config.sampleRate
      });

      // Create analyser node
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = state.config.fftSize;
      state.analyser.smoothingTimeConstant = state.config.smoothingTimeConstant;
      state.analyser.minDecibels = state.config.minDecibels;
      state.analyser.maxDecibels = state.config.maxDecibels;

      // Connect microphone to analyser
      state.microphone = state.audioContext.createMediaStreamSource(stream);
      state.microphone.connect(state.analyser);

      // Initialize data arrays
      state.frequencyData = new Uint8Array(state.analyser.frequencyBinCount);
      state.timeData = new Uint8Array(state.analyser.frequencyBinCount);

      state.isInitialized = true;
      console.log('✅ Audio quality analyzer initialized');
      
      return true;

    } catch (error) {
      console.error('❌ Audio quality analyzer initialization failed:', error);
      notifyError(new Error(`Audio quality initialization failed: ${error.message}`));
      return false;
    }
  };

  // Start quality analysis
  const startAnalysis = () => {
    if (!state.isInitialized) {
      throw new Error('Audio quality analyzer not initialized');
    }

    state.isAnalyzing = true;
    analyzeLoop();
    console.log('🎤 Audio quality analysis started');
  };

  // Stop quality analysis
  const stopAnalysis = () => {
    state.isAnalyzing = false;
    console.log('🔇 Audio quality analysis stopped');
  };

  // Main analysis loop
  const analyzeLoop = () => {
    if (!state.isAnalyzing) return;

    try {
      // Get frequency and time domain data
      state.analyser.getByteFrequencyData(state.frequencyData);
      state.analyser.getByteTimeDomainData(state.timeData);

      // Calculate quality metrics
      const metrics = calculateQualityMetrics();
      
      // Add to history
      state.qualityHistory.push(metrics);
      if (state.qualityHistory.length > state.maxHistoryLength) {
        state.qualityHistory.shift();
      }

      // Notify callbacks
      notifyCallbacks('onQualityUpdate', metrics);

      // Check for quality changes
      const previousQuality = state.qualityHistory.length > 1 
        ? state.qualityHistory[state.qualityHistory.length - 2].quality
        : null;
      
      if (previousQuality && previousQuality !== metrics.quality) {
        notifyCallbacks('onQualityChange', {
          from: previousQuality,
          to: metrics.quality,
          metrics
        });
      }

    } catch (error) {
      console.warn('Audio quality analysis error:', error);
      notifyError(error);
    }

    // Schedule next analysis
    requestAnimationFrame(analyzeLoop);
  };

  // Calculate comprehensive quality metrics
  const calculateQualityMetrics = () => {
    // Volume level (RMS)
    const volumeLevel = calculateRMS(state.timeData);
    
    // Signal-to-noise ratio estimation
    const snr = calculateSNR(state.frequencyData, state.timeData);
    
    // Background noise level
    const backgroundNoise = calculateBackgroundNoise(state.frequencyData);
    
    // Audio clarity (high frequency content)
    const clarity = calculateClarity(state.frequencyData);
    
    // Distortion estimation
    const distortion = calculateDistortion(state.timeData);
    
    // Overall quality assessment
    const quality = assessOverallQuality({
      snr,
      volumeLevel,
      backgroundNoise,
      clarity,
      distortion
    });

    return createAudioQualityMetrics({
      signalToNoise: Math.round(snr * 100) / 100,
      volumeLevel: Math.round(volumeLevel * 100) / 100,
      backgroundNoise: Math.round(backgroundNoise * 100) / 100,
      clarity: Math.round(clarity * 100) / 100,
      distortion: Math.round(distortion * 100) / 100,
      quality
    });
  };

  // Calculate RMS (Root Mean Square) for volume
  const calculateRMS = (timeData) => {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / timeData.length);
  };

  // Estimate signal-to-noise ratio
  const calculateSNR = (frequencyData, timeData) => {
    // Get signal level (average of frequency bins)
    const signalLevel = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    
    // Estimate noise floor (lowest 10% of frequency bins)
    const sortedFreqs = [...frequencyData].sort((a, b) => a - b);
    const noiseFloor = sortedFreqs.slice(0, Math.floor(sortedFreqs.length * 0.1))
      .reduce((sum, value) => sum + value, 0) / (sortedFreqs.length * 0.1);
    
    // Calculate SNR in dB
    const snr = 20 * Math.log10(signalLevel / (noiseFloor + 1e-10));
    return Math.max(0, snr); // Ensure non-negative
  };

  // Calculate background noise level
  const calculateBackgroundNoise = (frequencyData) => {
    // Focus on lower frequencies for background noise
    const lowFreqBins = frequencyData.slice(0, Math.floor(frequencyData.length * 0.3));
    const avgLowFreq = lowFreqBins.reduce((sum, value) => sum + value, 0) / lowFreqBins.length;
    return avgLowFreq / 255; // Normalize to 0-1
  };

  // Calculate audio clarity (high frequency content)
  const calculateClarity = (frequencyData) => {
    // Focus on higher frequencies for clarity
    const highFreqStart = Math.floor(frequencyData.length * 0.6);
    const highFreqBins = frequencyData.slice(highFreqStart);
    const avgHighFreq = highFreqBins.reduce((sum, value) => sum + value, 0) / highFreqBins.length;
    return avgHighFreq / 255; // Normalize to 0-1
  };

  // Estimate distortion
  const calculateDistortion = (timeData) => {
    // Look for clipping and non-linearities
    let clippingCount = 0;
    let totalVariation = 0;
    
    for (let i = 0; i < timeData.length; i++) {
      // Check for clipping
      if (timeData[i] === 0 || timeData[i] === 255) {
        clippingCount++;
      }
      
      // Calculate total variation
      if (i > 0) {
        totalVariation += Math.abs(timeData[i] - timeData[i - 1]);
      }
    }
    
    const clippingRatio = clippingCount / timeData.length;
    const avgVariation = totalVariation / (timeData.length - 1);
    
    // Combine metrics for distortion estimate
    return Math.min(1, clippingRatio * 2 + avgVariation / 255);
  };

  // Assess overall quality based on metrics
  const assessOverallQuality = (metrics) => {
    const { snr, volumeLevel, backgroundNoise, clarity } = metrics;
    
    // Check against thresholds
    const thresholds = state.thresholds;
    
    if (snr >= thresholds.excellent.snr && 
        volumeLevel >= thresholds.excellent.volume && 
        backgroundNoise <= thresholds.excellent.noise) {
      return 'excellent';
    } else if (snr >= thresholds.good.snr && 
               volumeLevel >= thresholds.good.volume && 
               backgroundNoise <= thresholds.good.noise) {
      return 'good';
    } else if (snr >= thresholds.fair.snr && 
               volumeLevel >= thresholds.fair.volume && 
               backgroundNoise <= thresholds.fair.noise) {
      return 'fair';
    } else {
      return 'poor';
    }
  };

  // Get quality statistics
  const getQualityStats = () => {
    if (state.qualityHistory.length === 0) {
      return null;
    }

    const recentHistory = state.qualityHistory.slice(-20); // Last 20 measurements
    
    return {
      current: state.qualityHistory[state.qualityHistory.length - 1],
      average: {
        signalToNoise: recentHistory.reduce((sum, m) => sum + m.signalToNoise, 0) / recentHistory.length,
        volumeLevel: recentHistory.reduce((sum, m) => sum + m.volumeLevel, 0) / recentHistory.length,
        backgroundNoise: recentHistory.reduce((sum, m) => sum + m.backgroundNoise, 0) / recentHistory.length,
        clarity: recentHistory.reduce((sum, m) => sum + m.clarity, 0) / recentHistory.length
      },
      trend: calculateQualityTrend(),
      recommendations: generateRecommendations()
    };
  };

  // Calculate quality trend
  const calculateQualityTrend = () => {
    if (state.qualityHistory.length < 10) {
      return 'insufficient_data';
    }

    const recent = state.qualityHistory.slice(-10);
    const older = state.qualityHistory.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvgSNR = recent.reduce((sum, m) => sum + m.signalToNoise, 0) / recent.length;
    const olderAvgSNR = older.reduce((sum, m) => sum + m.signalToNoise, 0) / older.length;

    const improvement = recentAvgSNR - olderAvgSNR;

    if (improvement > 2) return 'improving';
    if (improvement < -2) return 'degrading';
    return 'stable';
  };

  // Generate quality improvement recommendations
  const generateRecommendations = () => {
    const current = state.qualityHistory[state.qualityHistory.length - 1];
    if (!current) return [];

    const recommendations = [];

    if (current.volumeLevel < 0.1) {
      recommendations.push('Speak closer to the microphone or increase input volume');
    } else if (current.volumeLevel > 0.8) {
      recommendations.push('Reduce input volume to avoid distortion');
    }

    if (current.backgroundNoise > 0.3) {
      recommendations.push('Find a quieter environment or use noise cancellation');
    }

    if (current.signalToNoise < 10) {
      recommendations.push('Improve microphone quality or reduce background noise');
    }

    if (current.clarity < 0.2) {
      recommendations.push('Check microphone frequency response or speak more clearly');
    }

    return recommendations;
  };

  // Cleanup resources
  const cleanup = async () => {
    stopAnalysis();
    
    if (state.microphone) {
      state.microphone.disconnect();
      state.microphone = null;
    }
    
    if (state.audioContext) {
      await state.audioContext.close();
      state.audioContext = null;
    }
    
    state.isInitialized = false;
    console.log('🧹 Audio quality analyzer cleaned up');
  };

  // Event subscription methods
  const onQualityUpdate = (callback) => subscribeCallback('onQualityUpdate', callback);
  const onQualityChange = (callback) => subscribeCallback('onQualityChange', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  // Helper functions
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  const notifyCallbacks = (eventType, data) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(createSpeechEvent({
          type: eventType,
          data,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn(`Audio quality ${eventType} callback error:`, error);
      }
    });
  };

  const notifyError = (error) => {
    notifyCallbacks('onError', { error: error.message });
  };

  return {
    // Core functionality
    initialize,
    startAnalysis,
    stopAnalysis,
    cleanup,

    // Status
    isInitialized: () => state.isInitialized,
    isAnalyzing: () => state.isAnalyzing,

    // Quality metrics
    getQualityStats,
    getHistory: () => [...state.qualityHistory],
    getCurrentQuality: () => state.qualityHistory[state.qualityHistory.length - 1] || null,

    // Event handlers
    onQualityUpdate,
    onQualityChange,
    onError,

    // Configuration
    updateThresholds: (newThresholds) => {
      Object.assign(state.thresholds, newThresholds);
    },
    getThresholds: () => ({ ...state.thresholds })
  };
};

// Export quality metrics factory for external use
export { createAudioQualityMetrics };