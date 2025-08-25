/**
 * Audio Quality Metrics Module
 * Advanced audio quality assessment and scoring
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

// Signal-to-Noise Ratio (SNR) calculator with frequency weighting
export const createSNRCalculator = (config = {}) => {
  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100,
      noiseFloor: config.noiseFloor || -60, // dB
      frequencyWeighting: config.frequencyWeighting || 'A', // 'A', 'C', or 'none'
      smoothingFactor: config.smoothingFactor || 0.9
    },
    
    // Adaptive noise estimation
    noiseProfile: null,
    signalProfile: null,
    adaptiveNoiseLevel: null,
    
    // Statistics
    stats: {
      totalFrames: 0,
      averageSNR: 0,
      peakSNR: -Infinity,
      minSNR: Infinity,
      noiseFloorEstimate: 0
    }
  };

  // A-weighting filter coefficients (simplified approximation)
  const getAWeightingGain = (frequency) => {
    const f2 = frequency * frequency;
    const f4 = f2 * f2;
    
    const numerator = 12194 * 12194 * f4;
    const denominator = (f2 + 20.6 * 20.6) * 
                       Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * 
                       (f2 + 12194 * 12194);
    
    const linearGain = numerator / denominator;
    return 20 * Math.log10(linearGain) + 2.0; // +2.0 dB normalization
  };

  // C-weighting filter (simplified)
  const getCWeightingGain = (frequency) => {
    const f2 = frequency * frequency;
    const numerator = 12194 * 12194 * f2;
    const denominator = (f2 + 20.6 * 20.6) * (f2 + 12194 * 12194);
    
    const linearGain = numerator / denominator;
    return 20 * Math.log10(linearGain);
  };

  // Apply frequency weighting to FFT magnitudes
  const applyFrequencyWeighting = (fftMagnitudes, sampleRate) => {
    if (state.config.frequencyWeighting === 'none') {
      return fftMagnitudes;
    }
    
    const weighted = new Float32Array(fftMagnitudes.length);
    const binWidth = sampleRate / (fftMagnitudes.length * 2);
    
    for (let i = 0; i < fftMagnitudes.length; i++) {
      const frequency = i * binWidth;
      let gain = 0;
      
      if (state.config.frequencyWeighting === 'A') {
        gain = getAWeightingGain(frequency);
      } else if (state.config.frequencyWeighting === 'C') {
        gain = getCWeightingGain(frequency);
      }
      
      // Convert dB gain to linear multiplier
      const linearGain = Math.pow(10, gain / 20);
      weighted[i] = fftMagnitudes[i] * linearGain;
    }
    
    return weighted;
  };

  // Estimate noise floor from quiet segments
  const updateNoiseProfile = (fftMagnitudes, isQuiet) => {
    if (isQuiet) {
      if (state.noiseProfile === null) {
        state.noiseProfile = new Float32Array(fftMagnitudes);
      } else {
        // Exponential moving average
        for (let i = 0; i < fftMagnitudes.length; i++) {
          state.noiseProfile[i] = state.config.smoothingFactor * state.noiseProfile[i] + 
                                 (1 - state.config.smoothingFactor) * fftMagnitudes[i];
        }
      }
    }
  };

  // Calculate SNR from audio frame
  const calculateSNR = (audioBuffer, fftMagnitudes = null, isQuiet = false) => {
    let signalPower = 0;
    let noisePower = 0;
    
    if (fftMagnitudes) {
      // Frequency domain calculation (more accurate)
      const weighted = applyFrequencyWeighting(fftMagnitudes, state.config.sampleRate);
      
      // Update noise profile during quiet segments
      updateNoiseProfile(weighted, isQuiet);
      
      // Calculate signal and noise power
      for (let i = 0; i < weighted.length; i++) {
        const signalMag = weighted[i];
        const noiseMag = state.noiseProfile ? state.noiseProfile[i] : 0;
        
        signalPower += signalMag * signalMag;
        noisePower += noiseMag * noiseMag;
      }
    } else {
      // Time domain calculation (fallback)
      for (let i = 0; i < audioBuffer.length; i++) {
        signalPower += audioBuffer[i] * audioBuffer[i];
      }
      
      // Estimate noise power from signal during quiet segments
      if (isQuiet) {
        if (state.adaptiveNoiseLevel === null) {
          state.adaptiveNoiseLevel = signalPower;
        } else {
          state.adaptiveNoiseLevel = state.config.smoothingFactor * state.adaptiveNoiseLevel + 
                                    (1 - state.config.smoothingFactor) * signalPower;
        }
      }
      
      noisePower = state.adaptiveNoiseLevel || Math.pow(10, state.config.noiseFloor / 10);
    }
    
    // Calculate SNR in dB
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 60; // Max SNR when no noise
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.averageSNR = (state.stats.averageSNR * (state.stats.totalFrames - 1) + snr) / state.stats.totalFrames;
    state.stats.peakSNR = Math.max(state.stats.peakSNR, snr);
    state.stats.minSNR = Math.min(state.stats.minSNR, snr);
    state.stats.noiseFloorEstimate = noisePower > 0 ? 10 * Math.log10(noisePower) : state.config.noiseFloor;
    
    return {
      snr,
      signalPower: 10 * Math.log10(signalPower),
      noisePower: 10 * Math.log10(noisePower),
      quality: Math.max(0, Math.min(100, (snr + 10) * 2)) // 0-100 scale
    };
  };

  return {
    calculateSNR,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig),
    reset: () => {
      state.noiseProfile = null;
      state.adaptiveNoiseLevel = null;
      state.stats = {
        totalFrames: 0,
        averageSNR: 0,
        peakSNR: -Infinity,
        minSNR: Infinity,
        noiseFloorEstimate: 0
      };
    }
  };
};

// Total Harmonic Distortion (THD) calculator
export const createTHDCalculator = (config = {}) => {
  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100,
      fundamentalRange: config.fundamentalRange || [80, 800], // Hz
      maxHarmonics: config.maxHarmonics || 10
    },
    
    stats: {
      totalFrames: 0,
      averageTHD: 0,
      peakTHD: 0
    }
  };

  // Find fundamental frequency and harmonics
  const findFundamentalAndHarmonics = (fftMagnitudes, sampleRate) => {
    const binWidth = sampleRate / (fftMagnitudes.length * 2);
    const minBin = Math.floor(state.config.fundamentalRange[0] / binWidth);
    const maxBin = Math.floor(state.config.fundamentalRange[1] / binWidth);
    
    // Find peak in fundamental range
    let peakBin = minBin;
    let peakMagnitude = fftMagnitudes[minBin];
    
    for (let i = minBin; i <= maxBin && i < fftMagnitudes.length; i++) {
      if (fftMagnitudes[i] > peakMagnitude) {
        peakMagnitude = fftMagnitudes[i];
        peakBin = i;
      }
    }
    
    const fundamentalFreq = peakBin * binWidth;
    const fundamentalMag = peakMagnitude;
    
    // Find harmonics
    const harmonics = [];
    for (let h = 2; h <= state.config.maxHarmonics; h++) {
      const harmonicFreq = fundamentalFreq * h;
      const harmonicBin = Math.round(harmonicFreq / binWidth);
      
      if (harmonicBin < fftMagnitudes.length) {
        harmonics.push({
          frequency: harmonicFreq,
          magnitude: fftMagnitudes[harmonicBin],
          order: h
        });
      }
    }
    
    return {
      fundamental: {
        frequency: fundamentalFreq,
        magnitude: fundamentalMag
      },
      harmonics
    };
  };

  // Calculate THD
  const calculateTHD = (fftMagnitudes) => {
    const analysis = findFundamentalAndHarmonics(fftMagnitudes, state.config.sampleRate);
    
    if (analysis.fundamental.magnitude === 0 || analysis.harmonics.length === 0) {
      return {
        thd: 0,
        thdPercent: 0,
        fundamental: analysis.fundamental,
        harmonics: analysis.harmonics,
        quality: 100
      };
    }
    
    // Calculate THD as ratio of harmonic power to fundamental power
    let harmonicPowerSum = 0;
    for (const harmonic of analysis.harmonics) {
      harmonicPowerSum += harmonic.magnitude * harmonic.magnitude;
    }
    
    const fundamentalPower = analysis.fundamental.magnitude * analysis.fundamental.magnitude;
    const thd = Math.sqrt(harmonicPowerSum / fundamentalPower);
    const thdPercent = thd * 100;
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.averageTHD = (state.stats.averageTHD * (state.stats.totalFrames - 1) + thdPercent) / state.stats.totalFrames;
    state.stats.peakTHD = Math.max(state.stats.peakTHD, thdPercent);
    
    // Quality score (lower THD = higher quality)
    const quality = Math.max(0, 100 - thdPercent * 10);
    
    return {
      thd,
      thdPercent,
      fundamental: analysis.fundamental,
      harmonics: analysis.harmonics,
      quality
    };
  };

  return {
    calculateTHD,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig)
  };
};

// Audio clipping detector
export const createClippingDetector = (config = {}) => {
  const state = {
    config: {
      clippingThreshold: config.clippingThreshold || 0.98, // Fraction of full scale
      consecutiveThreshold: config.consecutiveThreshold || 5, // Consecutive samples
      frameSize: config.frameSize || 1024
    },
    
    stats: {
      totalFrames: 0,
      clippedFrames: 0,
      clippingRatio: 0,
      maxClippingDuration: 0,
      totalClippingSamples: 0
    }
  };

  // Detect clipping in audio buffer
  const detectClipping = (audioBuffer) => {
    let clippingSamples = 0;
    let consecutiveClips = 0;
    let maxConsecutiveClips = 0;
    let isFrameClipped = false;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      const sample = Math.abs(audioBuffer[i]);
      
      if (sample >= state.config.clippingThreshold) {
        consecutiveClips++;
        clippingSamples++;
        
        if (consecutiveClips >= state.config.consecutiveThreshold) {
          isFrameClipped = true;
        }
      } else {
        maxConsecutiveClips = Math.max(maxConsecutiveClips, consecutiveClips);
        consecutiveClips = 0;
      }
    }
    
    maxConsecutiveClips = Math.max(maxConsecutiveClips, consecutiveClips);
    
    // Update statistics
    state.stats.totalFrames++;
    if (isFrameClipped) {
      state.stats.clippedFrames++;
    }
    state.stats.clippingRatio = state.stats.clippedFrames / state.stats.totalFrames;
    state.stats.maxClippingDuration = Math.max(state.stats.maxClippingDuration, maxConsecutiveClips);
    state.stats.totalClippingSamples += clippingSamples;
    
    // Quality score
    const clippingPercentage = (clippingSamples / audioBuffer.length) * 100;
    const quality = Math.max(0, 100 - clippingPercentage * 20);
    
    return {
      isClipped: isFrameClipped,
      clippingSamples,
      clippingPercentage,
      maxConsecutiveClips,
      quality
    };
  };

  return {
    detectClipping,
    getStats: () => ({ ...state.stats }),
    updateConfig: (newConfig) => Object.assign(state.config, newConfig)
  };
};

// Comprehensive audio quality analyzer
export const createAudioQualityAnalyzer = (config = {}) => {
  const memoryPool = createEnhancedMemoryPool({
    maxPoolSize: config.maxPoolSize || 100,
    enableMetrics: true
  });
  memoryPool.initialize();

  const state = {
    config: {
      frameSize: config.frameSize || 1024,
      sampleRate: config.sampleRate || 44100,
      qualityThresholds: {
        excellent: config.excellentThreshold || 85,
        good: config.goodThreshold || 70,
        fair: config.fairThreshold || 50,
        poor: config.poorThreshold || 30
      },
      ...config
    },
    
    // Individual analyzers
    snrCalculator: createSNRCalculator(config.snr),
    thdCalculator: createTHDCalculator(config.thd),
    clippingDetector: createClippingDetector(config.clipping),
    
    // Overall statistics
    stats: {
      totalFrames: 0,
      overallQuality: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      },
      qualityTrend: []
    }
  };

  // Register quality result type
  memoryPool.registerFactory('QualityResult', () => ({
    _pooled: true,
    timestamp: 0,
    overallQuality: 0,
    qualityLevel: 'unknown',
    snr: null,
    thd: null,
    clipping: null,
    metrics: {
      signalStrength: 0,
      noiseLeve: 0,
      distortion: 0,
      clarity: 0
    },
    recommendations: []
  }));

  // Analyze audio quality comprehensively
  const analyzeQuality = (audioBuffer, fftMagnitudes = null, isQuiet = false, timestamp = Date.now()) => {
    // Run individual analyses
    const snrResult = state.snrCalculator.calculateSNR(audioBuffer, fftMagnitudes, isQuiet);
    let thdResult = { thd: 0, quality: 100 };
    if (fftMagnitudes) {
      thdResult = state.thdCalculator.calculateTHD(fftMagnitudes);
    }
    const clippingResult = state.clippingDetector.detectClipping(audioBuffer);
    
    // Calculate weighted overall quality
    const snrWeight = 0.4;
    const thdWeight = 0.3;
    const clippingWeight = 0.3;
    
    const overallQuality = 
      (snrResult.quality * snrWeight) +
      (thdResult.quality * thdWeight) +
      (clippingResult.quality * clippingWeight);
    
    // Determine quality level
    let qualityLevel;
    if (overallQuality >= state.config.qualityThresholds.excellent) {
      qualityLevel = 'excellent';
    } else if (overallQuality >= state.config.qualityThresholds.good) {
      qualityLevel = 'good';
    } else if (overallQuality >= state.config.qualityThresholds.fair) {
      qualityLevel = 'fair';
    } else {
      qualityLevel = 'poor';
    }
    
    // Generate recommendations
    const recommendations = [];
    if (snrResult.snr < 10) {
      recommendations.push('Reduce background noise or increase microphone gain');
    }
    if (thdResult.thdPercent > 10) {
      recommendations.push('Check for audio hardware distortion or overdriving');
    }
    if (clippingResult.isClipped) {
      recommendations.push('Reduce input level to prevent audio clipping');
    }
    if (snrResult.snr > 40) {
      recommendations.push('Excellent audio quality - no changes needed');
    }
    
    // Update statistics
    state.stats.totalFrames++;
    state.stats.overallQuality = (state.stats.overallQuality * (state.stats.totalFrames - 1) + overallQuality) / state.stats.totalFrames;
    state.stats.qualityDistribution[qualityLevel]++;
    
    // Maintain quality trend (last 100 measurements)
    state.stats.qualityTrend.push(overallQuality);
    if (state.stats.qualityTrend.length > 100) {
      state.stats.qualityTrend.shift();
    }
    
    // Create pooled result
    const result = memoryPool.acquire('QualityResult');
    Object.assign(result, {
      timestamp,
      overallQuality,
      qualityLevel,
      snr: snrResult,
      thd: thdResult,
      clipping: clippingResult,
      metrics: {
        signalStrength: Math.max(0, Math.min(100, snrResult.signalPower + 60)), // Normalize to 0-100
        noiseLevel: Math.max(0, Math.min(100, 100 - snrResult.snr)), // Lower SNR = higher noise
        distortion: thdResult.thdPercent,
        clarity: Math.max(0, 100 - clippingResult.clippingPercentage)
      },
      recommendations: [...recommendations]
    });
    
    return result;
  };

  // Release quality result
  const releaseResult = (result) => {
    memoryPool.release(result);
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    qualityDistributionPercentages: {
      excellent: (state.stats.qualityDistribution.excellent / state.stats.totalFrames) * 100,
      good: (state.stats.qualityDistribution.good / state.stats.totalFrames) * 100,
      fair: (state.stats.qualityDistribution.fair / state.stats.totalFrames) * 100,
      poor: (state.stats.qualityDistribution.poor / state.stats.totalFrames) * 100
    },
    qualityTrendAverage: state.stats.qualityTrend.length > 0 ? 
      state.stats.qualityTrend.reduce((sum, q) => sum + q, 0) / state.stats.qualityTrend.length : 0,
    individual: {
      snr: state.snrCalculator.getStats(),
      thd: state.thdCalculator.getStats(),
      clipping: state.clippingDetector.getStats()
    },
    memoryPool: memoryPool.getStats()
  });

  // Reset all analyzers
  const reset = () => {
    state.snrCalculator.reset();
    state.stats = {
      totalFrames: 0,
      overallQuality: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      },
      qualityTrend: []
    };
  };

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (newConfig.snr) {
      state.snrCalculator.updateConfig(newConfig.snr);
    }
    if (newConfig.thd) {
      state.thdCalculator.updateConfig(newConfig.thd);
    }
    if (newConfig.clipping) {
      state.clippingDetector.updateConfig(newConfig.clipping);
    }
  };

  // Cleanup
  const cleanup = () => {
    memoryPool.cleanup();
  };

  return {
    analyzeQuality,
    releaseResult,
    getStats,
    reset,
    updateConfig,
    cleanup
  };
};

// Real-time quality monitoring integration
export const createRealTimeQualityMonitor = (config = {}) => {
  const state = {
    analyzer: createAudioQualityAnalyzer(config.analyzer),
    isMonitoring: false,
    
    config: {
      updateInterval: config.updateInterval || 100, // ms
      alertThresholds: {
        quality: config.qualityAlertThreshold || 30,
        snr: config.snrAlertThreshold || 5
      }
    },
    
    callbacks: {
      onQualityUpdate: config.onQualityUpdate || (() => {}),
      onQualityAlert: config.onQualityAlert || (() => {}),
      onQualityImprovement: config.onQualityImprovement || (() => {})
    },
    
    lastQuality: null,
    alertState: false
  };

  // Process audio frame with monitoring
  const processFrame = (audioBuffer, fftMagnitudes = null, isQuiet = false) => {
    if (!state.isMonitoring) return null;
    
    const result = state.analyzer.analyzeQuality(audioBuffer, fftMagnitudes, isQuiet);
    
    // Check for quality alerts
    const isLowQuality = result.overallQuality < state.config.alertThresholds.quality ||
                        result.snr.snr < state.config.alertThresholds.snr;
    
    if (isLowQuality && !state.alertState) {
      state.alertState = true;
      state.callbacks.onQualityAlert(result);
    } else if (!isLowQuality && state.alertState) {
      state.alertState = false;
      state.callbacks.onQualityImprovement(result);
    }
    
    // Regular quality updates
    state.callbacks.onQualityUpdate(result);
    state.lastQuality = result.overallQuality;
    
    return result;
  };

  // Start monitoring
  const startMonitoring = () => {
    state.isMonitoring = true;
  };

  // Stop monitoring
  const stopMonitoring = () => {
    state.isMonitoring = false;
    state.alertState = false;
  };

  return {
    processFrame,
    startMonitoring,
    stopMonitoring,
    getStats: () => state.analyzer.getStats(),
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      if (newConfig.analyzer) {
        state.analyzer.updateConfig(newConfig.analyzer);
      }
    },
    cleanup: () => state.analyzer.cleanup(),
    isMonitoring: () => state.isMonitoring
  };
};