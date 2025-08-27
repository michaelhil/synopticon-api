/**
 * Temporal Smoothing Filter for Age and Gender Detection
 * Provides smoothing for video streams to reduce flickering
 */

import type { AgeResult, GenderResult } from './base-age-detector.ts';

export interface SmoothingFilterConfiguration {
  readonly smoothingFactor: number;
  readonly maxHistorySize: number;
  readonly adaptiveSmoothing: boolean;
  readonly confidenceWeighting: boolean;
}

export interface SmoothingState {
  initialized: boolean;
  previousAge: number | null;
  previousGenderProbs: { male: number; female: number } | null;
  ageHistory: number[];
  confidenceHistory: number[];
  lastUpdateTime: number;
}

export interface SmoothingResult {
  readonly ageResult: AgeResult;
  readonly genderResult: GenderResult;
  readonly smoothingApplied: boolean;
  readonly confidenceBoost: number;
}

/**
 * Creates a temporal smoothing filter for age and gender detection
 */
export const createSmoothingFilter = (config: Partial<SmoothingFilterConfiguration> = {}) => {
  const configuration: SmoothingFilterConfiguration = {
    smoothingFactor: config.smoothingFactor || 0.4,
    maxHistorySize: config.maxHistorySize || 10,
    adaptiveSmoothing: config.adaptiveSmoothing !== false,
    confidenceWeighting: config.confidenceWeighting !== false
  };

  const state: SmoothingState = {
    initialized: false,
    previousAge: null,
    previousGenderProbs: null,
    ageHistory: [],
    confidenceHistory: [],
    lastUpdateTime: 0
  };

  /**
   * Apply smoothing to age and gender results
   */
  const applySmoothingFilter = (ageResult: AgeResult, genderResult: GenderResult): SmoothingResult => {
    const currentTime = Date.now();
    
    if (!state.initialized) {
      // First frame - no smoothing needed
      state.initialized = true;
      state.previousAge = ageResult.estimatedAge;
      state.previousGenderProbs = { ...genderResult.probabilities };
      state.ageHistory = [ageResult.estimatedAge];
      state.confidenceHistory = [ageResult.confidence];
      state.lastUpdateTime = currentTime;
      
      return {
        ageResult,
        genderResult,
        smoothingApplied: false,
        confidenceBoost: 0
      };
    }

    // Calculate time-based smoothing factor
    const timeDelta = currentTime - state.lastUpdateTime;
    const adaptiveFactor = configuration.adaptiveSmoothing 
      ? calculateAdaptiveSmoothingFactor(ageResult, timeDelta)
      : configuration.smoothingFactor;

    // Apply age smoothing
    const smoothedAgeResult = smoothAge(ageResult, adaptiveFactor);
    
    // Apply gender smoothing
    const smoothedGenderResult = smoothGender(genderResult, adaptiveFactor);

    // Update history
    updateHistory(smoothedAgeResult.estimatedAge, smoothedAgeResult.confidence);
    
    // Calculate confidence boost from smoothing
    const confidenceBoost = calculateConfidenceBoost(smoothedAgeResult, ageResult);

    state.lastUpdateTime = currentTime;

    return {
      ageResult: smoothedAgeResult,
      genderResult: smoothedGenderResult,
      smoothingApplied: true,
      confidenceBoost
    };
  };

  /**
   * Calculate adaptive smoothing factor based on confidence and change rate
   */
  const calculateAdaptiveSmoothingFactor = (ageResult: AgeResult, timeDelta: number): number => {
    let adaptiveFactor = configuration.smoothingFactor;

    // Reduce smoothing for high confidence results
    if (ageResult.confidence > 0.8) {
      adaptiveFactor *= 0.7;
    } else if (ageResult.confidence < 0.3) {
      // Increase smoothing for low confidence results
      adaptiveFactor *= 1.3;
    }

    // Adjust based on time between frames
    if (timeDelta > 200) { // More than 200ms between frames
      adaptiveFactor *= 0.8; // Less smoothing for sparse updates
    }

    // Consider rate of change in recent history
    if (state.ageHistory.length >= 3) {
      const recentChanges = calculateRecentChangeRate();
      if (recentChanges > 5) { // Rapid changes
        adaptiveFactor *= 1.2; // More smoothing for unstable results
      }
    }

    return Math.max(0.1, Math.min(0.8, adaptiveFactor));
  };

  /**
   * Apply temporal smoothing to age result
   */
  const smoothAge = (ageResult: AgeResult, smoothingFactor: number): AgeResult => {
    if (!state.previousAge) {
      return ageResult;
    }

    // Calculate confidence-weighted smoothing if enabled
    let effectiveSmoothingFactor = smoothingFactor;
    if (configuration.confidenceWeighting) {
      // Higher confidence results get less smoothing
      effectiveSmoothingFactor *= (1 - ageResult.confidence * 0.3);
    }

    // Apply exponential moving average
    const smoothedAge = Math.round(
      effectiveSmoothingFactor * ageResult.estimatedAge + 
      (1 - effectiveSmoothingFactor) * state.previousAge
    );

    // Update state
    state.previousAge = smoothedAge;

    // Recalculate age range based on smoothed age and historical variance
    const ageVariance = calculateAgeVariance();
    const smoothedAgeRange = {
      min: Math.max(0, smoothedAge - Math.ceil(ageVariance + (1 - ageResult.confidence) * 5)),
      max: Math.min(100, smoothedAge + Math.ceil(ageVariance + (1 - ageResult.confidence) * 5))
    };

    return {
      ...ageResult,
      estimatedAge: smoothedAge,
      ageRange: smoothedAgeRange,
      confidence: Math.min(0.95, ageResult.confidence + 0.1) // Small boost from smoothing
    };
  };

  /**
   * Apply temporal smoothing to gender result
   */
  const smoothGender = (genderResult: GenderResult, smoothingFactor: number): GenderResult => {
    if (!state.previousGenderProbs) {
      return genderResult;
    }

    // Apply exponential moving average to probabilities
    const smoothedProbs = {
      male: smoothingFactor * genderResult.probabilities.male + 
            (1 - smoothingFactor) * state.previousGenderProbs.male,
      female: smoothingFactor * genderResult.probabilities.female + 
              (1 - smoothingFactor) * state.previousGenderProbs.female
    };

    // Normalize to ensure sum equals 1.0
    const sum = smoothedProbs.male + smoothedProbs.female;
    if (sum > 0) {
      smoothedProbs.male /= sum;
      smoothedProbs.female /= sum;
    }

    // Update state
    state.previousGenderProbs = { ...smoothedProbs };

    // Determine smoothed gender and confidence
    const smoothedGender = smoothedProbs.male > smoothedProbs.female ? 'male' : 'female';
    const smoothedConfidence = Math.max(smoothedProbs.male, smoothedProbs.female);

    return {
      ...genderResult,
      gender: smoothedGender,
      probabilities: smoothedProbs,
      confidence: Math.min(0.95, smoothedConfidence + 0.05) // Small boost from smoothing
    };
  };

  /**
   * Update smoothing history
   */
  const updateHistory = (age: number, confidence: number): void => {
    state.ageHistory.push(age);
    state.confidenceHistory.push(confidence);

    // Maintain history size limit
    if (state.ageHistory.length > configuration.maxHistorySize) {
      state.ageHistory.shift();
      state.confidenceHistory.shift();
    }
  };

  /**
   * Calculate recent rate of change in age estimates
   */
  const calculateRecentChangeRate = (): number => {
    if (state.ageHistory.length < 3) return 0;

    const recent = state.ageHistory.slice(-3);
    let totalChange = 0;

    for (let i = 1; i < recent.length; i++) {
      totalChange += Math.abs(recent[i] - recent[i - 1]);
    }

    return totalChange / (recent.length - 1);
  };

  /**
   * Calculate age variance from history
   */
  const calculateAgeVariance = (): number => {
    if (state.ageHistory.length < 2) return 5; // Default variance

    const mean = state.ageHistory.reduce((sum, age) => sum + age, 0) / state.ageHistory.length;
    const variance = state.ageHistory.reduce((sum, age) => sum + Math.pow(age - mean, 2), 0) / state.ageHistory.length;
    
    return Math.sqrt(variance);
  };

  /**
   * Calculate confidence boost from smoothing stability
   */
  const calculateConfidenceBoost = (smoothedResult: AgeResult, originalResult: AgeResult): number => {
    if (state.ageHistory.length < 3) return 0;

    // Calculate how much smoothing reduced the estimate change
    const originalChange = Math.abs(originalResult.estimatedAge - (state.previousAge || originalResult.estimatedAge));
    const smoothedChange = Math.abs(smoothedResult.estimatedAge - (state.previousAge || smoothedResult.estimatedAge));
    
    const stabilityImprovement = Math.max(0, originalChange - smoothedChange);
    return Math.min(0.2, stabilityImprovement / 10); // Max 0.2 confidence boost
  };

  /**
   * Reset smoothing filter state
   */
  const reset = (): void => {
    state.initialized = false;
    state.previousAge = null;
    state.previousGenderProbs = null;
    state.ageHistory = [];
    state.confidenceHistory = [];
    state.lastUpdateTime = 0;
  };

  /**
   * Get smoothing statistics
   */
  const getStatistics = () => ({
    initialized: state.initialized,
    historySize: state.ageHistory.length,
    averageAge: state.ageHistory.length > 0 
      ? state.ageHistory.reduce((sum, age) => sum + age, 0) / state.ageHistory.length 
      : 0,
    averageConfidence: state.confidenceHistory.length > 0
      ? state.confidenceHistory.reduce((sum, conf) => sum + conf, 0) / state.confidenceHistory.length
      : 0,
    ageVariance: calculateAgeVariance(),
    recentChangeRate: calculateRecentChangeRate(),
    configuration
  });

  /**
   * Update smoothing configuration
   */
  const updateConfiguration = (newConfig: Partial<SmoothingFilterConfiguration>): void => {
    Object.assign(configuration, newConfig);
  };

  return {
    applySmoothingFilter,
    reset,
    getStatistics,
    updateConfiguration,
    isInitialized: () => state.initialized
  };
};

export type SmoothingFilter = ReturnType<typeof createSmoothingFilter>;