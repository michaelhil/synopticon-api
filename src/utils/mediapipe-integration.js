/**
 * MediaPipe Integration Utilities
 * Helper functions for integrating MediaPipe pipelines with existing demo
 */

import { createOrchestrator } from '../core/orchestrator.js';
import { createStrategyRegistry } from '../core/strategies.js';
import { createPipelineRegistry, autoRegisterBuiltins } from '../core/registry.js';
import { createMediaPipePipeline } from '../pipelines/mediapipe-pipeline.js';
import { createIrisTrackingPipeline } from '../pipelines/iris-tracking-pipeline.js';
import { createPoseCalibrator } from './pose-calibration.js';

// Create enhanced orchestrator with MediaPipe support
export const createEnhancedOrchestrator = async (config = {}) => {
  try {
    // Create pipeline registry
    const registry = createPipelineRegistry();
    
    // Auto-register built-in pipelines (including MediaPipe)
    await autoRegisterBuiltins(registry);
    
    // Create orchestrator
    const orchestrator = createOrchestrator(config.orchestrator);
    
    // Register MediaPipe pipelines with orchestrator
    try {
      const mediaPipePipeline = await registry.create('mediapipe', config.mediapipe || {});
      await orchestrator.registerPipeline(mediaPipePipeline);
      console.log('✅ MediaPipe Face Mesh registered with orchestrator');
    } catch (error) {
      console.warn('⚠️ MediaPipe Face Mesh not available:', error.message);
    }
    
    try {
      const irisPipeline = await registry.create('iris', config.iris || {});
      await orchestrator.registerPipeline(irisPipeline);
      console.log('✅ MediaPipe Iris registered with orchestrator');
    } catch (error) {
      console.warn('⚠️ MediaPipe Iris not available:', error.message);
    }
    
    // Try to register BlazeFace as fallback
    try {
      const blazeFacePipeline = await registry.create('blazeface', config.blazeface || {});
      await orchestrator.registerPipeline(blazeFacePipeline);
      console.log('✅ BlazeFace registered with orchestrator');
    } catch (error) {
      console.warn('⚠️ BlazeFace registration failed:', error.message);
    }
    
    return {
      orchestrator,
      registry,
      strategyRegistry: createStrategyRegistry()
    };
    
  } catch (error) {
    console.error('Enhanced orchestrator creation failed:', error);
    throw error;
  }
};

// Demo integration utilities
export const createDemoIntegration = (existingDemo, orchestrator) => {
  let poseCalibrator = createPoseCalibrator();
  let currentStrategy = 'performance_first';
  
  // Enhanced face processing with MediaPipe support
  const processFrame = async (videoElement) => {
    try {
      // Create analysis requirements based on current strategy
      const requirements = {
        capabilities: ['face_detection', 'pose_estimation_6dof'],
        strategy: currentStrategy,
        realtime: true
      };
      
      // Process frame with orchestrator
      const result = await orchestrator.process(videoElement, requirements);
      
      if (result.faces && result.faces.length > 0) {
        const face = result.faces[0];
        
        // Apply pose calibration if available
        if (face.pose && poseCalibrator.isCalibrated()) {
          face.pose = poseCalibrator.applyCalibratedPose(face.pose, face.landmarks);
        }
        
        // Call existing demo visualization
        if (existingDemo && existingDemo.updateVisualization) {
          existingDemo.updateVisualization({
            faces: [face],
            source: result.source,
            processingTime: result.processingTime,
            enhanced: true
          });
        }
        
        return {
          faces: [face],
          enhanced: true,
          pipelineUsed: result.source,
          processingTime: result.processingTime
        };
      }
      
      return { faces: [], enhanced: true };
      
    } catch (error) {
      console.warn('Enhanced frame processing failed:', error);
      // Fallback to existing demo processing if available
      if (existingDemo && existingDemo.processFrame) {
        return existingDemo.processFrame(videoElement);
      }
      return { faces: [], error: error.message };
    }
  };
  
  // Strategy switching
  const switchStrategy = (newStrategy) => {
    currentStrategy = newStrategy;
    console.log(`Switched to ${newStrategy} strategy`);
  };
  
  // Calibration integration
  const startCalibration = () => {
    return poseCalibrator.startCalibration();
  };
  
  const finishCalibration = () => {
    try {
      const result = poseCalibrator.finishCalibration();
      console.log('Calibration completed:', result);
      return result;
    } catch (error) {
      console.error('Calibration failed:', error);
      throw error;
    }
  };
  
  const addCalibrationSample = (pose, landmarks) => {
    return poseCalibrator.addSample(pose, landmarks);
  };
  
  // Auto-calibration integration
  const setupAutoCalibration = () => {
    const autoCalibration = poseCalibrator.autoCalibrate();
    let frameCount = 0;
    
    return {
      processAutoCalibrationFrame: (pose, landmarks) => {
        frameCount++;
        return autoCalibration.processFrame(pose, landmarks);
      },
      getFrameCount: () => frameCount,
      reset: () => { frameCount = 0; }
    };
  };
  
  return {
    processFrame,
    switchStrategy,
    startCalibration,
    finishCalibration,
    addCalibrationSample,
    setupAutoCalibration,
    getCurrentStrategy: () => currentStrategy,
    isCalibrated: () => poseCalibrator.isCalibrated(),
    resetCalibration: () => poseCalibrator.reset(),
    getOrchestratorHealth: () => orchestrator.getHealthStatus(),
    getPerformanceMetrics: () => orchestrator.getPerformanceMetrics()
  };
};

