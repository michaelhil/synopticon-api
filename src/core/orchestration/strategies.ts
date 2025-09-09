/**
 * Processing strategies for pipeline orchestration - TypeScript Native
 * Implements different optimization approaches for pipeline selection and execution
 * Strict type safety for all strategy implementations
 */

import type {
  AnalysisRequirements,
  AnalysisResult,
  PerformanceMetrics,
  ModelSize
} from '../configuration/types';

import { createAnalysisResult } from '../configuration/types';

import type { Pipeline } from '../pipeline/pipeline';
import { findCompatiblePipelines, scorePipeline } from '../pipeline/pipeline';

// Strategy interface
export interface Strategy {
  readonly name: string;
  readonly description: string;
  selectPipelines(
    available: ReadonlyArray<Pipeline>, 
    requirements: AnalysisRequirements
  ): ReadonlyArray<string>;
  orchestrate?(
    pipelines: Map<string, Pipeline>, 
    frame: unknown, 
    requirements: AnalysisRequirements
  ): Promise<AnalysisResult>;
  recordPerformance?(metrics: PerformanceMetrics): void;
  getCurrentLevel?(): string;
  getPerformanceHistory?(): ReadonlyArray<PerformanceRecord>;
}

// Performance record for adaptive strategies
export interface PerformanceRecord {
  readonly latency: number;
  readonly fps: number;
  readonly timestamp: number;
}

// Strategy configuration interface
export interface StrategyConfig {
  readonly name: string;
  readonly description?: string;
  selectPipelines(
    available: ReadonlyArray<Pipeline>, 
    requirements: AnalysisRequirements
  ): ReadonlyArray<string>;
  orchestrate?(
    pipelines: Map<string, Pipeline>, 
    frame: unknown, 
    requirements: AnalysisRequirements
  ): Promise<AnalysisResult>;
  recordPerformance?(metrics: PerformanceMetrics): void;
  getCurrentLevel?(): string;
  getPerformanceHistory?(): ReadonlyArray<PerformanceRecord>;
  [key: string]: unknown;
}

// Usage level for scoring
type UsageLevel = 'low' | 'medium' | 'high';

/**
 * Base strategy factory
 */
export const createStrategy = (config: StrategyConfig): Strategy => ({
  name: config.name,
  description: config.description ?? '',
  selectPipelines: config.selectPipelines,
  orchestrate: config.orchestrate,
  recordPerformance: config.recordPerformance,
  getCurrentLevel: config.getCurrentLevel,
  getPerformanceHistory: config.getPerformanceHistory
});

/**
 * Performance-first strategy - prioritizes speed and low latency
 */
export const createPerformanceFirstStrategy = (): Strategy => createStrategy({
  name: 'performance_first',
  description: 'Prioritizes speed, low latency, and high FPS. Best for real-time applications.',
  
  selectPipelines: (available: ReadonlyArray<Pipeline>, requirements: AnalysisRequirements): ReadonlyArray<string> => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    return [...compatible]
      .sort((a, b) => {
        // Primary sort: FPS (higher is better)
        const fpsA = a.config.performance.fps;
        const fpsB = b.config.performance.fps;
        if (fpsB !== fpsA) return fpsB - fpsA;
        
        // Secondary sort: Latency (lower is better)
        const latencyA = parseInt(a.config.performance.latency) || 999;
        const latencyB = parseInt(b.config.performance.latency) || 999;
        if (latencyA !== latencyB) return latencyA - latencyB;
        
        // Tertiary sort: CPU usage (lower is better)
        const cpuScore: Record<UsageLevel, number> = { low: 1, medium: 2, high: 3 };
        const cpuA = cpuScore[a.config.performance.cpuUsage];
        const cpuB = cpuScore[b.config.performance.cpuUsage];
        return cpuA - cpuB;
      })
      .map(pipeline => pipeline.name);
  }
});

/**
 * Accuracy-first strategy - prioritizes precision and detailed analysis
 */
