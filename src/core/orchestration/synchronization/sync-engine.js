/**
 * Stream Synchronization Engine - Main Factory
 * Provides unified interface for multimodal data stream synchronization
 * Following functional programming patterns with factory functions
 */

import { SynchronizationStrategy } from './strategies/sync-strategies.js';
import { createHardwareTimestampAligner } from './aligners/hardware-aligner.js';
import { createSoftwareTimestampAligner } from './aligners/software-aligner.js';
import { createBufferBasedAligner } from './aligners/buffer-aligner.js';
import { createEventDrivenAligner } from './aligners/event-aligner.js';
import { createSyncMetrics, createQualityCalculator } from './metrics/sync-metrics.js';

/**
 * Main synchronization engine factory
 * Creates configured synchronization system with pluggable alignment strategies
 */
export const createSynchronizationEngine = (config = {}) => {
  const engineConfig = {
    defaultStrategy: config.defaultStrategy || SynchronizationStrategy.BUFFER_BASED,
    enableQualityMonitoring: config.enableQualityMonitoring !== false,
    maxLatency: config.maxLatency || 50,
    qualityThreshold: config.qualityThreshold || 0.8,
    ...config
  };

  // Strategy registry with lazy initialization
  const aligners = {
    [SynchronizationStrategy.HARDWARE_TIMESTAMP]: null,
    [SynchronizationStrategy.SOFTWARE_TIMESTAMP]: null,
    [SynchronizationStrategy.BUFFER_BASED]: null,
    [SynchronizationStrategy.EVENT_DRIVEN]: null
  };

  const qualityCalculator = engineConfig.enableQualityMonitoring 
    ? createQualityCalculator(engineConfig)
    : null;

  // Lazy aligner creation
  const getAligner = (strategy) => {
    if (!aligners[strategy]) {
      const alignerFactories = {
        [SynchronizationStrategy.HARDWARE_TIMESTAMP]: createHardwareTimestampAligner,
        [SynchronizationStrategy.SOFTWARE_TIMESTAMP]: createSoftwareTimestampAligner,
        [SynchronizationStrategy.BUFFER_BASED]: createBufferBasedAligner,
        [SynchronizationStrategy.EVENT_DRIVEN]: createEventDrivenAligner
      };

      const factory = alignerFactories[strategy];
      if (!factory) {
        throw new Error(`Unknown synchronization strategy: ${strategy}`);
      }

      aligners[strategy] = factory(engineConfig);
    }

    return aligners[strategy];
  };

  // Main synchronization interface
  const synchronize = async (streams, options = {}) => {
    const strategy = options.strategy || engineConfig.defaultStrategy;
    const aligner = getAligner(strategy);
    
    const alignedStreams = [];
    const syncResults = [];

    for (const stream of streams) {
      const alignmentResult = await aligner.align(stream);
      alignedStreams.push({
        ...stream,
        alignedTimestamp: alignmentResult.alignedTimestamp,
        syncQuality: alignmentResult.confidence
      });
      syncResults.push(alignmentResult);
    }

    // Calculate overall synchronization quality
    let overallQuality = null;
    if (qualityCalculator) {
      overallQuality = qualityCalculator.calculateOverallQuality(syncResults);
    }

    return {
      alignedStreams,
      syncResults,
      overallQuality,
      strategy,
      timestamp: Date.now()
    };
  };

  // Strategy switching for adaptive synchronization
  const switchStrategy = (newStrategy) => {
    if (!Object.values(SynchronizationStrategy).includes(newStrategy)) {
      throw new Error(`Invalid synchronization strategy: ${newStrategy}`);
    }
    engineConfig.defaultStrategy = newStrategy;
  };

  // Quality monitoring and diagnostics
  const getQualityMetrics = () => {
    if (!qualityCalculator) {
      return null;
    }

    const metrics = {};
    for (const [strategy, aligner] of Object.entries(aligners)) {
      if (aligner) {
        metrics[strategy] = aligner.getQuality();
      }
    }

    return {
      strategies: metrics,
      overall: qualityCalculator.getOverallMetrics(),
      timestamp: Date.now()
    };
  };

  // Performance diagnostics
  const getDiagnostics = () => {
    return {
      activeStrategies: Object.keys(aligners).filter(key => aligners[key] !== null),
      config: engineConfig,
      qualityEnabled: !!qualityCalculator,
      timestamp: Date.now()
    };
  };

  // Cleanup resources
  const cleanup = async () => {
    for (const aligner of Object.values(aligners)) {
      if (aligner?.cleanup) {
        await aligner.cleanup();
      }
    }
    
    if (qualityCalculator?.cleanup) {
      await qualityCalculator.cleanup();
    }
  };

  return {
    // Core synchronization
    synchronize,
    switchStrategy,
    
    // Quality monitoring
    getQualityMetrics,
    getDiagnostics,
    
    // Strategy access
    getAligner,
    
    // Configuration
    getConfig: () => ({ ...engineConfig }),
    
    // Lifecycle
    cleanup
  };
};

// Temporal alignment algorithm factory (backwards compatibility)
export const createTemporalAligner = (strategy = SynchronizationStrategy.BUFFER_BASED) => {
  const engine = createSynchronizationEngine({ defaultStrategy: strategy });
  return engine.getAligner(strategy);
};