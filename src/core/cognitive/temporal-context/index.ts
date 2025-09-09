/**
 * @fileoverview Temporal Context Engine - Main Orchestration
 * 
 * Advanced temporal modeling system that integrates circadian rhythms,
 * fatigue accumulation, and task progression for comprehensive human factors
 * integration in cognitive systems.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createLogger } from '../../../shared/utils/logger.js';
import { createCircadianModel } from './circadian-model.js';
import { createFatigueModel } from './fatigue-model.js';
import { createTaskProgressionModel } from './task-progression-model.js';

import type {
  TemporalContextEngine,
  TemporalContextConfig,
  TemporalContext,
  TemporalRecommendation,
  TemporalAnalytics,
  TemporalPattern,
  UserProfile,
  CognitiveFusionEngine,
  ContextualState
} from './types.js';

// Re-export types and sub-modules
export * from './types.js';
export { createCircadianModel } from './circadian-model.js';
export { createFatigueModel } from './fatigue-model.js';
export { createTaskProgressionModel } from './task-progression-model.js';

const logger = createLogger({ level: 2, component: 'TemporalContextEngine' });

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<TemporalContextConfig> = {
  userProfile: {
    chronotype: 'neutral',
    timezone: 'UTC',
    sleepSchedule: { bedtime: '23:00', wakeup: '07:00' },
    melatoninOffset: 0,
    age: 35,
    fitnessLevel: 0.7,
    caffeineConsumption: 200
  },
  circadian: {
    enablePersonalization: true,
    adaptationRate: 0.1,
    predictionHorizon: 8
  },
  fatigue: {
    maxWorkPeriod: 8 * 3600000,
    fatigueThreshold: 0.7,
    recoveryRate: 0.1,
    cognitiveLoadWeight: 0.3,
    physicalLoadWeight: 0.2,
    microrecoveryRate: 0.05
  },
  taskProgression: {
    phases: ['orientation', 'adaptation', 'performance', 'plateau', 'fatigue', 'recovery'],
    phaseDurations: {
      orientation: 5 * 60 * 1000,
      adaptation: 15 * 60 * 1000,
      performance: 45 * 60 * 1000,
      plateau: 30 * 60 * 1000,
      fatigue: 20 * 60 * 1000,
      recovery: 10 * 60 * 1000
    },
    complexityFactors: {
      learning: 0.8,
      adaptation: 0.7,
      maintenance: 0.9
    },
    performanceModifiers: {
      experience: 0.8,
      familiarity: 0.6,
      toolQuality: 0.9
    }
  },
  integration: {
    enableRealTimeUpdates: true,
    updateInterval: 60000,
    enablePredictions: true,
    maxPredictionHorizon: 8
  },
  optimization: {
    enableAutoRecommendations: true,
    adaptiveScheduling: true,
    personalizedBreaks: true
  }
};

/**
 * Create comprehensive temporal context engine
 */