export const createAccuracyFirstStrategy = (): Strategy => createStrategy({
  name: 'accuracy_first',
  description: 'Prioritizes accuracy and detailed analysis. Best for precision applications.',
  
  selectPipelines: (available: ReadonlyArray<Pipeline>, requirements: AnalysisRequirements): ReadonlyArray<string> => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    // Accuracy scoring based on model characteristics
    const getAccuracyScore = (pipeline: Pipeline): number => {
      let score = 0;
      
      // Model size scoring (larger generally more accurate)
      const modelSizeScores: Record<ModelSize, number> = {
        small: 2,
        medium: 5,
        large: 8,
        extra_large: 10,
        unknown: 3
      };
      score += modelSizeScores[pipeline.config.performance.modelSize];
      
      // More capabilities suggest more sophisticated analysis
      score += pipeline.capabilities.length * 2;
      
      // Known accuracy rankings for specific pipelines
      const accuracyRankings: Record<string, number> = {
        'mediapipe-face': 3,
        'mediapipe': 7,
        'opencv': 8,
        'dlib': 9,
        'commercial': 10
      };
      
      Object.keys(accuracyRankings).forEach(key => {
        if (pipeline.name.toLowerCase().includes(key)) {
          score += accuracyRankings[key] ?? 0;
        }
      });
      
      return score;
    };
    
    return [...compatible]
      .sort((a, b) => {
        // Primary sort: Accuracy score (higher is better)
        const accuracyA = getAccuracyScore(a);
        const accuracyB = getAccuracyScore(b);
        if (accuracyB !== accuracyA) return accuracyB - accuracyA;
        
        // Secondary sort: Health status (better health preferred)
        const healthA = a.getHealthStatus().successRate;
        const healthB = b.getHealthStatus().successRate;
        return healthB - healthA;
      })
      .map(pipeline => pipeline.name);
  }
});

/**
 * Battery-optimized strategy - minimizes power consumption
 */
export const createBatteryOptimizedStrategy = (): Strategy => createStrategy({
  name: 'battery_optimized',
  description: 'Minimizes battery drain and resource usage. Best for mobile devices.',
  
  selectPipelines: (available: ReadonlyArray<Pipeline>, requirements: AnalysisRequirements): ReadonlyArray<string> => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    const getBatteryScore = (pipeline: Pipeline): number => {
      let score = 0;
      
      // Battery impact scoring
      const batteryScores: Record<UsageLevel, number> = { low: 10, medium: 5, high: 1 };
      score += batteryScores[pipeline.config.performance.batteryImpact];
      
      // CPU usage scoring  
      const cpuScores: Record<UsageLevel, number> = { low: 8, medium: 4, high: 1 };
      score += cpuScores[pipeline.config.performance.cpuUsage];
      
      // Memory usage scoring
      const memoryScores: Record<UsageLevel, number> = { low: 6, medium: 3, high: 1 };
      score += memoryScores[pipeline.config.performance.memoryUsage];
      
      // Model size penalty (larger models use more battery)
      const modelSizePenalty: Record<ModelSize, number> = {
        small: 0,
        medium: 1,
        large: 3,
        extra_large: 5,
        unknown: 2
      };
      score -= modelSizePenalty[pipeline.config.performance.modelSize];
      
      return Math.max(0, score);
    };
    
    return [...compatible]
      .sort((a, b) => {
        const scoreA = getBatteryScore(a);
        const scoreB = getBatteryScore(b);
        return scoreB - scoreA;
      })
      .map(pipeline => pipeline.name);
  }
});

/**
 * Hybrid strategy - uses different pipelines for different phases
 */
