/**
 * @fileoverview Circadian Rhythm Modeling System
 * 
 * Advanced circadian rhythm modeling based on research from Roenneberg et al.
 * and the Two-Process Model (Borbély). Handles individual chronotypes, 
 * attention capacity fluctuations, and performance predictions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  CircadianModel,
  CircadianPrediction,
  UserProfile,
  Chronotype
} from './types.js';

/**
 * Circadian rhythm parameters based on chronobiology research
 */
const CIRCADIAN_PARAMETERS = {
  coreBodyTempPhase: 6, // Hour of temperature minimum
  performancePeakPhases: {
    morning: [8, 11],   // Morning types peak earlier
    neutral: [10, 16],  // Neutral types have standard peaks
    evening: [14, 18]   // Evening types peak later
  },
  postLunchDipPeriod: { start: 13, end: 15 },
  eveningDeclineStart: 20,
  attentionBaseCapacity: 0.8,
  circadianAmplitude: 0.2
} as const;

/**
 * Create advanced circadian rhythm model
 */
export const createCircadianModel = (userProfile: UserProfile = {}): CircadianModel => {
  const {
    chronotype = 'neutral',
    timezone = 'UTC',
    sleepSchedule = { bedtime: '23:00', wakeup: '07:00' },
    melatoninOffset = 0,
    age = 35,
    caffeineConsumption = 200 // mg/day
  } = userProfile;

  /**
   * Calculate circadian performance factor using core body temperature rhythm
   */
  const getCircadianFactor = (timestamp: number): number => {
    const date = new Date(timestamp);
    const hour = date.getHours() + (date.getMinutes() / 60);
    
    // Core body temperature rhythm approximation (sinusoidal model)
    const temperaturePhase = CIRCADIAN_PARAMETERS.coreBodyTempPhase;
    const coreBodyTemp = Math.sin((hour - temperaturePhase) * Math.PI / 12);
    
    // Chronotype adjustments based on research
    const chronotypeOffset = getChronotypeOffset(chronotype);
    const adjustedHour = (hour + chronotypeOffset + melatoninOffset + 24) % 24;
    
    // Multi-harmonic performance curve modeling
    const primaryRhythm = Math.cos((adjustedHour - 11) * Math.PI / 12); // 24h cycle, peak at 11am
    const secondaryRhythm = Math.cos((adjustedHour - 16) * Math.PI / 4); // 8h cycle, afternoon peak
    
    // Age-related amplitude reduction
    const ageAdjustment = Math.max(0.7, 1 - (Math.max(0, age - 25) * 0.005));
    
    // Combine rhythms with weighted averaging
    const performanceCurve = 
      CIRCADIAN_PARAMETERS.attentionBaseCapacity + 
      CIRCADIAN_PARAMETERS.circadianAmplitude * (
        0.7 * primaryRhythm + 
        0.3 * secondaryRhythm
      ) * ageAdjustment;
    
    return Math.max(0.3, Math.min(1.0, performanceCurve));
  };

  /**
   * Calculate attention capacity with additional factors
   */
  const getAttentionCapacity = (timestamp: number): number => {
    const circadianFactor = getCircadianFactor(timestamp);
    const date = new Date(timestamp);
    const hour = date.getHours() + (date.getMinutes() / 60);
    
    // Post-lunch dip modeling (well-documented phenomenon)
    const postLunchDip = isInPostLunchPeriod(hour) 
      ? 0.85 - (0.1 * getPostLunchDipIntensity(hour, chronotype))
      : 1.0;
    
    // Evening decline with individual variation
    const eveningDecline = calculateEveningDecline(hour, chronotype, age);
    
    // Caffeine effect (simplified model)
    const caffeineEffect = calculateCaffeineEffect(hour, caffeineConsumption);
    
    // Sleep debt impact (estimated from sleep schedule)
    const sleepDebtImpact = estimateSleepDebtImpact(timestamp, sleepSchedule);
    
    return Math.max(0.2, Math.min(1.0, 
      circadianFactor * postLunchDip * eveningDecline * caffeineEffect * sleepDebtImpact
    ));
  };

  /**
   * Get predicted peak performance hours
   */
  const getPredictedPeakHours = (): number[] => {
    const basePeaks = CIRCADIAN_PARAMETERS.performancePeakPhases[chronotype];
    const chronotypeOffset = getChronotypeOffset(chronotype);
    
    return basePeaks.map(hour => (hour + chronotypeOffset + melatoninOffset + 24) % 24);
  };

  /**
   * Generate detailed alertness predictions
   */
  const getAlertnessPrediction = (
    timestamp: number, 
    hoursAhead: number = 8
  ): CircadianPrediction[] => {
    const predictions: CircadianPrediction[] = [];
    const intervalHours = 0.5; // 30-minute intervals for higher resolution
    
    for (let i = 0; i <= hoursAhead; i += intervalHours) {
      const futureTime = timestamp + (i * 3600000);
      const alertness = getAttentionCapacity(futureTime);
      
      // Confidence decreases with prediction horizon and includes model uncertainty
      const baseConfidence = 0.9;
      const horizonDecay = Math.exp(-i / 12); // Exponential decay over 12 hours
      const modelUncertainty = 0.05 + (i * 0.01); // Increasing uncertainty
      
      const confidence = Math.max(0.1, 
        baseConfidence * horizonDecay - modelUncertainty
      );
      
      predictions.push({
        timestamp: futureTime,
        alertness,
        confidence
      });
    }
    
    return predictions;
  };

  /**
   * Determine current performance phase
   */
  const getCurrentPerformancePhase = (timestamp: number): 'peak' | 'good' | 'moderate' | 'low' => {
    const attentionCapacity = getAttentionCapacity(timestamp);
    
    if (attentionCapacity >= 0.8) return 'peak';
    if (attentionCapacity >= 0.65) return 'good';
    if (attentionCapacity >= 0.45) return 'moderate';
    return 'low';
  };

  /**
   * Calculate optimal work periods for a given timespan
   */
  const calculateOptimalWorkPeriods = (
    startTime: number, 
    duration: number
  ): Array<{ start: number; end: number; expectedPerformance: number }> => {
    const periods: Array<{ start: number; end: number; expectedPerformance: number }> = [];
    const intervalSize = 30 * 60 * 1000; // 30-minute intervals
    const minWorkPeriod = 45 * 60 * 1000; // Minimum 45-minute work periods
    
    let currentStart = startTime;
    let currentPerformance = 0;
    let currentDuration = 0;
    
    for (let time = startTime; time < startTime + duration; time += intervalSize) {
      const performance = getAttentionCapacity(time);
      
      if (performance >= 0.6) { // Good enough for productive work
        if (currentDuration === 0) {
          currentStart = time;
          currentPerformance = performance;
        } else {
          // Running average of performance
          const weight = intervalSize / (currentDuration + intervalSize);
          currentPerformance = currentPerformance * (1 - weight) + performance * weight;
        }
        currentDuration += intervalSize;
      } else {
        // End current work period if it's long enough
        if (currentDuration >= minWorkPeriod) {
          periods.push({
            start: currentStart,
            end: currentStart + currentDuration,
            expectedPerformance: currentPerformance
          });
        }
        currentDuration = 0;
      }
    }
    
    // Don't forget the last period
    if (currentDuration >= minWorkPeriod) {
      periods.push({
        start: currentStart,
        end: currentStart + currentDuration,
        expectedPerformance: currentPerformance
      });
    }
    
    return periods;
  };

  // Helper functions

  /**
   * Get chronotype-specific hour offset
   */
  const getChronotypeOffset = (chronotype: Chronotype): number => {
    const offsets = {
      morning: -2,  // Earlier peak performance
      evening: +3,  // Later peak performance  
      neutral: 0    // Standard timing
    };
    return offsets[chronotype];
  };

  /**
   * Check if hour is in post-lunch dip period
   */
  const isInPostLunchPeriod = (hour: number): boolean => {
    return hour >= CIRCADIAN_PARAMETERS.postLunchDipPeriod.start && 
           hour <= CIRCADIAN_PARAMETERS.postLunchDipPeriod.end;
  };

  /**
   * Calculate post-lunch dip intensity
   */
  const getPostLunchDipIntensity = (hour: number, chronotype: Chronotype): number => {
    if (!isInPostLunchPeriod(hour)) return 0;
    
    // Peak dip at 2 PM, varies by chronotype
    const dipCenter = 14;
    const distance = Math.abs(hour - dipCenter);
    const maxIntensity = chronotype === 'evening' ? 0.8 : 1.0; // Evening types less affected
    
    return maxIntensity * Math.exp(-distance * distance / 2);
  };

  /**
   * Calculate evening performance decline
   */
  const calculateEveningDecline = (hour: number, chronotype: Chronotype, age: number): number => {
    if (hour < CIRCADIAN_PARAMETERS.eveningDeclineStart) return 1.0;
    
    const hoursAfterDeclineStart = hour - CIRCADIAN_PARAMETERS.eveningDeclineStart;
    const chronotypeMultiplier = {
      morning: 1.5, // More pronounced decline
      neutral: 1.0, // Standard decline
      evening: 0.6  // Less pronounced decline
    }[chronotype];
    
    // Age factor - older adults decline earlier and more steeply
    const ageMultiplier = 1 + (Math.max(0, age - 40) * 0.01);
    
    const declineRate = 0.05 * chronotypeMultiplier * ageMultiplier;
    return Math.max(0.5, 1.0 - (hoursAfterDeclineStart * declineRate));
  };

  /**
   * Calculate simplified caffeine effect on alertness
   */
  const calculateCaffeineEffect = (hour: number, dailyCaffeineIntake: number): number => {
    if (dailyCaffeineIntake <= 0) return 1.0;
    
    // Assume caffeine consumed at 8 AM and 2 PM
    const consumptionTimes = [8, 14];
    const halfLife = 5; // Caffeine half-life in hours
    
    let totalEffect = 0;
    
    consumptionTimes.forEach(consumptionTime => {
      const timeSinceConsumption = Math.max(0, hour - consumptionTime);
      if (timeSinceConsumption >= 0 && timeSinceConsumption <= 8) { // Effect window
        const remainingCaffeine = Math.exp(-0.693 * timeSinceConsumption / halfLife);
        const doseEffect = Math.min(0.15, dailyCaffeineIntake / 200 * 0.1); // Cap effect at 15%
        totalEffect += remainingCaffeine * doseEffect;
      }
    });
    
    return 1.0 + totalEffect;
  };

  /**
   * Estimate sleep debt impact on performance
   */
  const estimateSleepDebtImpact = (timestamp: number, sleepSchedule: UserProfile['sleepSchedule']): number => {
    if (!sleepSchedule) return 1.0;
    
    try {
      const [bedtimeHour, bedtimeMinute] = sleepSchedule.bedtime.split(':').map(Number);
      const [wakeupHour, wakeupMinute] = sleepSchedule.wakeup.split(':').map(Number);
      
      // Calculate sleep duration
      let sleepDuration = (wakeupHour + wakeupMinute/60) - (bedtimeHour + bedtimeMinute/60);
      if (sleepDuration < 0) sleepDuration += 24; // Handle overnight sleep
      
      const optimalSleep = 8; // hours
      const sleepDebt = Math.max(0, optimalSleep - sleepDuration);
      
      // Each hour of sleep debt reduces performance by ~8%
      return Math.max(0.6, 1.0 - (sleepDebt * 0.08));
      
    } catch (error) {
      console.warn('Invalid sleep schedule format, using default impact');
      return 1.0;
    }
  };

  return {
    getCircadianFactor,
    getAttentionCapacity,
    getPredictedPeakHours,
    getAlertnessPrediction,
    getCurrentPerformancePhase,
    calculateOptimalWorkPeriods
  };
};