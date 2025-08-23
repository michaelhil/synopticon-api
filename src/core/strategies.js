/**
 * Processing strategies for pipeline orchestration
 * Implements different optimization approaches for pipeline selection and execution
 */

import { findCompatiblePipelines, scorePipeline } from './pipeline.js';

// Base strategy interface
export const createStrategy = (config) => ({
  name: config.name,
  selectPipelines: config.selectPipelines,
  orchestrate: config.orchestrate || null,
  description: config.description || '',
  ...config
});

// Performance-first strategy - prioritizes speed and low latency
export const createPerformanceFirstStrategy = () => createStrategy({
  name: 'performance_first',
  description: 'Prioritizes speed, low latency, and high FPS. Best for real-time applications.',
  
  selectPipelines: (available, requirements) => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    return compatible
      .sort((a, b) => {
        // Primary sort: FPS (higher is better)
        const fpsA = a.performance?.fps || 0;
        const fpsB = b.performance?.fps || 0;
        if (fpsB !== fpsA) return fpsB - fpsA;
        
        // Secondary sort: Latency (lower is better)
        const latencyA = parseInt(a.performance?.latency) || 999;
        const latencyB = parseInt(b.performance?.latency) || 999;
        if (latencyA !== latencyB) return latencyA - latencyB;
        
        // Tertiary sort: CPU usage (lower is better)
        const cpuScore = { low: 1, medium: 2, high: 3 };
        const cpuA = cpuScore[a.performance?.cpuUsage] || 2;
        const cpuB = cpuScore[b.performance?.cpuUsage] || 2;
        return cpuA - cpuB;
      })
      .map(pipeline => pipeline.name);
  }
});

// Accuracy-first strategy - prioritizes precision and detailed analysis
export const createAccuracyFirstStrategy = () => createStrategy({
  name: 'accuracy_first',
  description: 'Prioritizes accuracy and detailed analysis. Best for precision applications.',
  
  selectPipelines: (available, requirements) => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    // Accuracy scoring based on model characteristics
    const getAccuracyScore = (pipeline) => {
      let score = 0;
      
      // Larger models generally more accurate
      const modelSize = pipeline.performance?.modelSize || '0MB';
      const sizeMB = parseFloat(modelSize.replace('MB', ''));
      score += Math.min(sizeMB / 10, 10); // Cap at 10 points
      
      // More capabilities suggest more sophisticated analysis
      score += pipeline.capabilities.length * 2;
      
      // Known accuracy rankings for specific pipelines
      const accuracyRankings = {
        'blazeface': 3,
        'mediapipe': 7,
        'opencv': 8,
        'dlib': 9,
        'commercial': 10
      };
      
      Object.keys(accuracyRankings).forEach(key => {
        if (pipeline.name.toLowerCase().includes(key)) {
          score += accuracyRankings[key];
        }
      });
      
      return score;
    };
    
    return compatible
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

// Battery-optimized strategy - minimizes power consumption
export const createBatteryOptimizedStrategy = () => createStrategy({
  name: 'battery_optimized',
  description: 'Minimizes battery drain and resource usage. Best for mobile devices.',
  
  selectPipelines: (available, requirements) => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    const getBatteryScore = (pipeline) => {
      let score = 0;
      
      // Battery impact scoring
      const batteryScores = { low: 10, medium: 5, high: 1 };
      score += batteryScores[pipeline.performance?.batteryImpact] || 5;
      
      // CPU usage scoring  
      const cpuScores = { low: 8, medium: 4, high: 1 };
      score += cpuScores[pipeline.performance?.cpuUsage] || 4;
      
      // Memory usage scoring
      const memoryScores = { low: 6, medium: 3, high: 1 };
      score += memoryScores[pipeline.performance?.memoryUsage] || 3;
      
      // Model size penalty (larger models use more battery)
      const modelSize = pipeline.performance?.modelSize || '0MB';
      const sizeMB = parseFloat(modelSize.replace('MB', ''));
      score -= Math.min(sizeMB / 5, 5); // Penalty up to 5 points
      
      return Math.max(0, score);
    };
    
    return compatible
      .sort((a, b) => {
        const scoreA = getBatteryScore(a);
        const scoreB = getBatteryScore(b);
        return scoreB - scoreA;
      })
      .map(pipeline => pipeline.name);
  }
});

// Hybrid strategy - uses different pipelines for different phases
export const createHybridStrategy = () => createStrategy({
  name: 'hybrid',
  description: 'Uses fast detection followed by detailed analysis when faces are found.',
  
  selectPipelines: (available, requirements) => {
    const compatible = findCompatiblePipelines(available, requirements);
    
    // Separate into detection and analysis pipelines
    const detectionPipelines = compatible.filter(p => 
      p.capabilities.includes('face_detection') && 
      (p.performance?.fps || 0) > 45
    );
    
    const analysisPipelines = compatible.filter(p => 
      p.capabilities.length > 2 || // Multi-capability pipelines
      p.name.includes('mediapipe') || 
      p.name.includes('opencv')
    );
    
    // Return detection-first, then analysis
    const detectionFirst = detectionPipelines
      .sort((a, b) => (b.performance?.fps || 0) - (a.performance?.fps || 0))[0];
    
    const analysisFirst = analysisPipelines
      .sort((a, b) => b.capabilities.length - a.capabilities.length)[0];
    
    const result = [];
    if (detectionFirst) result.push(detectionFirst.name);
    if (analysisFirst && analysisFirst.name !== detectionFirst?.name) {
      result.push(analysisFirst.name);
    }
    
    return result;
  },
  
  // Custom orchestration for hybrid approach
  orchestrate: async (pipelines, frame, requirements) => {
    const pipelineList = Array.from(pipelines.values());
    
    // Phase 1: Fast detection
    const fastPipeline = pipelineList.find(p => 
      p.capabilities.includes('face_detection') && 
      (p.performance?.fps || 0) > 45
    );
    
    if (!fastPipeline) {
      throw new Error('No fast detection pipeline available');
    }
    
    const detectionResult = await fastPipeline.process(frame);
    
    // If no faces detected, return early
    if (!detectionResult.faces || detectionResult.faces.length === 0) {
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
        return {
          ...detailedResult,
          faces: detailedResult.faces.map((face, index) => ({
            ...face,
            // Preserve high-confidence detection bbox if detailed analysis failed
            bbox: face.confidence > 0.3 ? face.bbox : 
                  (detectionResult.faces[index]?.bbox || face.bbox)
          })),
          metadata: {
            ...detailedResult.metadata,
            hybridStages: ['detection', 'analysis'],
            detectionSource: fastPipeline.name,
            analysisSource: detailedPipeline.name
          }
        };
      } catch (error) {
        console.warn('Detailed analysis failed, using detection result:', error);
        return detectionResult;
      }
    }
    
    return detectionResult;
  }
});

