/**
 * Intelligent preloading scheduler for pipelines
 */

import { PreloadingStrategies } from './preloader-config.js';
import type { PreloadingStrategy } from './preloader-config.js';
import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'
import { showLoadingToast } from '../../shared/utils/ui/loading-components.js';
import type { UsageTracker } from './usage-tracker.js';
import type { PreloaderConfig } from './preloader-config.js';

export interface PipelineRegistry {
  getAvailablePipelineTypes: () => string[];
  isPipelineLoaded: (type: string) => boolean;
  get: (type: string) => Promise<Pipeline | null>;
}

export interface Pipeline {
  initialize?: () => Promise<void>;
  [key: string]: unknown;
}

export interface StateManager {
  updateLoadingState: (pipelineType: string, state: 'preloading' | 'preloaded' | 'error') => void;
  [key: string]: unknown;
}

export interface PipelinePriority {
  type: string;
  priority: number;
  loaded: boolean;
}

export type PreloadEventType = 'preload_started' | 'preload_completed' | 'preload_failed';

export interface PreloadEvent {
  type: PreloadEventType;
  pipelineType: string;
  strategy: PreloadingStrategy;
  timestamp: number;
  error?: string;
}

export type PreloadEventListener = (event: PreloadEvent) => void;

export interface PreloadStatistics {
  activePreloads: number;
  queueSize: number;
  maxConcurrent: number;
  enabledStrategies: PreloadingStrategy[];
}

export interface PreloadScheduler {
  scheduleIntelligentPreloading: () => void;
  preloadPipeline: (pipelineType: string, strategy?: PreloadingStrategy) => Promise<boolean>;
  shouldPreload: (pipelineType: string) => boolean;
  onPreloadEvent: (listener: PreloadEventListener) => () => void;
  getPreloadStatistics: () => PreloadStatistics;
  getActivePreloads: () => Set<string>;
}

export const createPreloadScheduler = (
  registry: PipelineRegistry, 
  stateManager: StateManager, 
  usageTracker: UsageTracker, 
  config: PreloaderConfig
): PreloadScheduler => {
  const preloadQueue: string[] = [];
  const activePreloads = new Set<string>();
  const preloadListeners = new Set<PreloadEventListener>();

  /**
   * Schedule intelligent preloading based on context and usage
   */
  const scheduleIntelligentPreloading = (): void => {
    if (!config.enableIntelligentPreloading || !registry) return;

    // Get all available pipeline types
    const availableTypes = registry.getAvailablePipelineTypes();
    
    // Calculate priorities
    const priorities: PipelinePriority[] = availableTypes.map(type => ({
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
   */
  const preloadPipeline = async (
    pipelineType: string, 
    strategy: PreloadingStrategy = PreloadingStrategies.IMMEDIATE
  ): Promise<boolean> => {
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
        { error: (error as Error).message, strategy }
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
        error: (error as Error).message,
        timestamp: Date.now()
      });

      return false;
    } finally {
      activePreloads.delete(pipelineType);
    }
  };

  /**
   * Check if a pipeline should be preloaded
   */
  const shouldPreload = (pipelineType: string): boolean => {
    if (!config.enableIntelligentPreloading) return false;
    if (!registry || registry.isPipelineLoaded(pipelineType)) return false;
    if (activePreloads.has(pipelineType)) return false;

    const priority = usageTracker.calculatePreloadPriority(pipelineType);
    return priority > 0.2;
  };

  /**
   * Notify preload listeners
   */
  const notifyPreloadListeners = (event: PreloadEvent): void => {
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
   */
  const onPreloadEvent = (listener: PreloadEventListener): (() => void) => {
    preloadListeners.add(listener);
    return () => preloadListeners.delete(listener);
  };

  /**
   * Get preload statistics
   */
  const getPreloadStatistics = (): PreloadStatistics => {
    return {
      activePreloads: activePreloads.size,
      queueSize: preloadQueue.length,
      maxConcurrent: config.maxConcurrentPreloads,
      enabledStrategies: (Object.values(PreloadingStrategies) as PreloadingStrategy[]).filter(strategy => {
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