export const createHybridStrategy = (): Strategy => createStrategy({
  name: 'hybrid',
  description: 'Uses fast detection followed by detailed analysis when faces are found.',
  
  selectPipelines: (available: ReadonlyArray<Pipeline>, requirements: AnalysisRequirements): ReadonlyArray<string> => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    // Separate into detection and analysis pipelines
    const detectionPipelines = compatible.filter(p => 
      p.capabilities.includes('face_detection') && 
      p.config.performance.fps > 45
    );
    
    const analysisPipelines = compatible.filter(p => 
      p.capabilities.length > 2 || // Multi-capability pipelines
      p.name.includes('mediapipe') || 
      p.name.includes('opencv')
    );
    
    // Return detection-first, then analysis
    const detectionFirst = detectionPipelines
      .sort((a, b) => b.config.performance.fps - a.config.performance.fps)[0];
    
    const analysisFirst = analysisPipelines
      .sort((a, b) => b.capabilities.length - a.capabilities.length)[0];
    
    const result: string[] = [];
    if (detectionFirst) result.push(detectionFirst.name);
    if (analysisFirst && analysisFirst.name !== detectionFirst?.name) {
      result.push(analysisFirst.name);
    }
    
    return result;
  },
  
  // Custom orchestration for hybrid approach
  orchestrate: async (
    pipelines: Map<string, Pipeline>, 
    frame: unknown, 
    requirements: AnalysisRequirements
  ): Promise<AnalysisResult> => {
    const pipelineList = Array.from(pipelines.values());
    
    // Phase 1: Fast detection
    const fastPipeline = pipelineList.find(p => 
      p.capabilities.includes('face_detection') && 
      p.config.performance.fps > 45
    );
    
    if (!fastPipeline) {
      throw new Error('No fast detection pipeline available');
    }
    
    const detectionResult = await fastPipeline.process(frame);
    
    // If detection failed, return early
    if (detectionResult.status === 'failed') {
      return detectionResult;
    }
    
    // Phase 2: Detailed analysis only if faces found
    const detailedPipeline = pipelineList.find(p => 
      p.capabilities.length > 2 && p.name !== fastPipeline.name
    );
    
    if (detailedPipeline) {
      try {
        const detailedResult = await detailedPipeline.process(frame);
        
        // Merge results, preferring detailed analysis
        if (detailedResult.status === 'success' && detailedResult.data) {
          return createAnalysisResult({
            status: 'success' as const,
            data: detailedResult.data,
            id: `hybrid_${Date.now()}`,
            source: 'hybrid',
            processingTime: (detectionResult.processingTime || 0) + (detailedResult.processingTime || 0),
            timestamp: Date.now(),
            metadata: {
              hybridStages: ['detection', 'analysis'],
              detectionSource: fastPipeline.name,
              analysisSource: detailedPipeline.name
            }
          });
        }
      } catch (error) {
        console.warn('Detailed analysis failed, using detection result:', error);
        return detectionResult;
      }
    }
    
    return detectionResult;
  }
});

/**
 * Adaptive strategy - adjusts based on system performance
 */
