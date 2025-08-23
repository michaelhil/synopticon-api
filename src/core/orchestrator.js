/**
 * Pipeline orchestrator for managing multiple face analysis pipelines
 * Handles dynamic pipeline selection, fallback strategies, and circuit breaking
 */

import { createAnalysisResult, createErrorResult } from './types.js';
import { findCompatiblePipelines, scorePipeline } from './pipeline.js';

// Circuit breaker for pipeline failure handling
export const createCircuitBreaker = () => {
  const state = {
    failures: new Map(),
    lastFailure: new Map(),
    failureThreshold: 5,
    timeoutMs: 30000 // 30 second cooldown
  };

  const recordFailure = (pipelineId) => {
    const currentFailures = state.failures.get(pipelineId) || 0;
    state.failures.set(pipelineId, currentFailures + 1);
    state.lastFailure.set(pipelineId, Date.now());
  };

  const recordSuccess = (pipelineId) => {
    state.failures.set(pipelineId, 0);
    state.lastFailure.delete(pipelineId);
  };

  const isCircuitOpen = (pipelineId) => {
    const failures = state.failures.get(pipelineId) || 0;
    const lastFailure = state.lastFailure.get(pipelineId) || 0;
    
    return failures >= state.failureThreshold && 
           (Date.now() - lastFailure) < state.timeoutMs;
  };

  const executeWithBreaker = async (pipelineId, operation) => {
    if (isCircuitOpen(pipelineId)) {
      throw new Error(`Circuit breaker open for pipeline: ${pipelineId}`);
    }

    try {
      const result = await operation();
      recordSuccess(pipelineId);
      return result;
    } catch (error) {
      recordFailure(pipelineId);
      throw error;
    }
  };

  return {
    executeWithBreaker,
    isCircuitOpen,
    recordSuccess,
    recordFailure,
    getState: () => ({ 
      failures: new Map(state.failures),
      lastFailure: new Map(state.lastFailure)
    })
  };
};