// Adaptive strategy - adjusts based on system performance
export const createAdaptiveStrategy = () => {
  let performanceHistory = [];
  let currentLevel = 'high';
  
  return createStrategy({
    name: 'adaptive',
    description: 'Automatically adjusts pipeline selection based on system performance.',
    
    selectPipelines: (available, requirements) => {
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
            .filter(p => (p.performance?.fps || 0) > 40)
            .sort((a, b) => (b.performance?.fps || 0) - (a.performance?.fps || 0))
            .slice(0, 1)
            .map(p => p.name);
            
        case 'medium':
          // Balance speed and capability
          return compatible
            .filter(p => (p.performance?.fps || 0) > 25)
            .sort((a, b) => {
              const scoreA = scorePipeline(a, { ...requirements, strategy: 'performance_first' });
              const scoreB = scorePipeline(b, { ...requirements, strategy: 'performance_first' });
              return scoreB - scoreA;
            })
            .slice(0, 2)
            .map(p => p.name);
            
        case 'high':
        default:
          // Use best available pipelines
          return compatible
            .sort((a, b) => {
              const scoreA = scorePipeline(a, requirements);
              const scoreB = scorePipeline(b, requirements);
              return scoreB - scoreA;
            })
            .map(p => p.name);
      }
    },
    
    // Track performance for adaptation
    recordPerformance: (metrics) => {
      performanceHistory.push({
        latency: metrics.averageLatency || 0,
        fps: metrics.currentFPS || 0,
        timestamp: Date.now()
      });
      
      // Keep only recent history
      if (performanceHistory.length > 50) {
        performanceHistory = performanceHistory.slice(-50);
      }
    },
    
    getCurrentLevel: () => currentLevel,
    getPerformanceHistory: () => [...performanceHistory]
  });
};

// Strategy registry
export const createStrategyRegistry = () => {
  const strategies = new Map();
  
  // Register built-in strategies
  strategies.set('performance_first', createPerformanceFirstStrategy());
  strategies.set('accuracy_first', createAccuracyFirstStrategy());
  strategies.set('battery_optimized', createBatteryOptimizedStrategy());
  strategies.set('hybrid', createHybridStrategy());
  strategies.set('adaptive', createAdaptiveStrategy());
  
  return {
    get: (name) => strategies.get(name),
    register: (name, strategy) => strategies.set(name, strategy),
    unregister: (name) => strategies.delete(name),
    list: () => Array.from(strategies.keys()),
    getAll: () => new Map(strategies),
    
    // Get strategy with fallback
    getSafe: (name) => strategies.get(name) || strategies.get('performance_first')
  };
};

// Export available strategies for easy access
export const STRATEGIES = {
  PERFORMANCE_FIRST: 'performance_first',
  ACCURACY_FIRST: 'accuracy_first',
  BATTERY_OPTIMIZED: 'battery_optimized',
  HYBRID: 'hybrid',
  ADAPTIVE: 'adaptive'
};