// Strategy configuration for different use cases
export const DEMO_STRATEGIES = {
  performance: {
    name: 'performance_first',
    description: 'Fast processing with BlazeFace',
    capabilities: ['face_detection', 'pose_estimation_3dof']
  },
  accuracy: {
    name: 'accuracy_first', 
    description: 'High accuracy with MediaPipe',
    capabilities: ['face_detection', 'pose_estimation_6dof', 'landmark_detection']
  },
  eyeTracking: {
    name: 'accuracy_first',
    description: 'Eye tracking with MediaPipe Iris',
    capabilities: ['face_detection', 'eye_tracking', 'pose_estimation_6dof']
  },
  hybrid: {
    name: 'hybrid',
    description: 'Adaptive processing based on conditions',
    capabilities: ['face_detection', 'pose_estimation_6dof']
  }
};

// Check MediaPipe availability
export const checkMediaPipeAvailability = () => {
  const availability = {
    faceMesh: false,
    iris: false,
    baseMediaPipe: false,
    errors: []
  };
  
  try {
    // Check for MediaPipe base
    if (typeof window !== 'undefined' && window.mediapipe) {
      availability.baseMediaPipe = true;
      
      // Check for Face Mesh
      if (window.mediapipe.FaceMesh) {
        availability.faceMesh = true;
      } else {
        availability.errors.push('MediaPipe Face Mesh not found');
      }
      
      // Check for Iris
      if (window.mediapipe.Iris) {
        availability.iris = true;
      } else {
        availability.errors.push('MediaPipe Iris not found');
      }
    } else {
      availability.errors.push('MediaPipe library not loaded');
    }
  } catch (error) {
    availability.errors.push(`MediaPipe check failed: ${error.message}`);
  }
  
  return availability;
};

// Performance comparison utility
export const createPerformanceComparison = () => {
  const metrics = new Map();
  
  const recordMetrics = (pipelineName, processingTime, accuracy = null) => {
    if (!metrics.has(pipelineName)) {
      metrics.set(pipelineName, {
        samples: [],
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        accuracy: accuracy ? [accuracy] : []
      });
    }
    
    const pipelineMetrics = metrics.get(pipelineName);
    pipelineMetrics.samples.push(processingTime);
    pipelineMetrics.totalTime += processingTime;
    pipelineMetrics.averageTime = pipelineMetrics.totalTime / pipelineMetrics.samples.length;
    pipelineMetrics.minTime = Math.min(pipelineMetrics.minTime, processingTime);
    pipelineMetrics.maxTime = Math.max(pipelineMetrics.maxTime, processingTime);
    
    if (accuracy !== null) {
      pipelineMetrics.accuracy.push(accuracy);
    }
    
    // Keep only recent samples
    if (pipelineMetrics.samples.length > 100) {
      pipelineMetrics.samples = pipelineMetrics.samples.slice(-100);
      pipelineMetrics.accuracy = pipelineMetrics.accuracy.slice(-100);
    }
  };
  
  const getComparison = () => {
    const comparison = {};
    
    for (const [name, data] of metrics) {
      comparison[name] = {
        averageTime: data.averageTime,
        minTime: data.minTime,
        maxTime: data.maxTime,
        fps: data.averageTime > 0 ? Math.round(1000 / data.averageTime) : 0,
        sampleCount: data.samples.length,
        averageAccuracy: data.accuracy.length > 0 ? 
          data.accuracy.reduce((a, b) => a + b) / data.accuracy.length : null
      };
    }
    
    return comparison;
  };
  
  const getBestPerformer = (metric = 'averageTime') => {
    let best = null;
    let bestValue = metric === 'averageTime' ? Infinity : -Infinity;
    
    for (const [name, data] of metrics) {
      const value = data[metric];
      const isBetter = metric === 'averageTime' ? value < bestValue : value > bestValue;
      
      if (isBetter) {
        best = name;
        bestValue = value;
      }
    }
    
    return best;
  };
  
  return {
    recordMetrics,
    getComparison,
    getBestPerformer,
    clear: () => metrics.clear()
  };
};