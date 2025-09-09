/**
 * @fileoverview Fatigue Accumulation Model
 * 
 * Advanced fatigue modeling based on the Three-Process Model, tracking
 * homeostatic sleep pressure, work-related fatigue, and recovery dynamics
 * with cognitive and physical load integration.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  FatigueModel,
  FatigueConfig,
  FatigueState,
  FatigueMetrics
} from './types.js';

/**
 * Fatigue model parameters based on research literature
 */
const FATIGUE_PARAMETERS = {
  homeostaticDecayRate: 0.0001, // Per millisecond while awake
  workFatigueAccumulation: 0.00005, // Per millisecond of work
  cognitiveLoadMultiplier: 2.0, // Higher cognitive load increases fatigue faster
  physicalLoadMultiplier: 1.5, // Physical load contribution
  restRecoveryRate: 0.001, // Recovery per millisecond of rest
  microRecoveryRate: 0.0002, // Recovery per millisecond of micro-break
  fatigueThreshold: 0.7, // Critical fatigue level
  exhaustionThreshold: 0.9, // Near-exhaustion level
  optimalWorkContinuity: 45 * 60 * 1000, // 45 minutes optimal work period
  maxWorkContinuity: 120 * 60 * 1000, // 2 hours maximum work period
  minBreakEffectiveness: 5 * 60 * 1000, // 5 minutes minimum effective break
  optimalBreakDuration: 15 * 60 * 1000 // 15 minutes optimal break
} as const;

/**
 * Create advanced fatigue accumulation model
 */
