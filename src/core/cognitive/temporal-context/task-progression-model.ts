/**
 * @fileoverview Task Progression Model
 * 
 * Advanced task progression modeling with learning curves, adaptation phases,
 * and performance prediction based on task complexity and individual factors.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  TaskProgressionModel,
  TaskProgressionConfig,
  TaskMetrics,
  TaskPhase
} from './types.js';

/**
 * Task progression parameters based on learning and performance research
 */
const TASK_PARAMETERS = {
  phases: ['orientation', 'adaptation', 'performance', 'plateau', 'fatigue', 'recovery'] as TaskPhase[],
  defaultPhaseDurations: {
    orientation: 5 * 60 * 1000,    // 5 minutes - getting familiar
    adaptation: 15 * 60 * 1000,    // 15 minutes - learning/adapting
    performance: 45 * 60 * 1000,   // 45 minutes - peak performance
    plateau: 30 * 60 * 1000,       // 30 minutes - stable performance
    fatigue: 20 * 60 * 1000,       // 20 minutes - declining performance
    recovery: 10 * 60 * 1000       // 10 minutes - minimal activity/rest
  },
  performanceMultipliers: {
    orientation: 0.4,  // 40% efficiency during orientation
    adaptation: 0.7,   // 70% efficiency during adaptation
    performance: 1.0,  // 100% efficiency during peak performance
    plateau: 0.85,     // 85% efficiency during plateau
    fatigue: 0.6,      // 60% efficiency during fatigue
    recovery: 0.3      // 30% efficiency during recovery
  },
  complexityImpacts: {
    low: { learningCurveRate: 0.8, adaptationSpeed: 1.5 },
    moderate: { learningCurveRate: 1.0, adaptationSpeed: 1.0 },
    high: { learningCurveRate: 1.4, adaptationSpeed: 0.7 },
    critical: { learningCurveRate: 2.0, adaptationSpeed: 0.5 }
  }
} as const;

/**
 * Task history entry interface
 */
interface TaskHistoryEntry {
  taskType: string;
  startTime: number;
  endTime: number;
  efficiency: number;
  phases: Array<{
    phase: TaskPhase;
    duration: number;
    efficiency: number;
  }>;
  complexity: number;
  actualProgress: number;
  estimatedDuration: number;
}

/**
 * Current task state interface
 */
interface CurrentTaskState {
  taskType: string;
  startTime: number;
  estimatedDuration: number;
  complexity: number;
  currentPhase: TaskPhase;
  phaseStartTime: number;
  actualProgress: number;
  lastProgressUpdate: number;
  phaseHistory: Array<{
    phase: TaskPhase;
    startTime: number;
    endTime: number;
    efficiency: number;
  }>;
}

/**
 * Create advanced task progression model
 */
