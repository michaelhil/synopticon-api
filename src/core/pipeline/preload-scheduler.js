/**
 * Intelligent preloading scheduler for pipelines
 */

import { PreloadingStrategies } from './preloader-config.js';
import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js';
import { showLoadingToast } from '../../shared/utils/ui/loading-components.js';

export const createPreloadScheduler = (registry, stateManager, usageTracker, config) => {
  const preloadQueue = [];
  const activePreloads = new Set();
  const preloadListeners = new Set();

  /**
   * Schedule intelligent preloading based on context and usage
   */
  const scheduleIntelligentPreloading = () => {
    if (!config.enableIntelligentPreloading || !registry) return;

    // Get all available pipeline types
    const availableTypes = registry.getAvailablePipelineTypes();
    
    // Calculate priorities
    const priorities = availableTypes.map(type => ({
      type,
      priority: usageTracker.calculatePreloadPriority(type),
      loaded: registry.isPipelineLoaded(type)
    }));
    
    // Filter and sort by priority
    const candidates = priorities
      .filter(p => !p.loaded && p.priority > 0.2) // Only preload if priority > 20%
      .sort((a, b) => b.priority - a.priority);
    
    // Preload top candidates (respecting concurrency limits)
    for (const candidate of candidates) {
      if (activePreloads.size >= config.maxConcurrentPreloads) {
        break;
      }
      
      preloadPipeline(candidate.type, PreloadingStrategies.USAGE_BASED);
    }
  };

  /**
   * Preload a specific pipeline
   * @param {string} pipelineType - Pipeline type to preload
   * @param {string} strategy - Preloading strategy
   * @returns {Promise<boolean>} - Success status
   */
  const preloadPipeline = async (pipelineType, strategy = PreloadingStrategies.IMMEDIATE) => {
    if (!registry) {
      handleError(
        'Cannot preload pipeline: Registry not initialized',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR
      );
      return false;
    }

    if (registry.isPipelineLoaded(pipelineType)) {
      return true; // Already loaded
    }

    if (activePreloads.has(pipelineType)) {
      return false; // Already preloading
    }

    activePreloads.add(pipelineType);
    
    try {
      // Show loading notification if configured
      if (config.showLoadingNotifications) {
        showLoadingToast(`Preloading ${pipelineType}...`, { duration: 2000 });
      }

      // Update state manager
      if (stateManager) {
        stateManager.updateLoadingState(pipelineType, 'preloading');
      }

      // Notify listeners
      notifyPreloadListeners({
        type: 'preload_started',
        pipelineType,
        strategy,
        timestamp: Date.now()
      });

      // Load the pipeline
      const pipeline = await registry.get(pipelineType);
      
      if (pipeline) {
        // Initialize if needed
        if (pipeline.initialize && typeof pipeline.initialize === 'function') {
          await pipeline.initialize();
        }

        // Update state manager
        if (stateManager) {
          stateManager.updateLoadingState(pipelineType, 'preloaded');
        }

        // Notify listeners
        notifyPreloadListeners({
          type: 'preload_completed',
          pipelineType,
          strategy,
          timestamp: Date.now()
        });

        handleError(
          `Pipeline preloaded successfully: ${pipelineType}`,
          ErrorCategory.PIPELINE,
          ErrorSeverity.INFO,
          { strategy }
        );

        return true;
      }

      return false;

    } catch (error) {
      handleError(
        `Pipeline preloading failed: ${pipelineType}`,
        ErrorCategory.PIPELINE,
        ErrorSeverity.ERROR,
        { error: error.message, strategy }
      );

      // Update state manager
      if (stateManager) {
        stateManager.updateLoadingState(pipelineType, 'error');
      }

      // Notify listeners
      notifyPreloadListeners({
        type: 'preload_failed',
        pipelineType,
        strategy,
        error: error.message,
        timestamp: Date.now()
      });

      return false;
    } finally {
      activePreloads.delete(pipelineType);
    }
  };

  /**
   * Check if a pipeline should be preloaded
   * @param {string} pipelineType - Pipeline type
   * @returns {boolean} - Should preload
   */
  const shouldPreload = (pipelineType) => {
    if (!config.enableIntelligentPreloading) return false;
    if (!registry || registry.isPipelineLoaded(pipelineType)) return false;
    if (activePreloads.has(pipelineType)) return false;

    const priority = usageTracker.calculatePreloadPriority(pipelineType);
    return priority > 0.2;
  };

  /**
   * Notify preload listeners
   * @param {Object} event - Preload event
   */
  const notifyPreloadListeners = (event) => {
    preloadListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Preload listener error:', error);
      }
    });
  };

  /**
   * Add preload event listener
   * @param {Function} listener - Event listener
   * @returns {Function} - Unsubscribe function
   */
  const onPreloadEvent = (listener) => {
    preloadListeners.add(listener);
    return () => preloadListeners.delete(listener);
  };

  /**
   * Get preload statistics
   */
  const getPreloadStatistics = () => {
    return {
      activePreloads: activePreloads.size,
      queueSize: preloadQueue.length,
      maxConcurrent: config.maxConcurrentPreloads,
      enabledStrategies: Object.values(PreloadingStrategies).filter(strategy => {
        switch (strategy) {
          case PreloadingStrategies.INTELLIGENT:
            return config.enableIntelligentPreloading;
          default:
            return true;
        }
      })
    };
  };

  return {
    scheduleIntelligentPreloading,
    preloadPipeline,
    shouldPreload,
    onPreloadEvent,
    getPreloadStatistics,
    getActivePreloads: () => new Set(activePreloads)
  };
};