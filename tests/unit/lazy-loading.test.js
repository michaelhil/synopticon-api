/**
 * Comprehensive Test Suite for Lazy Loading System
 * Tests all aspects of code splitting, lazy loading, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createLazyPipelineRegistry } from '../../src/core/pipeline/lazy-pipeline-registry.js';
import { createLoadingStateManager, LoadingStates, ProgressStages } from '../../src/core/state/loading-state-manager.js';
import { createPipelinePreloader, PreloadingStrategies, UsageContexts } from '../../src/core/pipeline/pipeline-preloader.js';
import { createLazyOrchestrator, createQuickStartOrchestrator } from '../../src/index.js';

// Mock pipeline modules for testing
const mockPipelineFactories = {
  'mediapipe-face': () => ({
    name: 'mediapipe-face',
    capabilities: ['face-detection'],
    initialize: () => Promise.resolve(),
    process: () => Promise.resolve({ faces: [] })
  }),
  'emotion-analysis': () => ({
    name: 'emotion-analysis',
    capabilities: ['emotion-detection'],
    initialize: () => Promise.resolve(),
    process: () => Promise.resolve({ emotions: [] })
  }),
  'failing-pipeline': () => {
    throw new Error('Pipeline load failure');
  }
};

// Mock dynamic imports
const originalImport = globalThis.__import__;
beforeEach(() => {
  globalThis.__import__ = (path) => {
    // Extract pipeline type from path
    const pipelineType = path.match(/pipelines\/(.+?)-pipeline\.js$/)?.[1];
    if (pipelineType && mockPipelineFactories[pipelineType]) {
      return Promise.resolve({
        [`create${pipelineType.charAt(0).toUpperCase() + pipelineType.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase())}Pipeline`]: mockPipelineFactories[pipelineType]
      });
    }
    return Promise.reject(new Error(`Module not found: ${path}`));
  };
});

afterEach(() => {
  globalThis.__import__ = originalImport;
});

describe('Lazy Pipeline Registry', () => {
  let registry;

  beforeEach(() => {
    registry = createLazyPipelineRegistry();
  });

  it('should create registry with default configuration', () => {
    expect(registry).toBeDefined();
    expect(typeof registry.loadPipeline).toBe('function');
    expect(typeof registry.isPipelineLoaded).toBe('function');
    expect(typeof registry.getMetrics).toBe('function');
  });

  it('should load pipeline successfully', async () => {
    const factory = await registry.loadPipeline('mediapipe-face');
    expect(typeof factory).toBe('function');
    
    const pipeline = factory();
    expect(pipeline.name).toBe('mediapipe-face');
    expect(pipeline.capabilities).toContain('face-detection');
  });

  it('should cache loaded pipelines', async () => {
    const factory1 = await registry.loadPipeline('mediapipe-face');
    const factory2 = await registry.loadPipeline('mediapipe-face');
    
    expect(factory1).toBe(factory2);
    expect(registry.isPipelineLoaded('mediapipe-face')).toBe(true);
    
    const metrics = registry.getMetrics();
    expect(metrics.cacheHits).toBe(1);
  });

  it('should handle pipeline loading failures', async () => {
    await expect(registry.loadPipeline('failing-pipeline')).rejects.toThrow('Pipeline load failure');
    expect(registry.isPipelineLoaded('failing-pipeline')).toBe(false);
  });

  it('should retry failed loads with exponential backoff', async () => {
    const registryWithRetry = createLazyPipelineRegistry({
      maxRetries: 2,
      retryDelay: 10
    });

    let attemptCount = 0;
    globalThis.__import__ = () => {
      attemptCount++;
      if (attemptCount < 3) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve({
        createMediapipeFacePipeline: mockPipelineFactories['mediapipe-face']
      });
    };

    const factory = await registryWithRetry.loadPipeline('mediapipe-face');
    expect(attemptCount).toBe(3);
    expect(typeof factory).toBe('function');
  });

  it('should respect loading timeout', async () => {
    const registryWithTimeout = createLazyPipelineRegistry({
      loadTimeout: 50
    });

    globalThis.__import__ = () => new Promise(() => {}); // Never resolves

    await expect(registryWithTimeout.loadPipeline('mediapipe-face'))
      .rejects.toThrow('Pipeline load timeout');
  });

  it('should collect accurate metrics', async () => {
    await registry.loadPipeline('mediapipe-face');
    await registry.loadPipeline('mediapipe-face'); // Cache hit
    await registry.loadPipeline('emotion-analysis');

    const metrics = registry.getMetrics();
    expect(metrics.totalLoads).toBe(3);
    expect(metrics.uniqueLoads).toBe(2);
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.loadFailures).toBe(0);
  });
});

describe('Loading State Manager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = createLoadingStateManager();
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
});

describe('Pipeline Preloader', () => {
  let preloader;
  let mockRegistry;

  beforeEach(() => {
    mockRegistry = createLazyPipelineRegistry();
    preloader = createPipelinePreloader({
      strategy: PreloadingStrategies.INTELLIGENT
    });
    preloader.initialize(mockRegistry);
  });

  it('should initialize with registry', () => {
    expect(preloader.getStatistics().initialized).toBe(true);
  });

  it('should preload pipeline based on strategy', async () => {
    await preloader.preloadPipeline('mediapipe-face', PreloadingStrategies.IMMEDIATE);
    expect(mockRegistry.isPipelineLoaded('mediapipe-face')).toBe(true);
  });

  it('should analyze usage patterns', () => {
    preloader.recordUsage('mediapipe-face', UsageContexts.VIDEO_ANALYSIS);
    preloader.recordUsage('mediapipe-face', UsageContexts.REAL_TIME);
    preloader.recordUsage('emotion-analysis', UsageContexts.VIDEO_ANALYSIS);

    const stats = preloader.getStatistics();
    expect(stats.usageHistory.length).toBe(3);
    expect(stats.usagePatterns['mediapipe-face']).toBe(2);
  });

  it('should adapt to network conditions', () => {
    // Simulate slow network
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '2g' },
      writable: true
    });

    preloader.updateNetworkConditions();
    const decision = preloader.shouldPreload('mediapipe-face');
    expect(decision).toBe(false); // Should avoid preloading on slow network
  });

  it('should schedule intelligent preloading', async () => {
    // Record usage patterns
    preloader.recordUsage('mediapipe-face', UsageContexts.VIDEO_ANALYSIS);
    preloader.recordUsage('mediapipe-face', UsageContexts.VIDEO_ANALYSIS);
    preloader.recordUsage('emotion-analysis', UsageContexts.VIDEO_ANALYSIS);

    await preloader.scheduleIntelligentPreloading();
    
    // Most used pipeline should be preloaded
    expect(mockRegistry.isPipelineLoaded('mediapipe-face')).toBe(true);
  });
});

describe('Lazy Orchestrator Integration', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = createLazyOrchestrator({
      lazyLoading: {
        enabled: true,
        cacheSize: 10
      }
    });
  });

  it('should create lazy orchestrator with enhanced capabilities', () => {
    expect(typeof orchestrator.registerPipelineByType).toBe('function');
    expect(typeof orchestrator.registerPipelinesLazy).toBe('function');
    expect(typeof orchestrator.preloadPipeline).toBe('function');
    expect(typeof orchestrator.isPipelineLoaded).toBe('function');
  });

  it('should register pipeline by type lazily', async () => {
    const pipeline = await orchestrator.registerPipelineByType('mediapipe-face');
    expect(pipeline.name).toBe('mediapipe-face');
    expect(orchestrator.isPipelineLoaded('mediapipe-face')).toBe(true);
  });

  it('should register multiple pipelines lazily', async () => {
    const pipelines = await orchestrator.registerPipelinesLazy([
      'mediapipe-face',
      'emotion-analysis'
    ]);

    expect(pipelines.length).toBe(2);
    expect(orchestrator.isPipelineLoaded('mediapipe-face')).toBe(true);
    expect(orchestrator.isPipelineLoaded('emotion-analysis')).toBe(true);
  });

  it('should handle partial pipeline loading failures', async () => {
    const pipelines = await orchestrator.registerPipelinesLazy([
      'mediapipe-face',
      'failing-pipeline',
      'emotion-analysis'
    ]);

    // Should load successful pipelines despite one failure
    expect(pipelines.length).toBe(2);
    expect(orchestrator.isPipelineLoaded('mediapipe-face')).toBe(true);
    expect(orchestrator.isPipelineLoaded('emotion-analysis')).toBe(true);
    expect(orchestrator.isPipelineLoaded('failing-pipeline')).toBe(false);
  });

  it('should provide lazy loading metrics', () => {
    const metrics = orchestrator.getLazyLoadingMetrics();
    expect(metrics.registry).toBeDefined();
    expect(metrics.preloader).toBeDefined();
  });
});

describe('Quick Start Orchestrator', () => {
  it('should create orchestrator with default requirements', async () => {
    const orchestrator = await createQuickStartOrchestrator();
    
    // Default should include face detection
    expect(orchestrator.isPipelineLoaded('mediapipe-face')).toBe(true);
  });

  it('should create orchestrator with custom requirements', async () => {
    const orchestrator = await createQuickStartOrchestrator({
      faceDetection: true,
      emotionAnalysis: true,
      ageEstimation: false
    });

    expect(orchestrator.isPipelineLoaded('mediapipe-face')).toBe(true);
    expect(orchestrator.isPipelineLoaded('emotion-analysis')).toBe(true);
  });

  it('should handle requirement conflicts gracefully', async () => {
    const orchestrator = await createQuickStartOrchestrator({
      faceDetection: false,
      emotionAnalysis: true // Requires face detection
    });

    // Should still work, may include face detection as dependency
    expect(typeof orchestrator.registerPipelineByType).toBe('function');
  });
});

describe('Error Handling and Recovery', () => {
  it('should handle network failures gracefully', async () => {
    const registry = createLazyPipelineRegistry({
      maxRetries: 1,
      retryDelay: 10
    });

    // Simulate network error
    globalThis.__import__ = () => Promise.reject(new Error('NetworkError'));

    await expect(registry.loadPipeline('mediapipe-face')).rejects.toThrow('NetworkError');
    
    const metrics = registry.getMetrics();
    expect(metrics.loadFailures).toBe(1);
  });

  it('should clean up failed loading states', async () => {
    const stateManager = createLoadingStateManager();
    const registry = createLazyPipelineRegistry();

    // Set up state tracking
    registry.onLoadingStateChange((stateData) => {
      stateManager.updateLoadingState(stateData.identifier, stateData.state, stateData);
    });

    // Simulate failure
    globalThis.__import__ = () => Promise.reject(new Error('Load failure'));

    try {
      await registry.loadPipeline('mediapipe-face');
    } catch (error) {
      // Expected failure
    }

    const state = stateManager.getLoadingState('mediapipe-face');
    expect(state.state).toBe(LoadingStates.ERROR);
  });
});

describe('Performance and Memory Management', () => {
  it('should respect cache size limits', async () => {
    const registry = createLazyPipelineRegistry({
      cacheSize: 1
    });

    await registry.loadPipeline('mediapipe-face');
    await registry.loadPipeline('emotion-analysis');

    // First pipeline should be evicted
    expect(registry.isPipelineLoaded('mediapipe-face')).toBe(false);
    expect(registry.isPipelineLoaded('emotion-analysis')).toBe(true);
  });

  it('should clean up unused resources', () => {
    const stateManager = createLoadingStateManager();
    
    stateManager.updateLoadingState('temp-pipeline', LoadingStates.LOADING);
    expect(stateManager.getAllStates().size).toBe(1);
    
    stateManager.clearState('temp-pipeline');
    expect(stateManager.getAllStates().size).toBe(0);
  });
});