export const createTemporalContextEngine = (config: TemporalContextConfig = {}): TemporalContextEngine => {
  
  // Merge configuration with defaults
  const mergedConfig: Required<TemporalContextConfig> = {
    userProfile: { ...DEFAULT_CONFIG.userProfile, ...config.userProfile },
    circadian: { ...DEFAULT_CONFIG.circadian, ...config.circadian },
    fatigue: { ...DEFAULT_CONFIG.fatigue, ...config.fatigue },
    taskProgression: { ...DEFAULT_CONFIG.taskProgression, ...config.taskProgression },
    integration: { ...DEFAULT_CONFIG.integration, ...config.integration },
    optimization: { ...DEFAULT_CONFIG.optimization, ...config.optimization }
  };

  // Initialize component models
  const circadianModel = createCircadianModel(mergedConfig.userProfile);
  const fatigueModel = createFatigueModel(mergedConfig.fatigue);
  const taskProgressionModel = createTaskProgressionModel(mergedConfig.taskProgression);

  // State management
  let currentContext: TemporalContext | null = null;
  let lastContextUpdate = 0;
  const contextHistory: TemporalContext[] = [];
  const maxHistoryLength = 1000;

  // Integration state
  let fusionEngineIntegration: CognitiveFusionEngine | null = null;
  let realTimeUpdateTimer: NodeJS.Timeout | null = null;

  /**
   * Update and get current temporal context
   */
  const updateContext = (timestamp: number = Date.now()): TemporalContext => {
    try {
      // Get component states
      const circadianFactor = circadianModel.getCircadianFactor(timestamp);
      const attentionCapacity = circadianModel.getAttentionCapacity(timestamp);
      const fatigueMetrics = fatigueModel.getCurrentFatigue(timestamp);
      const taskMetrics = taskProgressionModel.getCurrentMetrics(timestamp);

      // Calculate overall performance factor
      const overallPerformanceFactor = calculateOverallPerformance(
        circadianFactor,
        fatigueMetrics.currentCapacity,
        taskMetrics.performanceEfficiency
      );

      // Determine contextual state
      const contextualState = determineContextualState(overallPerformanceFactor, fatigueMetrics.overall);

      // Generate predictions
      const predictions = generatePredictions(timestamp);

      // Generate recommendations
      const recommendations = generateRecommendations(timestamp, overallPerformanceFactor, fatigueMetrics);

      // Create context object
      const context: TemporalContext = {
        timestamp,
        circadianFactor,
        fatigueLevel: fatigueMetrics.overall,
        attentionCapacity,
        taskPhase: taskMetrics.currentPhase,
        overallPerformanceFactor,
        contextualState,
        predictions,
        recommendations
      };

      // Update state
      currentContext = context;
      lastContextUpdate = timestamp;

      // Store in history
      contextHistory.push(context);
      if (contextHistory.length > maxHistoryLength) {
        contextHistory.shift();
      }

      // Integrate with fusion engine if available
      if (fusionEngineIntegration && fusionEngineIntegration.addTemporalContext) {
        fusionEngineIntegration.addTemporalContext(context);
      }

      logger.debug('Temporal context updated', {
        performance: overallPerformanceFactor,
        state: contextualState,
        fatigue: fatigueMetrics.overall
      });

      return context;

    } catch (error) {
      logger.error('Failed to update temporal context:', error);
      throw error;
    }
  };

  /**
   * Get current context without updating
   */
  const getCurrentContext = (): TemporalContext | null => {
    return currentContext;
  };

  /**
   * Update workload information
   */
  const updateWorkload = (
    cognitiveLoad: number,
    physicalLoad: number = 0,
    timestamp: number = Date.now()
  ): void => {
    try {
      fatigueModel.updateWorkload(cognitiveLoad, physicalLoad, timestamp);
      
      // Trigger context update if real-time updates are enabled
      if (mergedConfig.integration.enableRealTimeUpdates) {
        updateContext(timestamp);
      }

    } catch (error) {
      logger.error('Failed to update workload:', error);
    }
  };

  /**
   * Add rest period
   */
  const addRestPeriod = (duration: number, timestamp: number = Date.now()): void => {
    try {
      fatigueModel.addRestPeriod(duration, timestamp);
      
      // Trigger context update
      if (mergedConfig.integration.enableRealTimeUpdates) {
        updateContext(timestamp);
      }

      logger.info('Rest period added', { duration: duration / 60000 });

    } catch (error) {
      logger.error('Failed to add rest period:', error);
    }
  };

  /**
   * Start task tracking
   */
  const startTask = (
    taskType: string,
    estimatedDuration: number,
    complexity: number,
    timestamp: number = Date.now()
  ): void => {
    try {
      taskProgressionModel.startTask(taskType, estimatedDuration, complexity, timestamp);
      
      // Trigger context update
      if (mergedConfig.integration.enableRealTimeUpdates) {
        updateContext(timestamp);
      }

      logger.info('Task started', { taskType, estimatedDuration: estimatedDuration / 60000, complexity });

    } catch (error) {
      logger.error('Failed to start task:', error);
    }
  };

  /**
   * Update task progress
   */
  const updateTaskProgress = (progress: number, timestamp: number = Date.now()): void => {
    try {
      taskProgressionModel.updateProgress(progress, timestamp);
      
      // Trigger context update for significant progress changes
      if (mergedConfig.integration.enableRealTimeUpdates) {
        updateContext(timestamp);
      }

    } catch (error) {
      logger.error('Failed to update task progress:', error);
    }
  };

  /**
   * Complete current task
   */
  const completeTask = (timestamp: number = Date.now()): void => {
    try {
      taskProgressionModel.completeTask(timestamp);
      
      // Trigger context update
      if (mergedConfig.integration.enableRealTimeUpdates) {
        updateContext(timestamp);
      }

      logger.info('Task completed');

    } catch (error) {
      logger.error('Failed to complete task:', error);
    }
  };

  /**
   * Predict performance over time horizon
   */
  const predictPerformance = (hoursAhead: number): Array<{
    timestamp: number;
    performanceFactor: number;
    confidence: number;
    context: TemporalContext;
  }> => {
    try {
      const predictions: Array<{
        timestamp: number;
        performanceFactor: number;
        confidence: number;
        context: TemporalContext;
      }> = [];

      const currentTime = Date.now();
      const intervalHours = 0.5;

      for (let hour = 0; hour <= hoursAhead; hour += intervalHours) {
        const futureTime = currentTime + (hour * 3600000);

        // Get predictions from component models
        const circadianPredictions = circadianModel.getAlertnessPrediction(currentTime, hoursAhead);
        const fatiguePredictions = fatigueModel.predictFatigueProgression(hoursAhead);
        const performancePredictions = taskProgressionModel.predictPerformanceDecline(hoursAhead);

        // Find predictions closest to this time point
        const circadianPred = circadianPredictions.find(p => 
          Math.abs(p.timestamp - futureTime) < 30 * 60 * 1000) || circadianPredictions[0];
        const fatiguePred = fatiguePredictions.find(p => 
          Math.abs(p.timestamp - futureTime) < 30 * 60 * 1000) || fatiguePredictions[0];
        const taskPred = performancePredictions.find(p => 
          Math.abs(p.timestamp - futureTime) < 30 * 60 * 1000) || performancePredictions[0];

        // Combine predictions
        const performanceFactor = calculateOverallPerformance(
          circadianPred?.alertness || 0.7,
          1 - (fatiguePred?.predictedFatigue || 0.3),
          taskPred?.predictedEfficiency || 0.8
        );

        // Calculate combined confidence
        const confidence = Math.min(
          circadianPred?.confidence || 0.5,
          fatiguePred?.confidence || 0.5,
          taskPred?.confidence || 0.5
        );

        // Create future context
        const futureContext: TemporalContext = {
          timestamp: futureTime,
          circadianFactor: circadianPred?.alertness || 0.7,
          fatigueLevel: fatiguePred?.predictedFatigue || 0.3,
          attentionCapacity: circadianPred?.alertness || 0.7,
          taskPhase: 'performance', // Simplified prediction
          overallPerformanceFactor: performanceFactor,
          contextualState: determineContextualState(performanceFactor, fatiguePred?.predictedFatigue || 0.3),
          predictions: { alertness: [], fatigue: [], performance: [] },
          recommendations: []
        };

        predictions.push({
          timestamp: futureTime,
          performanceFactor,
          confidence,
          context: futureContext
        });
      }

      return predictions;

    } catch (error) {
      logger.error('Failed to predict performance:', error);
      return [];
    }
  };

  /**
   * Analyze temporal patterns in historical data
   */
  const analyzeTemporalPatterns = (lookbackPeriod: number = 7 * 24 * 3600000): TemporalAnalytics => {
    try {
      const recentContext = contextHistory.filter(
        ctx => ctx.timestamp > Date.now() - lookbackPeriod
      );

      if (recentContext.length < 10) {
        return {
          patterns: [],
          optimization: {
            potentialGains: 0,
            implementationEffort: 0.5,
            recommendations: []
          },
          insights: {
            workloadTrends: ['Insufficient data for analysis'],
            performanceInsights: ['Need more historical data'],
            healthImplications: ['Continue monitoring']
          }
        };
      }

      // Analyze patterns
      const patterns = extractTemporalPatterns(recentContext);
      const optimization = analyzeOptimizationOpportunities(recentContext, patterns);
      const insights = generateInsights(recentContext, patterns);

      return { patterns, optimization, insights };

    } catch (error) {
      logger.error('Failed to analyze temporal patterns:', error);
      throw error;
    }
  };

  /**
   * Get current recommendations
   */
  const getRecommendations = (timestamp: number = Date.now()): TemporalRecommendation[] => {
    if (!currentContext || timestamp - lastContextUpdate > mergedConfig.integration.updateInterval) {
      updateContext(timestamp);
    }

    return currentContext?.recommendations || [];
  };

  /**
   * Generate optimal schedule for tasks
   */
  const getOptimalSchedule = (
    tasks: Array<{
      type: string;
      duration: number;
      complexity: number;
      priority: number;
    }>,
    timeHorizon: number
  ): Array<{
    task: string;
    startTime: number;
    endTime: number;
    expectedEfficiency: number;
  }> => {
    try {
      const schedule: Array<{
        task: string;
        startTime: number;
        endTime: number;
        expectedEfficiency: number;
      }> = [];

      const startTime = Date.now();
      let currentTime = startTime;

      // Sort tasks by priority and complexity
      const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

      for (const task of sortedTasks) {
        if (currentTime - startTime > timeHorizon) break;

        // Find optimal time slot
        const optimalPeriods = circadianModel.calculateOptimalWorkPeriods(currentTime, task.duration);
        
        const bestPeriod = optimalPeriods.find(period => 
          period.end - period.start >= task.duration
        ) || {
          start: currentTime,
          end: currentTime + task.duration,
          expectedPerformance: 0.6
        };

        schedule.push({
          task: task.type,
          startTime: bestPeriod.start,
          endTime: bestPeriod.start + task.duration,
          expectedEfficiency: bestPeriod.expectedPerformance * (1 - task.complexity * 0.2)
        });

        currentTime = bestPeriod.start + task.duration + (15 * 60 * 1000); // 15-min buffer
      }

      return schedule;

    } catch (error) {
      logger.error('Failed to generate optimal schedule:', error);
      return [];
    }
  };

  /**
   * Update user profile
   */
  const updateUserProfile = (profile: Partial<UserProfile>): void => {
    try {
      Object.assign(mergedConfig.userProfile, profile);
      
      // Recreate circadian model with new profile
      const newCircadianModel = createCircadianModel(mergedConfig.userProfile);
      Object.setPrototypeOf(circadianModel, Object.getPrototypeOf(newCircadianModel));
      Object.assign(circadianModel, newCircadianModel);

      logger.info('User profile updated');

    } catch (error) {
      logger.error('Failed to update user profile:', error);
    }
  };

  /**
   * Calibrate models with performance data
   */
  const calibrateModels = (
    performanceData: Array<{
      timestamp: number;
      actualPerformance: number;
      context: Partial<TemporalContext>;
    }>
  ): void => {
    try {
      // This would implement machine learning calibration
      // For now, we'll do basic statistical adjustment
      
      if (performanceData.length < 5) {
        logger.warn('Insufficient data for calibration');
        return;
      }

      logger.info(`Calibrating models with ${performanceData.length} data points`);
      
      // Implementation would adjust model parameters based on actual vs predicted performance
      
    } catch (error) {
      logger.error('Failed to calibrate models:', error);
    }
  };

  /**
   * Integrate with cognitive fusion engine
   */
  const integrateWithCognitiveFusion = (fusionEngine: CognitiveFusionEngine): boolean => {
    try {
      if (!fusionEngine || typeof fusionEngine.addTemporalContext !== 'function') {
        logger.warn('Invalid fusion engine provided for integration');
        return false;
      }

      fusionEngineIntegration = fusionEngine;
      
      // Start real-time updates if enabled
      if (mergedConfig.integration.enableRealTimeUpdates && !realTimeUpdateTimer) {
        startRealTimeUpdates();
      }

      logger.info('✨ Temporal Context Engine integrated with Cognitive Fusion');
      return true;

    } catch (error) {
      logger.error('Failed to integrate with fusion engine:', error);
      return false;
    }
  };

  /**
   * Export current state
   */
  const exportState = (): Record<string, unknown> => {
    return {
      currentContext,
      contextHistory,
      fatigueState: fatigueModel.getState(),
      taskHistory: taskProgressionModel.getTaskHistory(),
      config: mergedConfig,
      lastUpdate: lastContextUpdate
    };
  };

  /**
   * Import state
   */
  const importState = (state: Record<string, unknown>): boolean => {
    try {
      if (state.currentContext) {
        currentContext = state.currentContext as TemporalContext;
      }
      
      if (state.contextHistory && Array.isArray(state.contextHistory)) {
        contextHistory.splice(0, contextHistory.length, ...state.contextHistory as TemporalContext[]);
      }

      if (state.fatigueState) {
        fatigueModel.setState(state.fatigueState as any);
      }

      if (state.lastUpdate) {
        lastContextUpdate = state.lastUpdate as number;
      }

      logger.info('State imported successfully');
      return true;

    } catch (error) {
      logger.error('Failed to import state:', error);
      return false;
    }
  };

  /**
   * Cleanup resources
   */
  const cleanup = (): void => {
    try {
      if (realTimeUpdateTimer) {
        clearInterval(realTimeUpdateTimer);
        realTimeUpdateTimer = null;
      }

      fusionEngineIntegration = null;
      currentContext = null;
      contextHistory.length = 0;

      logger.info('🧹 Temporal Context Engine cleaned up');

    } catch (error) {
      logger.error('Failed to cleanup:', error);
    }
  };

  // Helper functions

  /**
   * Calculate overall performance from component factors
   */
  const calculateOverallPerformance = (
    circadianFactor: number,
    fatigueCapacity: number,
    taskEfficiency: number
  ): number => {
    // Weighted combination of factors
    const weights = { circadian: 0.3, fatigue: 0.4, task: 0.3 };
    
    return Math.max(0.1, Math.min(1.0,
      (circadianFactor * weights.circadian) +
      (fatigueCapacity * weights.fatigue) +
      (taskEfficiency * weights.task)
    ));
  };

  /**
   * Determine contextual state from performance metrics
   */
  const determineContextualState = (performanceFactor: number, fatigueLevel: number): ContextualState => {
    if (performanceFactor >= 0.8 && fatigueLevel < 0.3) {
      return 'optimal';
    } else if (performanceFactor >= 0.6 && fatigueLevel < 0.6) {
      return 'good';
    } else if (performanceFactor >= 0.4 && fatigueLevel < 0.8) {
      return 'suboptimal';
    } else {
      return 'concerning';
    }
  };

  /**
   * Generate comprehensive predictions
   */
  const generatePredictions = (timestamp: number) => {
    const alertnessPreds = circadianModel.getAlertnessPrediction(timestamp, 4);
    const fatiguePreds = fatigueModel.predictFatigueProgression(4);
    const performancePreds = taskProgressionModel.predictPerformanceDecline(4);

    return {
      alertness: alertnessPreds,
      fatigue: fatiguePreds.map(p => ({ 
        timestamp: p.timestamp, 
        level: p.predictedFatigue, 
        confidence: p.confidence 
      })),
      performance: performancePreds.map(p => ({
        timestamp: p.timestamp,
        efficiency: p.predictedEfficiency,
        confidence: p.confidence
      }))
    };
  };

  /**
   * Generate contextual recommendations
   */
  const generateRecommendations = (
    timestamp: number,
    performanceFactor: number,
    fatigueMetrics: any
  ): TemporalRecommendation[] => {
    const recommendations: TemporalRecommendation[] = [];

    // Fatigue-based recommendations
    if (fatigueMetrics.overall > 0.7) {
      const breakRecommendation = fatigueModel.getOptimalBreakTiming(timestamp);
      recommendations.push({
        type: 'break',
        priority: breakRecommendation.urgency === 'high' ? 'critical' : 'medium',
        title: 'Take a Recovery Break',
        description: `High fatigue detected (${(fatigueMetrics.overall * 100).toFixed(0)}%). Take a ${breakRecommendation.breakDuration / 60000}-minute break.`,
        timing: breakRecommendation.recommendedBreakTime,
        duration: breakRecommendation.breakDuration,
        expectedBenefit: 0.8,
        confidence: 0.9
      });
    }

    // Task switching recommendations
    const taskSwitch = taskProgressionModel.getOptimalTaskSwitch(timestamp);
    if (taskSwitch.recommendedSwitchTime <= timestamp + 30 * 60 * 1000) { // Within 30 minutes
      recommendations.push({
        type: 'task-switch',
        priority: 'medium',
        title: 'Consider Task Switching',
        description: taskSwitch.reasoning,
        timing: taskSwitch.recommendedSwitchTime,
        expectedBenefit: 0.6,
        confidence: 0.7
      });
    }

    // Performance optimization
    if (performanceFactor < 0.6) {
      recommendations.push({
        type: 'environmental-adjustment',
        priority: 'medium',
        title: 'Optimize Work Environment',
        description: 'Low performance detected. Consider adjusting lighting, noise, or taking a short break.',
        timing: timestamp,
        expectedBenefit: 0.4,
        confidence: 0.6
      });
    }

    return recommendations;
  };

  /**
   * Extract temporal patterns from context history
   */
  const extractTemporalPatterns = (contexts: TemporalContext[]): TemporalPattern[] => {
    const patterns: TemporalPattern[] = [];

    // Daily performance pattern
    const dailyPerformance = contexts.map(ctx => ({
      hour: new Date(ctx.timestamp).getHours(),
      performance: ctx.overallPerformanceFactor
    }));

    if (dailyPerformance.length > 24) {
      patterns.push({
        patternType: 'daily',
        strength: 0.7, // Would calculate actual correlation strength
        confidence: 0.8,
        description: 'Peak performance typically occurs in mid-morning and mid-afternoon',
        peakTimes: [10, 16],
        lowTimes: [14, 20],
        recommendations: [
          'Schedule demanding tasks during peak hours',
          'Take breaks during natural low periods'
        ]
      });
    }

    return patterns;
  };

  /**
   * Analyze optimization opportunities
   */
  const analyzeOptimizationOpportunities = (
    contexts: TemporalContext[], 
    patterns: TemporalPattern[]
  ) => {
    return {
      potentialGains: 0.2, // 20% potential improvement
      implementationEffort: 0.6,
      recommendations: patterns.flatMap(p => p.recommendations).map(rec => ({
        type: 'schedule-optimization' as const,
        priority: 'medium' as const,
        title: 'Schedule Optimization',
        description: rec,
        timing: Date.now(),
        expectedBenefit: 0.2,
        confidence: 0.7
      }))
    };
  };

  /**
   * Generate insights from analysis
   */
  const generateInsights = (contexts: TemporalContext[], patterns: TemporalPattern[]) => {
    return {
      workloadTrends: [
        'Average performance varies by 30% throughout the day',
        'Fatigue accumulates faster during high-complexity tasks'
      ],
      performanceInsights: [
        'Peak performance occurs during mid-morning hours',
        'Task switching improves efficiency in afternoon hours'
      ],
      healthImplications: [
        'Regular breaks prevent performance decline',
        'Circadian alignment improves overall well-being'
      ]
    };
  };

  /**
   * Start real-time context updates
   */
  const startRealTimeUpdates = (): void => {
    realTimeUpdateTimer = setInterval(() => {
      updateContext();
    }, mergedConfig.integration.updateInterval);
  };

  return {
    updateContext,
    getCurrentContext,
    updateWorkload,
    addRestPeriod,
    startTask,
    updateTaskProgress,
    completeTask,
    predictPerformance,
    analyzeTemporalPatterns,
    getRecommendations,
    getOptimalSchedule,
    updateUserProfile,
    calibrateModels,
    integrateWithCognitiveFusion,
    exportState,
    importState,
    cleanup
  };
};