export const createAdaptiveStrategy = (): Strategy => {
  let performanceHistory: PerformanceRecord[] = [];
  let currentLevel: 'low' | 'medium' | 'high' = 'high';
  
  return createStrategy({
    name: 'adaptive',
    description: 'Automatically adjusts pipeline selection based on system performance.',
    
    selectPipelines: (available: ReadonlyArray<Pipeline>, requirements: AnalysisRequirements): ReadonlyArray<string> => {
      // Monitor recent performance to adjust strategy
      const recentPerformance = performanceHistory.slice(-10);
      const avgLatency = recentPerformance.length > 0 
        ? recentPerformance.reduce((sum, p) => sum + p.latency, 0) / recentPerformance.length
        : 50;
      
      const avgFPS = recentPerformance.length > 0
        ? recentPerformance.reduce((sum, p) => sum + p.fps, 0) / recentPerformance.length
        : 30;
      
      // Adjust performance level based on metrics
      if (avgLatency > 100 || avgFPS < 20) {
        currentLevel = 'low';
      } else if (avgLatency > 50 || avgFPS < 25) {
        currentLevel = 'medium';
      } else {
        currentLevel = 'high';
      }
      
      // Select pipelines based on current performance level
      const compatible = findCompatiblePipelines(available, requirements);
      
      switch (currentLevel) {
      case 'low':
        // Use only fastest, most efficient pipelines
        return compatible
          .filter(p => p.config.performance.fps > 40)
          .sort((a, b) => b.config.performance.fps - a.config.performance.fps)
          .slice(0, 1)
          .map(p => p.name);
            
      case 'medium':
        // Balance speed and capability
        return compatible
          .filter(p => p.config.performance.fps > 25)
          .sort((a, b) => {
            const performanceReq = { ...requirements, strategy: 'performance_first' as const };
            const scoreA = scorePipeline(a, performanceReq);
            const scoreB = scorePipeline(b, performanceReq);
            return scoreB - scoreA;
          })
          .slice(0, 2)
          .map(p => p.name);
            
      case 'high':
      default:
        // Use best available pipelines
        return [...compatible]
          .sort((a, b) => {
            const scoreA = scorePipeline(a, requirements);
            const scoreB = scorePipeline(b, requirements);
            return scoreB - scoreA;
          })
          .map(p => p.name);
      }
    },
    
    // Track performance for adaptation
    recordPerformance: (metrics: PerformanceMetrics): void => {
      performanceHistory.push({
        latency: metrics.averageProcessingTime || 0,
        fps: metrics.currentFPS || 0,
        timestamp: Date.now()
      });
      
      // Keep only recent history
      if (performanceHistory.length > 50) {
        performanceHistory = performanceHistory.slice(-50);
      }
    },
    
    getCurrentLevel: (): string => currentLevel,
    getPerformanceHistory: (): ReadonlyArray<PerformanceRecord> => [...performanceHistory]
  });
};

/**
 * Strategy registry interface
 */
export interface StrategyRegistry {
  getStrategy(name: string): Strategy | undefined;
  registerStrategy(name: string, strategy: Strategy): void;
  unregisterStrategy(name: string): boolean;
  listStrategies(): ReadonlyArray<string>;
  getAllStrategies(): ReadonlyMap<string, Strategy>;
  getSafeStrategy(name: string): Strategy;
}

/**
 * Strategy registry factory
 */
export const createStrategyRegistry = (): StrategyRegistry => {
  const strategies = new Map<string, Strategy>();
  
  // Register built-in strategies
  strategies.set('performance_first', createPerformanceFirstStrategy());
  strategies.set('accuracy_first', createAccuracyFirstStrategy());
  strategies.set('battery_optimized', createBatteryOptimizedStrategy());
  strategies.set('hybrid', createHybridStrategy());
  strategies.set('adaptive', createAdaptiveStrategy());
  strategies.set('balanced', createPerformanceFirstStrategy());
  
  return {
    getStrategy: (name: string): Strategy | undefined => strategies.get(name),
    
    registerStrategy: (name: string, strategy: Strategy): void => {
      strategies.set(name, strategy);
    },
    
    unregisterStrategy: (name: string): boolean => strategies.delete(name),
    
    listStrategies: (): ReadonlyArray<string> => Array.from(strategies.keys()),
    
    getAllStrategies: (): ReadonlyMap<string, Strategy> => new Map(strategies),
    
    // Get strategy with fallback
    getSafeStrategy: (name: string): Strategy => {
      return strategies.get(name) ?? strategies.get('performance_first')!;
    }
  };
};

/**
 * Strategy constants for easy reference
 */
export const STRATEGIES = {
  PERFORMANCE_FIRST: 'performance_first',
  ACCURACY_FIRST: 'accuracy_first',
  BATTERY_OPTIMIZED: 'battery_optimized',
  HYBRID: 'hybrid',
  ADAPTIVE: 'adaptive',
  BALANCED: 'balanced'
} as const;

export type StrategyName = typeof STRATEGIES[keyof typeof STRATEGIES];

// Type exports (already declared above)