// Main orchestrator factory
export const createOrchestrator = (config = {}) => {
  const state = {
    pipelines: new Map(),
    activeStrategy: null,
    defaultRequirements: config.defaultRequirements || {
      capabilities: [],
      strategy: 'performance_first',
      maxLatency: 100,
      targetFPS: 30,
      realtime: true
    },
    circuitBreaker: createCircuitBreaker(),
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0
    }
  };

  // Pipeline management
  const registerPipeline = async (pipeline) => {
    if (!pipeline.name) {
      throw new Error('Pipeline must have a name');
    }
    
    state.pipelines.set(pipeline.name, pipeline);
    
    // Initialize pipeline if not already done
    if (!pipeline.isInitialized()) {
      await pipeline.initialize(config.pipelineConfigs?.[pipeline.name] || {});
    }
    
    return true;
  };

  const unregisterPipeline = async (pipelineName) => {
    const pipeline = state.pipelines.get(pipelineName);
    if (pipeline) {
      await pipeline.cleanup();
      state.pipelines.delete(pipelineName);
      return true;
    }
    return false;
  };

  const getAvailablePipelines = () => {
    return Array.from(state.pipelines.values()).map(pipeline => ({
      name: pipeline.name,
      capabilities: pipeline.capabilities,
      performance: pipeline.performance,
      health: pipeline.getHealthStatus(),
      metrics: pipeline.getPerformanceMetrics()
    }));
  };

  // Pipeline selection and ranking
  const selectOptimalPipelines = (requirements = state.defaultRequirements) => {
    const available = Array.from(state.pipelines.values());
    const compatible = findCompatiblePipelines(available, requirements);
    
    if (compatible.length === 0) {
      throw new Error(`No pipelines available for capabilities: ${requirements.capabilities.join(', ')}`);
    }

    // Score and rank pipelines
    const scored = compatible
      .filter(pipeline => !state.circuitBreaker.isCircuitOpen(pipeline.name))
      .map(pipeline => ({
        pipeline,
        score: scorePipeline(pipeline, requirements)
      }))
      .sort((a, b) => b.score - a.score);

    return scored.map(item => item.pipeline);
  };

  // Main processing with fallback
  const process = async (frame, requirements) => {
    const startTime = performance.now();
    state.metrics.totalRequests++;

    try {
      const rankedPipelines = selectOptimalPipelines(requirements);
      let lastError = null;

      for (const pipeline of rankedPipelines) {
        try {
          const result = await state.circuitBreaker.executeWithBreaker(
            pipeline.name,
            () => pipeline.process(frame)
          );

          // Update metrics
          const latency = performance.now() - startTime;
          state.metrics.successfulRequests++;
          state.metrics.averageLatency = 
            (state.metrics.averageLatency * (state.metrics.totalRequests - 1) + latency) / 
            state.metrics.totalRequests;

          return result;
        } catch (error) {
          console.warn(`Pipeline ${pipeline.name} failed:`, error.message);
          lastError = error;
          await handlePipelineFailure(pipeline.name, error);
          continue;
        }
      }

      // All pipelines failed
      state.metrics.failedRequests++;
      throw new Error(`All pipelines failed. Last error: ${lastError?.message || 'Unknown'}`);

    } catch (error) {
      state.metrics.failedRequests++;
      return createErrorResult(error, 'orchestrator');
    }
  };

  // Pipeline failure handling
  const handlePipelineFailure = async (pipelineId, error) => {
    const pipeline = state.pipelines.get(pipelineId);
    if (!pipeline) return;

    const healthStatus = pipeline.getHealthStatus();
    
    // If pipeline is consistently failing, try to reinitialize
    if (healthStatus.errorCount > 10 && healthStatus.successRate < 0.5) {
      console.warn(`Attempting to reinitialize failing pipeline: ${pipelineId}`);
      try {
        await pipeline.cleanup();
        await pipeline.initialize(config.pipelineConfigs?.[pipelineId] || {});
      } catch (reinitError) {
        console.error(`Failed to reinitialize pipeline ${pipelineId}:`, reinitError);
      }
    }
  };

  // System health and metrics
  const getHealthStatus = () => {
    const pipelineHealth = Array.from(state.pipelines.values())
      .map(p => p.getHealthStatus());
    
    const healthyCount = pipelineHealth.filter(h => h.status === 'healthy').length;
    const totalCount = pipelineHealth.length;
    
    return {
      status: healthyCount > 0 ? 'healthy' : 'degraded',
      healthyPipelines: healthyCount,
      totalPipelines: totalCount,
      successRate: state.metrics.successfulRequests / state.metrics.totalRequests || 0,
      averageLatency: state.metrics.averageLatency,
      circuitBreakerState: state.circuitBreaker.getState(),
      timestamp: Date.now()
    };
  };

  const getPerformanceMetrics = () => ({
    totalRequests: state.metrics.totalRequests,
    successfulRequests: state.metrics.successfulRequests,
    failedRequests: state.metrics.failedRequests,
    successRate: state.metrics.successfulRequests / state.metrics.totalRequests || 0,
    averageLatency: state.metrics.averageLatency,
    activePipelines: state.pipelines.size,
    timestamp: Date.now()
  });

  // Configuration management
  const configure = (requirements) => {
    state.defaultRequirements = { ...state.defaultRequirements, ...requirements };
    return true;
  };

  const setStrategy = (strategy) => {
    state.activeStrategy = strategy;
    state.defaultRequirements.strategy = strategy;
    return true;
  };

  return {
    // Pipeline management
    registerPipeline,
    unregisterPipeline,
    getAvailablePipelines,
    
    // Processing
    process,
    selectOptimalPipelines,
    
    // Configuration
    configure,
    setStrategy,
    
    // Health and metrics
    getHealthStatus,
    getPerformanceMetrics,
    
    // Utilities
    getPipeline: (name) => state.pipelines.get(name),
    getPipelineCount: () => state.pipelines.size,
    
    // Cleanup
    cleanup: async () => {
      const cleanupPromises = Array.from(state.pipelines.values())
        .map(pipeline => pipeline.cleanup());
      await Promise.allSettled(cleanupPromises);
      state.pipelines.clear();
    }
  };
};