export const createTaskProgressionModel = (config: TaskProgressionConfig = {}): TaskProgressionModel => {
  const {
    phases = TASK_PARAMETERS.phases,
    phaseDurations = TASK_PARAMETERS.defaultPhaseDurations,
    complexityFactors = {
      learning: 0.8,
      adaptation: 0.7,
      maintenance: 0.9
    },
    performanceModifiers = {
      experience: 0.8,
      familiarity: 0.6,
      toolQuality: 0.9
    }
  } = config;

  // State tracking
  let currentTask: CurrentTaskState | null = null;
  const taskHistory: TaskHistoryEntry[] = [];
  const learningCurves = new Map<string, { attempts: number; averageEfficiency: number }>();

  /**
   * Start a new task with progression tracking
   */
  const startTask = (
    taskType: string,
    estimatedDuration: number,
    complexity: number,
    timestamp: number = Date.now()
  ): void => {
    // Complete current task if exists
    if (currentTask) {
      completeTask(timestamp);
    }

    // Initialize new task
    currentTask = {
      taskType,
      startTime: timestamp,
      estimatedDuration,
      complexity: Math.max(0, Math.min(1, complexity)),
      currentPhase: 'orientation',
      phaseStartTime: timestamp,
      actualProgress: 0,
      lastProgressUpdate: timestamp,
      phaseHistory: []
    };

    // Adjust phase durations based on task complexity and experience
    adjustPhaseDurationsForTask(taskType, complexity);
  };

  /**
   * Update task progress and analyze phase transitions
   */
  const updateProgress = (actualProgress: number, timestamp: number = Date.now()): void => {
    if (!currentTask) return;

    actualProgress = Math.max(0, Math.min(1, actualProgress));
    currentTask.actualProgress = actualProgress;
    currentTask.lastProgressUpdate = timestamp;

    // Check for phase transition
    const shouldTransition = shouldTransitionPhase(timestamp);
    if (shouldTransition) {
      transitionToNextPhase(timestamp);
    }
  };

  /**
   * Get current task metrics and performance indicators
   */
  const getCurrentMetrics = (timestamp: number = Date.now()): TaskMetrics => {
    if (!currentTask) {
      return {
        currentPhase: 'recovery',
        phaseProgress: 0,
        overallProgress: 0,
        performanceEfficiency: 0.5,
        predictedCompletionTime: 0,
        optimalContinuationTime: 0
      };
    }

    updateProgress(currentTask.actualProgress, timestamp);

    const phaseElapsed = timestamp - currentTask.phaseStartTime;
    const expectedPhaseDuration = getExpectedPhaseDuration(currentTask.currentPhase);
    const phaseProgress = Math.min(1, phaseElapsed / expectedPhaseDuration);

    const totalElapsed = timestamp - currentTask.startTime;
    const overallProgress = currentTask.actualProgress;

    const performanceEfficiency = calculateCurrentEfficiency(timestamp);
    
    const predictedCompletionTime = predictCompletionTime(timestamp);
    const optimalContinuationTime = calculateOptimalContinuationTime(timestamp);

    return {
      currentPhase: currentTask.currentPhase,
      phaseProgress,
      overallProgress,
      performanceEfficiency,
      predictedCompletionTime,
      optimalContinuationTime
    };
  };

  /**
   * Predict performance decline over time
   */
  const predictPerformanceDecline = (hoursAhead: number): Array<{
    timestamp: number;
    predictedEfficiency: number;
    confidence: number;
  }> => {
    if (!currentTask) return [];

    const predictions: Array<{
      timestamp: number;
      predictedEfficiency: number;
      confidence: number;
    }> = [];

    const currentTime = Date.now();
    const intervalMinutes = 15; // 15-minute intervals

    for (let minutes = 0; minutes <= hoursAhead * 60; minutes += intervalMinutes) {
      const futureTime = currentTime + (minutes * 60 * 1000);
      const taskElapsed = futureTime - currentTask.startTime;
      
      // Predict phase at future time
      const futurePhase = predictPhaseAtTime(futureTime);
      const baseEfficiency = TASK_PARAMETERS.performanceMultipliers[futurePhase];
      
      // Apply fatigue and complexity adjustments
      const fatigueImpact = calculateFatigueImpact(taskElapsed);
      const complexityImpact = 1 - (currentTask.complexity * 0.2);
      
      const predictedEfficiency = baseEfficiency * fatigueImpact * complexityImpact;
      
      // Confidence decreases with prediction horizon
      const confidence = Math.max(0.1, 0.9 - (minutes / 60) * 0.1);

      predictions.push({
        timestamp: futureTime,
        predictedEfficiency: Math.max(0.2, Math.min(1, predictedEfficiency)),
        confidence
      });
    }

    return predictions;
  };

  /**
   * Get optimal task switching recommendation
   */
  const getOptimalTaskSwitch = (timestamp: number = Date.now()): {
    recommendedSwitchTime: number;
    newTaskType: string;
    reasoning: string;
  } => {
    if (!currentTask) {
      return {
        recommendedSwitchTime: timestamp,
        newTaskType: 'any',
        reasoning: 'No active task'
      };
    }

    const currentEfficiency = calculateCurrentEfficiency(timestamp);
    const taskElapsed = timestamp - currentTask.startTime;
    
    // Recommend switch if efficiency is low or task has run too long
    if (currentEfficiency < 0.5 || currentTask.currentPhase === 'fatigue') {
      return {
        recommendedSwitchTime: timestamp,
        newTaskType: getComplementaryTaskType(currentTask.taskType),
        reasoning: `Current efficiency low (${(currentEfficiency * 100).toFixed(0)}%) in ${currentTask.currentPhase} phase`
      };
    }

    // Predict optimal switch time
    const predictions = predictPerformanceDecline(2); // 2 hours ahead
    const optimalSwitchPoint = predictions.find(p => p.predictedEfficiency < 0.6);
    
    if (optimalSwitchPoint) {
      return {
        recommendedSwitchTime: optimalSwitchPoint.timestamp,
        newTaskType: getComplementaryTaskType(currentTask.taskType),
        reasoning: 'Predicted efficiency decline to maintain performance'
      };
    }

    return {
      recommendedSwitchTime: timestamp + (90 * 60 * 1000), // 90 minutes default
      newTaskType: currentTask.taskType,
      reasoning: 'Continue current task - performance remains optimal'
    };
  };

  /**
   * Complete current task and record metrics
   */
  const completeTask = (timestamp: number = Date.now()): void => {
    if (!currentTask) return;

    // Close current phase
    const phaseEntry = {
      phase: currentTask.currentPhase,
      startTime: currentTask.phaseStartTime,
      endTime: timestamp,
      efficiency: calculateCurrentEfficiency(timestamp)
    };
    currentTask.phaseHistory.push(phaseEntry);

    // Calculate overall efficiency
    const totalEfficiency = currentTask.phaseHistory.reduce(
      (sum, phase) => sum + phase.efficiency, 0
    ) / currentTask.phaseHistory.length;

    // Record in history
    const historyEntry: TaskHistoryEntry = {
      taskType: currentTask.taskType,
      startTime: currentTask.startTime,
      endTime: timestamp,
      efficiency: totalEfficiency,
      phases: currentTask.phaseHistory.map(p => ({
        phase: p.phase,
        duration: p.endTime - p.startTime,
        efficiency: p.efficiency
      })),
      complexity: currentTask.complexity,
      actualProgress: currentTask.actualProgress,
      estimatedDuration: currentTask.estimatedDuration
    };

    taskHistory.push(historyEntry);

    // Update learning curves
    updateLearningCurve(currentTask.taskType, totalEfficiency);

    // Clear current task
    currentTask = null;
  };

  /**
   * Get comprehensive task history
   */
  const getTaskHistory = (): Array<{
    taskType: string;
    startTime: number;
    endTime: number;
    efficiency: number;
    phases: Array<{ phase: TaskPhase; duration: number; efficiency: number }>;
  }> => {
    return taskHistory.map(entry => ({
      taskType: entry.taskType,
      startTime: entry.startTime,
      endTime: entry.endTime,
      efficiency: entry.efficiency,
      phases: entry.phases
    }));
  };

  // Helper functions

  /**
   * Adjust phase durations based on task characteristics
   */
  const adjustPhaseDurationsForTask = (taskType: string, complexity: number): void => {
    const experience = getLearningCurveData(taskType);
    const experienceMultiplier = 1 - (experience.averageEfficiency * 0.3);
    const complexityMultiplier = 1 + (complexity * 0.5);
    
    // Experienced users spend less time in orientation and adaptation
    const orientationAdjustment = experienceMultiplier;
    const adaptationAdjustment = experienceMultiplier * complexityMultiplier;
    
    // Store adjusted durations (would be applied during phase transitions)
    // This is a simplified version - full implementation would store these
  };

  /**
   * Check if current phase should transition to next
   */
  const shouldTransitionPhase = (timestamp: number): boolean => {
    if (!currentTask) return false;

    const phaseElapsed = timestamp - currentTask.phaseStartTime;
    const expectedDuration = getExpectedPhaseDuration(currentTask.currentPhase);
    
    // Natural progression after expected duration
    if (phaseElapsed >= expectedDuration) {
      return true;
    }

    // Early transition based on progress or performance
    if (currentTask.currentPhase === 'orientation' && currentTask.actualProgress > 0.1) {
      return phaseElapsed >= expectedDuration * 0.5; // Can skip early if making progress
    }

    return false;
  };

  /**
   * Transition to next phase in progression
   */
  const transitionToNextPhase = (timestamp: number): void => {
    if (!currentTask) return;

    // Record current phase completion
    const phaseEntry = {
      phase: currentTask.currentPhase,
      startTime: currentTask.phaseStartTime,
      endTime: timestamp,
      efficiency: calculateCurrentEfficiency(timestamp)
    };
    currentTask.phaseHistory.push(phaseEntry);

    // Move to next phase
    const currentIndex = phases.indexOf(currentTask.currentPhase);
    const nextIndex = (currentIndex + 1) % phases.length;
    
    currentTask.currentPhase = phases[nextIndex];
    currentTask.phaseStartTime = timestamp;
  };

  /**
   * Get expected duration for a phase
   */
  const getExpectedPhaseDuration = (phase: TaskPhase): number => {
    return phaseDurations[phase] || TASK_PARAMETERS.defaultPhaseDurations[phase];
  };

  /**
   * Calculate current task efficiency
   */
  const calculateCurrentEfficiency = (timestamp: number): number => {
    if (!currentTask) return 0.5;

    const baseEfficiency = TASK_PARAMETERS.performanceMultipliers[currentTask.currentPhase];
    
    // Apply modifiers
    const experienceModifier = getLearningCurveMultiplier(currentTask.taskType);
    const complexityModifier = 1 - (currentTask.complexity * 0.3);
    const fatigueModifier = calculateFatigueImpact(timestamp - currentTask.startTime);
    
    return Math.max(0.1, Math.min(1, 
      baseEfficiency * experienceModifier * complexityModifier * fatigueModifier
    ));
  };

  /**
   * Predict completion time based on current progress
   */
  const predictCompletionTime = (timestamp: number): number => {
    if (!currentTask || currentTask.actualProgress === 0) {
      return currentTask?.estimatedDuration || 0;
    }

    const elapsed = timestamp - currentTask.startTime;
    const progressRate = currentTask.actualProgress / elapsed;
    const remainingProgress = 1 - currentTask.actualProgress;
    
    // Adjust for predicted efficiency decline
    const currentEfficiency = calculateCurrentEfficiency(timestamp);
    const avgFutureEfficiency = Math.max(0.5, currentEfficiency * 0.8); // Conservative estimate
    
    return remainingProgress / (progressRate * avgFutureEfficiency);
  };

  /**
   * Calculate optimal continuation time before break/switch needed
   */
  const calculateOptimalContinuationTime = (timestamp: number): number => {
    if (!currentTask) return 0;

    const elapsed = timestamp - currentTask.startTime;
    const currentPhase = currentTask.currentPhase;
    
    // Phase-specific recommendations
    const phaseOptimalLimits = {
      orientation: 10 * 60 * 1000,   // 10 minutes
      adaptation: 25 * 60 * 1000,    // 25 minutes  
      performance: 60 * 60 * 1000,   // 60 minutes
      plateau: 45 * 60 * 1000,       // 45 minutes
      fatigue: 15 * 60 * 1000,       // 15 minutes
      recovery: 5 * 60 * 1000        // 5 minutes
    };

    const phaseRemaining = getExpectedPhaseDuration(currentPhase) - 
                          (timestamp - currentTask.phaseStartTime);
    
    return Math.min(phaseOptimalLimits[currentPhase], phaseRemaining);
  };

  /**
   * Predict which phase task will be in at future time
   */
  const predictPhaseAtTime = (futureTime: number): TaskPhase => {
    if (!currentTask) return 'recovery';

    let simulatedTime = currentTask.phaseStartTime;
    let simulatedPhase = currentTask.currentPhase;
    let phaseIndex = phases.indexOf(simulatedPhase);

    while (simulatedTime < futureTime) {
      const phaseDuration = getExpectedPhaseDuration(simulatedPhase);
      const phaseEnd = simulatedTime + phaseDuration;
      
      if (futureTime <= phaseEnd) {
        break; // Future time is within current simulated phase
      }
      
      // Move to next phase
      simulatedTime = phaseEnd;
      phaseIndex = (phaseIndex + 1) % phases.length;
      simulatedPhase = phases[phaseIndex];
    }

    return simulatedPhase;
  };

  /**
   * Calculate fatigue impact on performance
   */
  const calculateFatigueImpact = (elapsedTime: number): number => {
    const hours = elapsedTime / (60 * 60 * 1000);
    
    // Exponential decay with time, steeper for longer periods
    if (hours < 1) {
      return 1.0; // No fatigue impact in first hour
    } else if (hours < 2) {
      return 1.0 - ((hours - 1) * 0.1); // 10% decline per hour
    } else {
      return Math.max(0.6, 0.9 - ((hours - 1) * 0.15)); // Steeper decline
    }
  };

  /**
   * Get complementary task type for task switching
   */
  const getComplementaryTaskType = (currentTaskType: string): string => {
    // Simple heuristic - in practice this would be more sophisticated
    const complementaryTasks: Record<string, string> = {
      'analytical': 'creative',
      'creative': 'administrative',
      'administrative': 'analytical',
      'communication': 'focused-work',
      'focused-work': 'communication'
    };
    
    return complementaryTasks[currentTaskType] || 'administrative';
  };

  /**
   * Get learning curve data for task type
   */
  const getLearningCurveData = (taskType: string): { attempts: number; averageEfficiency: number } => {
    return learningCurves.get(taskType) || { attempts: 0, averageEfficiency: 0.7 };
  };

  /**
   * Get learning curve multiplier based on experience
   */
  const getLearningCurveMultiplier = (taskType: string): number => {
    const data = getLearningCurveData(taskType);
    
    // Efficiency improves with experience, but levels off
    const experienceBonus = Math.min(0.3, data.attempts * 0.05);
    return Math.min(1.3, 1.0 + experienceBonus);
  };

  /**
   * Update learning curve data after task completion
   */
  const updateLearningCurve = (taskType: string, efficiency: number): void => {
    const existing = learningCurves.get(taskType) || { attempts: 0, averageEfficiency: 0.7 };
    
    const newAttempts = existing.attempts + 1;
    const newAverage = ((existing.averageEfficiency * existing.attempts) + efficiency) / newAttempts;
    
    learningCurves.set(taskType, {
      attempts: newAttempts,
      averageEfficiency: newAverage
    });
  };

  return {
    startTask,
    updateProgress,
    getCurrentMetrics,
    predictPerformanceDecline,
    getOptimalTaskSwitch,
    completeTask,
    getTaskHistory
  };
};