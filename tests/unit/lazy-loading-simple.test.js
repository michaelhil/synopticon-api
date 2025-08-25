/**
 * Simplified Test Suite for Lazy Loading Core Components
 * Focus on testing the lazy loading infrastructure directly
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createLazyPipelineRegistry } from '../../src/core/lazy-pipeline-registry.js';
import { createLoadingStateManager, LoadingStates, ProgressStages } from '../../src/core/loading-state-manager.js';
import { createPipelinePreloader, PreloadingStrategies, UsageContexts } from '../../src/core/pipeline-preloader.js';

describe('Lazy Loading Core Infrastructure', () => {
  
  describe('Loading State Manager', () => {
    let stateManager;

    beforeEach(() => {
      stateManager = createLoadingStateManager();
    });

    it('should create state manager successfully', () => {
      expect(stateManager).toBeDefined();
      expect(typeof stateManager.updateLoadingState).toBe('function');
      expect(typeof stateManager.getLoadingState).toBe('function');
      expect(typeof stateManager.getAllStates).toBe('function');
    });

    it('should manage loading states correctly', () => {
      stateManager.updateLoadingState('test-pipeline', LoadingStates.LOADING, {
        stage: ProgressStages.FETCHING,
        progress: 50
      });

      const state = stateManager.getLoadingState('test-pipeline');
      expect(state.state).toBe(LoadingStates.LOADING);
      expect(state.stage).toBe(ProgressStages.FETCHING);
      expect(state.progress).toBe(50);
    });

    it('should notify state change listeners', () => {
      let notificationReceived = false;
      const listener = (stateData) => {
        notificationReceived = true;
        expect(stateData.identifier).toBe('test-pipeline');
        expect(stateData.state).toBe(LoadingStates.LOADED);
      };

      stateManager.onLoadingStateChange(listener);
      stateManager.updateLoadingState('test-pipeline', LoadingStates.LOADED);
      
      expect(notificationReceived).toBe(true);
    });

    it('should track multiple pipeline states', () => {
      stateManager.updateLoadingState('pipeline1', LoadingStates.LOADING);
      stateManager.updateLoadingState('pipeline2', LoadingStates.LOADED);

      const states = stateManager.getAllStates();
      expect(states.size).toBe(2);
      expect(states.get('pipeline1').state).toBe(LoadingStates.LOADING);
      expect(states.get('pipeline2').state).toBe(LoadingStates.LOADED);
    });

    it('should clean up unused resources', () => {
      stateManager.updateLoadingState('temp-pipeline', LoadingStates.LOADING);
      expect(stateManager.getAllStates().size).toBe(1);
      
      stateManager.clearState('temp-pipeline');
      expect(stateManager.getAllStates().size).toBe(0);
    });

    it('should validate state parameters', () => {
      expect(() => {
        stateManager.updateLoadingState('', LoadingStates.LOADING);
      }).toThrow('Identifier and state are required');

      expect(() => {
        stateManager.updateLoadingState('test', 'invalid-state');
      }).toThrow('Invalid loading state');
    });
  });

  describe('Pipeline Preloader', () => {
    let preloader;

    beforeEach(() => {
      preloader = createPipelinePreloader({
        strategy: PreloadingStrategies.INTELLIGENT
      });
    });

    it('should create preloader successfully', () => {
      expect(preloader).toBeDefined();
      expect(typeof preloader.recordUsage).toBe('function');
      expect(typeof preloader.shouldPreload).toBe('function');
      expect(typeof preloader.getStatistics).toBe('function');
    });

    it('should record usage patterns', () => {
      preloader.recordUsage('mediapipe-face', UsageContexts.VIDEO_ANALYSIS);
      preloader.recordUsage('mediapipe-face', UsageContexts.REAL_TIME);
      preloader.recordUsage('emotion-analysis', UsageContexts.VIDEO_ANALYSIS);

      const stats = preloader.getStatistics();
      expect(stats.usageHistory.length).toBe(3);
      expect(stats.usagePatterns['mediapipe-face']).toBe(2);
    });

    it('should make preloading decisions based on usage', () => {
      // Record heavy usage
      for (let i = 0; i < 5; i++) {
        preloader.recordUsage('mediapipe-face', UsageContexts.VIDEO_ANALYSIS);
      }

      const shouldPreload = preloader.shouldPreload('mediapipe-face');
      expect(shouldPreload).toBe(true);
    });

    it('should respect network conditions', () => {
      // Simulate slow network
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '2g' },
        configurable: true
      });

      preloader.updateNetworkConditions();
      const shouldPreload = preloader.shouldPreload('mediapipe-face');
      expect(shouldPreload).toBe(false);
    });
  });

  describe('Lazy Pipeline Registry Core Functions', () => {
    let registry;

    beforeEach(() => {
      registry = createLazyPipelineRegistry({
        enableCache: true,
        cacheSize: 5,
        maxRetries: 1
      });
    });

    it('should create registry with configuration', () => {
      expect(registry).toBeDefined();
      expect(typeof registry.loadPipeline).toBe('function');
      expect(typeof registry.isPipelineLoaded).toBe('function');
      expect(typeof registry.getMetrics).toBe('function');
    });

    it('should validate pipeline types', async () => {
      await expect(registry.loadPipeline('invalid-pipeline'))
        .rejects.toThrow(/Unknown pipeline type/);
    });

    it('should collect metrics correctly', () => {
      const metrics = registry.getMetrics();
      expect(metrics).toHaveProperty('totalLoads');
      expect(metrics).toHaveProperty('uniqueLoads');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('loadFailures');
    });

    it('should handle state changes', () => {
      let stateUpdates = [];
      registry.onLoadingStateChange((stateData) => {
        stateUpdates.push(stateData);
      });

      // Trigger a loading attempt
      registry.loadPipeline('mediapipe-face').catch(() => {
        // Expected to fail in test environment
      });

      // Check that state updates were recorded
      expect(stateUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('Loading Constants and Types', () => {
    it('should export correct loading states', () => {
      expect(LoadingStates.IDLE).toBe('idle');
      expect(LoadingStates.LOADING).toBe('loading');
      expect(LoadingStates.LOADED).toBe('loaded');
      expect(LoadingStates.ERROR).toBe('error');
      expect(LoadingStates.PRELOADING).toBe('preloading');
    });

    it('should export correct progress stages', () => {
      expect(ProgressStages.INITIALIZING).toBe('initializing');
      expect(ProgressStages.FETCHING).toBe('fetching');
      expect(ProgressStages.PARSING).toBe('parsing');
      expect(ProgressStages.COMPILING).toBe('compiling');
      expect(ProgressStages.COMPLETE).toBe('complete');
    });

    it('should export preloading strategies', () => {
      expect(PreloadingStrategies.IMMEDIATE).toBe('immediate');
      expect(PreloadingStrategies.LAZY).toBe('lazy');
      expect(PreloadingStrategies.INTELLIGENT).toBe('intelligent');
      expect(PreloadingStrategies.CONTEXT_AWARE).toBe('context_aware');
    });

    it('should export usage contexts', () => {
      expect(UsageContexts.REAL_TIME).toBe('real_time');
      expect(UsageContexts.VIDEO_ANALYSIS).toBe('video_analysis');
      expect(UsageContexts.IMAGE_PROCESSING).toBe('image_processing');
      expect(UsageContexts.BATCH_PROCESSING).toBe('batch_processing');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration gracefully', () => {
      expect(() => {
        createLazyPipelineRegistry({
          cacheSize: -1
        });
      }).toThrow(/Cache size must be positive/);

      expect(() => {
        createLazyPipelineRegistry({
          maxRetries: -1
        });
      }).toThrow(/Max retries must be non-negative/);
    });

    it('should handle invalid state manager parameters', () => {
      const stateManager = createLoadingStateManager();
      
      expect(() => {
        stateManager.onLoadingStateChange('not-a-function');
      }).toThrow(/must be a function/);
    });

    it('should handle preloader initialization', () => {
      const preloader = createPipelinePreloader();
      expect(() => {
        preloader.recordUsage('test', 'invalid-context');
      }).toThrow(/Invalid usage context/);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate state manager with preloader', () => {
      const stateManager = createLoadingStateManager();
      const preloader = createPipelinePreloader();

      // Record usage patterns
      preloader.recordUsage('test-pipeline', UsageContexts.REAL_TIME);
      
      // Update loading state
      stateManager.updateLoadingState('test-pipeline', LoadingStates.LOADING);
      
      // Verify state
      const state = stateManager.getLoadingState('test-pipeline');
      expect(state.state).toBe(LoadingStates.LOADING);
      
      // Verify usage was recorded
      const stats = preloader.getStatistics();
      expect(stats.usageHistory.length).toBe(1);
    });
  });
});