export const createFatigueModel = (config: FatigueConfig = {}): FatigueModel => {
  const {
    maxWorkPeriod = 8 * 3600000, // 8 hours
    fatigueThreshold = FATIGUE_PARAMETERS.fatigueThreshold,
    recoveryRate = 0.1, // per hour base rate
    cognitiveLoadWeight = 0.3,
    physicalLoadWeight = 0.2,
    microrecoveryRate = 0.05 // per minute
  } = config;

  // Internal fatigue state
  const fatigueState: FatigueState = {
    homeostaticPressure: 0.0,
    workFatigue: 0.0,
    cognitiveLoad: 0.0,
    physicalLoad: 0.0,
    lastRestTime: Date.now(),
    continuousWorkTime: 0,
    totalWorkToday: 0,
    microRecoveryAccumulated: 0
  };

  let lastUpdateTime = Date.now();

  /**
   * Update workload and calculate fatigue progression
   */
  const updateWorkload = (
    cognitiveLoad: number,
    physicalLoad: number = 0,
    timestamp: number = Date.now()
  ): void => {
    const deltaTime = timestamp - lastUpdateTime;
    
    // Validate inputs
    cognitiveLoad = Math.max(0, Math.min(1, cognitiveLoad));
    physicalLoad = Math.max(0, Math.min(1, physicalLoad));
    
    // Update current load states
    fatigueState.cognitiveLoad = cognitiveLoad;
    fatigueState.physicalLoad = physicalLoad;
    
    // Calculate homeostatic pressure accumulation (always increasing while awake)
    fatigueState.homeostaticPressure += FATIGUE_PARAMETERS.homeostaticDecayRate * deltaTime;
    fatigueState.homeostaticPressure = Math.min(1, fatigueState.homeostaticPressure);
    
    // Calculate work fatigue based on load intensity
    const combinedLoad = 
      (cognitiveLoad * cognitiveLoadWeight * FATIGUE_PARAMETERS.cognitiveLoadMultiplier) +
      (physicalLoad * physicalLoadWeight * FATIGUE_PARAMETERS.physicalLoadMultiplier);
    
    const workFatigueIncrement = 
      FATIGUE_PARAMETERS.workFatigueAccumulation * combinedLoad * deltaTime;
    
    fatigueState.workFatigue += workFatigueIncrement;
    fatigueState.workFatigue = Math.min(1, fatigueState.workFatigue);
    
    // Update work time tracking
    if (cognitiveLoad > 0.1 || physicalLoad > 0.1) { // Active work threshold
      fatigueState.continuousWorkTime += deltaTime;
      fatigueState.totalWorkToday += deltaTime;
      
      // Reset micro-recovery if working
      fatigueState.microRecoveryAccumulated = 0;
    } else {
      // Micro-recovery during low activity
      fatigueState.microRecoveryAccumulated += deltaTime;
      
      // Apply micro-recovery benefits
      if (fatigueState.microRecoveryAccumulated >= 60000) { // 1 minute threshold
        const microRecovery = FATIGUE_PARAMETERS.microRecoveryRate * 
                             (fatigueState.microRecoveryAccumulated / 60000);
        fatigueState.workFatigue = Math.max(0, fatigueState.workFatigue - microRecovery);
      }
    }
    
    lastUpdateTime = timestamp;
  };

  /**
   * Add formal rest period and calculate recovery
   */
  const addRestPeriod = (duration: number, timestamp: number = Date.now()): void => {
    // Reset continuous work time
    fatigueState.continuousWorkTime = 0;
    fatigueState.lastRestTime = timestamp;
    
    // Calculate recovery amount based on rest duration and quality
    const restQuality = calculateRestQuality(duration);
    const baseRecovery = (duration / 3600000) * recoveryRate; // Convert to hours
    const qualityAdjustedRecovery = baseRecovery * restQuality;
    
    // Apply recovery to different fatigue components
    fatigueState.workFatigue = Math.max(0, 
      fatigueState.workFatigue - (qualityAdjustedRecovery * 0.8));
    
    // Homeostatic pressure only recovers during sleep (long rest periods)
    if (duration >= 4 * 3600000) { // 4+ hour rest considered sleep
      const sleepRecovery = Math.min(fatigueState.homeostaticPressure, 
        (duration / (8 * 3600000)) * 0.8); // Up to 80% recovery in 8 hours
      fatigueState.homeostaticPressure -= sleepRecovery;
    }
    
    // Reset micro-recovery accumulation
    fatigueState.microRecoveryAccumulated = 0;
  };

  /**
   * Get current comprehensive fatigue metrics
   */
  const getCurrentFatigue = (timestamp: number = Date.now()): FatigueMetrics => {
    // Update state to current time
    updateInternalState(timestamp);
    
    // Calculate component fatigues
    const cognitiveComponent = Math.min(1, 
      fatigueState.workFatigue * (1 + fatigueState.cognitiveLoad * 0.5));
    const physicalComponent = Math.min(1,
      fatigueState.workFatigue * (1 + fatigueState.physicalLoad * 0.3));
    
    // Overall fatigue combines homeostatic pressure and work fatigue
    const overall = Math.min(1, 
      (fatigueState.homeostaticPressure * 0.4) + 
      (fatigueState.workFatigue * 0.6));
    
    // Calculate time to exhaustion
    const currentRate = FATIGUE_PARAMETERS.workFatigueAccumulation * 
                       (fatigueState.cognitiveLoad + fatigueState.physicalLoad);
    const timeToExhaustion = currentRate > 0 ? 
      Math.max(0, (FATIGUE_PARAMETERS.exhaustionThreshold - overall) / currentRate) : 
      Infinity;
    
    // Calculate recovery needed
    const recoveryNeeded = calculateRecoveryNeeded(overall);
    
    // Current performance capacity
    const currentCapacity = Math.max(0.2, 1 - overall);
    
    return {
      overall,
      cognitive: cognitiveComponent,
      physical: physicalComponent,
      timeToExhaustion: isFinite(timeToExhaustion) ? timeToExhaustion : 24 * 3600000,
      recoveryNeeded,
      currentCapacity
    };
  };

  /**
   * Predict fatigue progression over time
   */
  const predictFatigueProgression = (hoursAhead: number): Array<{
    timestamp: number;
    predictedFatigue: number;
    confidence: number;
  }> => {
    const predictions: Array<{
      timestamp: number;
      predictedFatigue: number;
      confidence: number;
    }> = [];
    
    const currentTime = Date.now();
    const intervalHours = 0.5; // 30-minute intervals
    
    // Create a simulation state
    const simState = { ...fatigueState };
    let simTime = currentTime;
    
    for (let hour = 0; hour <= hoursAhead; hour += intervalHours) {
      const futureTime = currentTime + (hour * 3600000);
      
      // Simulate fatigue progression (simplified)
      const deltaTime = futureTime - simTime;
      
      // Assume continued current load levels (limitation of prediction)
      const loadFactor = simState.cognitiveLoad + simState.physicalLoad;
      const fatigueIncrease = FATIGUE_PARAMETERS.workFatigueAccumulation * 
                             loadFactor * deltaTime;
      
      simState.workFatigue = Math.min(1, simState.workFatigue + fatigueIncrease);
      simState.homeostaticPressure = Math.min(1, 
        simState.homeostaticPressure + 
        FATIGUE_PARAMETERS.homeostaticDecayRate * deltaTime);
      
      const predictedFatigue = Math.min(1,
        (simState.homeostaticPressure * 0.4) + (simState.workFatigue * 0.6));
      
      // Confidence decreases with prediction horizon and increases with pattern stability
      const baseConfidence = 0.8;
      const timeDecay = Math.exp(-hour / 8); // Decay over 8 hours
      const confidence = Math.max(0.1, baseConfidence * timeDecay);
      
      predictions.push({
        timestamp: futureTime,
        predictedFatigue,
        confidence
      });
      
      simTime = futureTime;
    }
    
    return predictions;
  };

  /**
   * Get optimal break timing recommendation
   */
  const getOptimalBreakTiming = (timestamp: number = Date.now()): {
    recommendedBreakTime: number;
    breakDuration: number;
    urgency: 'low' | 'medium' | 'high';
  } => {
    const currentFatigue = getCurrentFatigue(timestamp);
    
    // Determine urgency based on fatigue level and continuous work time
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (currentFatigue.overall > 0.7 || fatigueState.continuousWorkTime > FATIGUE_PARAMETERS.maxWorkContinuity) {
      urgency = 'high';
    } else if (currentFatigue.overall > 0.5 || fatigueState.continuousWorkTime > FATIGUE_PARAMETERS.optimalWorkContinuity) {
      urgency = 'medium';
    }
    
    // Calculate optimal break timing
    let recommendedBreakTime: number;
    if (urgency === 'high') {
      recommendedBreakTime = timestamp; // Immediate break
    } else if (urgency === 'medium') {
      recommendedBreakTime = timestamp + (15 * 60 * 1000); // 15 minutes
    } else {
      // Wait until optimal work period completion
      const remainingOptimalTime = FATIGUE_PARAMETERS.optimalWorkContinuity - 
                                  fatigueState.continuousWorkTime;
      recommendedBreakTime = timestamp + Math.max(0, remainingOptimalTime);
    }
    
    // Calculate break duration based on fatigue level
    let breakDuration: number;
    if (currentFatigue.overall > 0.8) {
      breakDuration = 30 * 60 * 1000; // 30 minutes for high fatigue
    } else if (currentFatigue.overall > 0.6) {
      breakDuration = FATIGUE_PARAMETERS.optimalBreakDuration;
    } else {
      breakDuration = 10 * 60 * 1000; // 10 minutes for low fatigue
    }
    
    return {
      recommendedBreakTime,
      breakDuration,
      urgency
    };
  };

  /**
   * Reset daily fatigue accumulation
   */
  const resetDaily = (timestamp: number = Date.now()): void => {
    fatigueState.totalWorkToday = 0;
    fatigueState.continuousWorkTime = 0;
    fatigueState.microRecoveryAccumulated = 0;
    fatigueState.lastRestTime = timestamp;
    
    // Partial reset of work fatigue (some carries over)
    fatigueState.workFatigue *= 0.3;
    
    lastUpdateTime = timestamp;
  };

  /**
   * Get current fatigue state (for debugging/monitoring)
   */
  const getState = (): FatigueState => {
    return { ...fatigueState };
  };

  /**
   * Set fatigue state (for state restoration)
   */
  const setState = (state: Partial<FatigueState>): void => {
    Object.assign(fatigueState, state);
  };

  // Helper functions

  /**
   * Update internal state to current timestamp
   */
  const updateInternalState = (timestamp: number): void => {
    if (timestamp > lastUpdateTime) {
      // Assume minimal activity during untracked time
      updateWorkload(0, 0, timestamp);
    }
  };

  /**
   * Calculate rest quality based on duration
   */
  const calculateRestQuality = (duration: number): number => {
    if (duration < FATIGUE_PARAMETERS.minBreakEffectiveness) {
      return 0.3; // Very short breaks have limited effectiveness
    } else if (duration < FATIGUE_PARAMETERS.optimalBreakDuration) {
      // Linear increase to optimal
      return 0.3 + 0.7 * (duration / FATIGUE_PARAMETERS.optimalBreakDuration);
    } else {
      return 1.0; // Full effectiveness for optimal or longer breaks
    }
  };

  /**
   * Calculate recovery time needed for current fatigue level
   */
  const calculateRecoveryNeeded = (fatigueLevel: number): number => {
    if (fatigueLevel < 0.3) {
      return 5 * 60 * 1000; // 5 minutes
    } else if (fatigueLevel < 0.6) {
      return 15 * 60 * 1000; // 15 minutes
    } else if (fatigueLevel < 0.8) {
      return 30 * 60 * 1000; // 30 minutes
    } else {
      return 60 * 60 * 1000; // 1 hour
    }
  };

  return {
    updateWorkload,
    addRestPeriod,
    getCurrentFatigue,
    predictFatigueProgression,
    getOptimalBreakTiming,
    resetDaily,
    getState,
    setState
  };
};