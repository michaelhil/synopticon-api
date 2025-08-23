/**
 * Core pipeline interface and factory for face analysis systems
 * Following functional programming patterns with standardized lifecycle
 */

import { 
  createHealthStatus, 
  createPerformanceMetrics, 
  createAnalysisResult,
  createErrorResult 
} from './types.js';

// Standard pipeline interface factory
export const createPipeline = (config) => {
  const state = {
    name: config.name,
    capabilities: config.capabilities || [],
    performance: config.performance,
    initialized: false,
    healthy: true,
    lastProcessTime: 0,
    processedFrames: 0,
    errorCount: 0,
    successCount: 0
  };

  // Core lifecycle methods
  const initialize = async (pipelineConfig) => {
    try {
      if (config.initialize) {
        await config.initialize(pipelineConfig);
      }
      state.initialized = true;
      state.healthy = true;
      return true;
    } catch (error) {
      state.healthy = false;
      state.errorCount++;
      throw error;
    }
  };

  const process = async (frame) => {
    if (!state.initialized) {
      throw new Error(`Pipeline ${state.name} not initialized`);
    }

    const startTime = performance.now();
    
    try {
      const result = await config.process(frame);
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.lastProcessTime = processingTime;
      state.processedFrames++;
      state.successCount++;
      
      return {
        ...result,
        source: state.name,
        processingTime,
        timestamp: Date.now()
      };
    } catch (error) {
      state.errorCount++;
      state.healthy = state.errorCount / (state.errorCount + state.successCount) < 0.1;
      
      return createErrorResult(error, state.name);
    }
  };

  const cleanup = async () => {
    try {
      if (config.cleanup) {
        await config.cleanup();
      }
      state.initialized = false;
      return true;
    } catch (error) {
      console.warn(`Cleanup failed for pipeline ${state.name}:`, error);
      return false;
    }
  };

  const getHealthStatus = () => createHealthStatus({
    status: state.healthy ? 'healthy' : 'degraded',
    lastCheck: Date.now(),
    errorCount: state.errorCount,
    successRate: state.successCount / (state.successCount + state.errorCount) || 0,
    averageLatency: state.lastProcessTime,
    isCircuitOpen: !state.healthy
  });

  const getPerformanceMetrics = () => createPerformanceMetrics({
    processedFrames: state.processedFrames,
    averageProcessingTime: state.lastProcessTime,
    currentFPS: state.lastProcessTime > 0 ? 1000 / state.lastProcessTime : 0,
    timestamp: Date.now()
  });

  // Pipeline validation
  const isCapable = (requiredCapabilities) => 
    requiredCapabilities.every(cap => state.capabilities.includes(cap));

  const supportsRealtime = () => 
    state.performance?.fps >= 30 && state.performance?.latency <= 100;

  return {
    // Core interface
    name: state.name,
    capabilities: [...state.capabilities],
    performance: state.performance,
    
    // Lifecycle methods
    initialize,
    process,
    cleanup,
    
    // Health and metrics
    getHealthStatus,
    getPerformanceMetrics,
    
    // Capability queries
    isCapable,
    supportsRealtime,
    
    // State queries
    isInitialized: () => state.initialized,
    isHealthy: () => state.healthy
  };
};

// Pipeline validation utilities
export const validatePipelineConfig = (config) => {
  const required = ['name', 'capabilities', 'performance', 'process'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Pipeline config missing required fields: ${missing.join(', ')}`);
  }
  
  if (typeof config.process !== 'function') {
    throw new Error('Pipeline config.process must be a function');
  }
  
  return true;
};

// Pipeline capability matching utilities
export const findCompatiblePipelines = (pipelines, requirements) => {
  return pipelines.filter(pipeline => 
    pipeline.isCapable(requirements.capabilities) &&
    (!requirements.realtime || pipeline.supportsRealtime()) &&
    pipeline.isHealthy()
  );
};

// Pipeline scoring for selection optimization
export const scorePipeline = (pipeline, requirements) => {
  let score = 0;
  
  // Capability completeness (higher is better)
  const capabilityRatio = requirements.capabilities.length / pipeline.capabilities.length;
  score += capabilityRatio * 100;
  
  // Performance score based on strategy
  switch (requirements.strategy) {
    case 'performance_first':
      score += pipeline.performance?.fps || 0;
      score -= parseInt(pipeline.performance?.latency) || 0;
      break;
    case 'accuracy_first':
      // Higher accuracy pipelines get bonus (would need accuracy metadata)
      score += (pipeline.performance?.modelSize > 5000000) ? 50 : 0;
      break;
    case 'battery_optimized':
      score += (pipeline.performance?.batteryImpact === 'low') ? 100 : 0;
      score += (pipeline.performance?.cpuUsage === 'low') ? 50 : 0;
      break;
  }
  
  // Health penalty
  const healthStatus = pipeline.getHealthStatus();
  score *= healthStatus.successRate;
  
  return score;
};