/**
 * Modular Face Analysis Engine - Main Entry Point
 * Composable, plugin-based face analysis system with unified configuration
 * Updated to support all integrated pipelines including eye tracking
 */

import { createWebGLEngine } from './webgl-engine.js';
import { createCameraManager } from '../../shared/utils/camera.js';
import { createErrorHandler, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';
import { createAnalysisPipeline } from '../pipeline/analysis-pipeline.js';
import { createConfigurationManager } from '../configuration/configuration.js';
import { createOrchestrator } from '../orchestration/orchestrator.js';

// Import pipeline factories
import { createEyeTrackingPipelineFactory } from '../../features/eye-tracking/devices/neon/pipeline.js';

export const createFaceAnalysisEngine = (canvas, userConfig = {}) => {
  // Initialize unified configuration system
  const configManager = createConfigurationManager(userConfig);
  const config = configManager.getConfig();
  
  const state = {
    canvas,
    webglEngine: null,
    camera: null,
    pipeline: null,
    orchestrator: null,
    isInitialized: false,
    isProcessing: false,
    config,
    configManager,
    errorHandler: null,
    stats: {
      fps: 0,
      frameTime: 0,
      pipelineTime: 0,
      totalFrames: 0,
      lastFpsUpdate: 0,
      pipelineStats: new Map()
    },
    pipelines: new Map()
  };

  // Initialize error handler
  const initializeErrorHandler = () => {
    state.errorHandler = createErrorHandler({
      logLevel: ErrorSeverity.WARNING,
      enableConsole: true,
      enableCollection: true,
      enableRecovery: true,
      onError: (error) => {
        if (error.severity === ErrorSeverity.FATAL) {
          console.error('FATAL ERROR - Engine may be in unstable state:', error);
        }
      }
    });
  };

  const initializePipelines = async () => {
    if (!state.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    const enabledPipelines = state.configManager.getEnabledPipelines();
    
    for (const pipelineConfig of enabledPipelines) {
      try {
        const config = state.configManager.getPipelineConfig(pipelineConfig.name);
        const pipeline = await state.orchestrator.createPipeline(pipelineConfig.name, config);
        
        if (pipeline) {
          state.pipelines.set(pipelineConfig.name, pipeline);
          console.log(`✅ ${pipelineConfig.name} pipeline initialized`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to initialize ${pipelineConfig.name} pipeline:`, error.message);
        
        // Continue with other pipelines - graceful degradation
        state.errorHandler?.handleError(
          `Pipeline initialization failed: ${pipelineConfig.name}`,
          ErrorCategory.INITIALIZATION,
          ErrorSeverity.WARNING,
          { pipeline: pipelineConfig.name, error: error.message }
        );
      }
    }
    
    console.log(`📦 ${state.pipelines.size} pipelines initialized successfully`);
  };

  const createPipeline = () => {
    // Get enabled pipelines from unified configuration
    const enabledPipelines = state.configManager.getEnabledPipelines();
    
    // Initialize orchestrator with unified config
    state.orchestrator = createOrchestrator({
      performance: state.config.performance,
      system: state.config.system
    });
    
    // Register pipeline factories based on enabled pipelines
    registerPipelineFactories(enabledPipelines);
    
    console.log(`🔗 Pipeline orchestrator created with ${enabledPipelines.length} enabled pipelines`);
  };
  
  const registerPipelineFactories = (enabledPipelines) => {
    // Register eye tracking pipeline if enabled
    const eyeTrackingConfig = enabledPipelines.find(p => p.name === 'eyeTracking');
    if (eyeTrackingConfig) {
      const factory = createEyeTrackingPipelineFactory();
      state.orchestrator.registerPipelineFactory(factory.name, factory);
      console.log('📦 Eye tracking pipeline factory registered');
    }
    
    // Register face detection pipeline (always available)
    state.orchestrator.registerPipelineFactory('detection', {
      name: 'detection',
      description: 'Face detection pipeline',
      create: (config) => createAnalysisPipeline(config),
      requiresHardware: false,
      supportsRealtime: true
    });
    
    console.log('📦 Core detection pipeline factory registered');
  };

  const initialize = async (options = {}) => {
    try {
      initializeErrorHandler();
      
      state.errorHandler.handleError(
        'Initializing Modular Face Analysis Engine...',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO
      );

      // Merge options with config
      state.config = { ...state.config, ...options };

      // Initialize WebGL engine
      console.log('🔧 Creating WebGL engine...');
      state.webglEngine = createWebGLEngine(state.canvas);
      
      if (!state.webglEngine) {
        throw new Error('WebGL engine initialization failed');
      }

      state.errorHandler.handleError(
        `WebGL${state.webglEngine.isWebGL2 ? '2' : '1'} engine initialized successfully`,
        ErrorCategory.WEBGL,
        ErrorSeverity.INFO
      );

      // Create orchestrator and register pipelines
      console.log('🔗 Creating pipeline orchestrator...');
      createPipeline();

      // Initialize all enabled pipelines
      await initializePipelines();
      
      // Start orchestrator if we have pipelines
      if (state.pipelines.size > 0) {
        await state.orchestrator.start();
        console.log('✅ Pipeline orchestrator started');
      }

      // Initialize camera if requested
      if (options.camera === true) {
        await initializeCamera(options.cameraConstraints);
      }

      state.isInitialized = true;

      state.errorHandler.handleError(
        'Modular Face Analysis Engine initialized successfully',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO
      );

      return {
        webglVersion: state.webglEngine.isWebGL2 ? 2 : 1,
        orchestrator: state.orchestrator ? state.orchestrator.getStatus() : null,
        pipelines: Array.from(state.pipelines.keys()),
        pipelineStats: getPipelineStats(),
        features: getAvailableFeatures(),
        errorStats: state.errorHandler.getStatistics(),
        configuration: {
          validated: state.configManager.isValidated(),
          enabledPipelines: state.configManager.getEnabledPipelines().map(p => p.name)
        }
      };

    } catch (error) {
      state.errorHandler?.handleError(
        `Initialization failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.FATAL,
        { originalError: error.stack }
      );
      throw error;
    }
  };

  const initializeCamera = async (constraints) => {
    state.camera = createCameraManager();
    await state.camera.initialize(constraints);
    console.log('📹 Camera initialized');
  };

  const getAvailableFeatures = () => {
    const features = {};
    
    // Get features from all active pipelines
    for (const [pipelineName, pipeline] of state.pipelines) {
      try {
        if (pipeline.getCapabilities) {
          const capabilities = pipeline.getCapabilities();
          for (const capability of capabilities) {
            features[capability] = true;
          }
        }
        
        // Mark pipeline as available
        features[pipelineName] = true;
      } catch (error) {
        console.warn(`Failed to get capabilities from ${pipelineName}:`, error.message);
      }
    }
    
    // Add core WebGL features
    if (state.webglEngine) {
      features.webgl = true;
      features.webgl2 = state.webglEngine.isWebGL2;
    }
    
    return features;
  };
  
  const getPipelineStats = () => {
    const stats = {};
    
    for (const [pipelineName, pipeline] of state.pipelines) {
      try {
        if (pipeline.getStatus) {
          stats[pipelineName] = pipeline.getStatus();
        }
      } catch (error) {
        stats[pipelineName] = { error: error.message };
      }
    }
    
    return stats;
  };

  const startProcessing = (options = {}) => {
    if (!state.isInitialized) {
      throw new Error('Engine not initialized');
    }

    if (state.isProcessing) {
      return;
    }

    state.isProcessing = true;
    console.log('▶️ Starting processing loop...');

    const frameLoop = async () => {
      if (!state.isProcessing) return;

      const frameStart = performance.now();

      try {
        // Get current frame
        let frameData;
        if (state.camera) {
          frameData = state.camera.getFrame();
        } else if (options.getFrame) {
          frameData = options.getFrame();
        } else {
          throw new Error('No frame source available');
        }

        if (!frameData) {
          requestAnimationFrame(frameLoop);
          return;
        }

        // Process through orchestrator and all active pipelines
        const pipelineStart = performance.now();
        const results = {};
        
        for (const [pipelineName, pipeline] of state.pipelines) {
          try {
            if (pipeline.process) {
              const pipelineResult = await pipeline.process(frameData, {
                timestamp: performance.now(),
                frameNumber: state.stats.totalFrames
              });
              results[pipelineName] = pipelineResult;
            }
          } catch (pipelineError) {
            state.errorHandler?.handleError(
              `Pipeline ${pipelineName} processing failed: ${pipelineError.message}`,
              ErrorCategory.PROCESSING,
              ErrorSeverity.WARNING,
              { pipeline: pipelineName, frameNumber: state.stats.totalFrames }
            );
            // Continue with other pipelines
          }
        }
        
        const pipelineTime = performance.now() - pipelineStart;

        // Update statistics
        const frameTime = performance.now() - frameStart;
        updateStats(frameTime, pipelineTime);

        // Call result callback
        if (options.onResults) {
          options.onResults({
            results,
            stats: getStats(),
            timestamp: performance.now(),
            pipelineStats: getPipelineStats()
          });
        }

      } catch (error) {
        const standardError = state.errorHandler.handleError(
          `Frame processing failed: ${error.message}`,
          ErrorCategory.PROCESSING,
          ErrorSeverity.ERROR,
          {
            frameNumber: state.stats.totalFrames,
            hasCamera: !!state.camera,
            originalError: error.stack
          }
        );

        if (options.onError) {
          options.onError(standardError);
        }
      }

      // Schedule next frame
      requestAnimationFrame(frameLoop);
    };

    frameLoop();
  };

  const stopProcessing = () => {
    state.isProcessing = false;
    console.log('⏹️ Processing stopped');
  };

  const updateStats = (frameTime, pipelineTime) => {
    state.stats.totalFrames++;
    state.stats.frameTime = frameTime;
    state.stats.pipelineTime = pipelineTime;

    // Calculate FPS
    const now = performance.now();
    if (now - state.stats.lastFpsUpdate > 1000) {
      state.stats.fps = Math.round(1000 / frameTime);
      state.stats.lastFpsUpdate = now;
    }
  };

  const getStats = () => ({
    ...state.stats,
    pipelineStats: getPipelineStats(),
    orchestratorStats: state.orchestrator ? state.orchestrator.getStats() : null,
    activePipelines: Array.from(state.pipelines.keys())
  });

  const switchAlgorithm = async (pipelineName, algorithm, config = {}) => {
    if (!state.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      // Update configuration
      state.configManager.set(`pipelines.${pipelineName}.primary`, algorithm);
      if (config && Object.keys(config).length > 0) {
        state.configManager.set(`pipelines.${pipelineName}.${algorithm}`, config);
      }
      
      // Recreate pipeline with new configuration
      const pipelineConfig = state.configManager.getPipelineConfig(pipelineName);
      const newPipeline = await state.orchestrator.createPipeline(pipelineName, pipelineConfig);
      
      if (newPipeline) {
        // Stop and cleanup old pipeline
        const oldPipeline = state.pipelines.get(pipelineName);
        if (oldPipeline && oldPipeline.cleanup) {
          await oldPipeline.cleanup();
        }
        
        // Replace with new pipeline
        state.pipelines.set(pipelineName, newPipeline);
        console.log(`🔄 Switched ${pipelineName} algorithm to ${algorithm}`);
      }
    } catch (error) {
      state.errorHandler?.handleError(
        `Algorithm switch failed: ${pipelineName} to ${algorithm}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { pipeline: pipelineName, algorithm, error: error.message }
      );
      throw error;
    }
  };

  const cleanup = async () => {
    console.log('🧹 Cleaning up Face Analysis Engine...');
    
    stopProcessing();
    
    // Cleanup all pipelines
    for (const [pipelineName, pipeline] of state.pipelines) {
      try {
        if (pipeline.cleanup) {
          await pipeline.cleanup();
        }
        console.log(`✅ ${pipelineName} pipeline cleaned up`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${pipelineName} pipeline:`, error.message);
      }
    }
    state.pipelines.clear();
    
    // Cleanup orchestrator
    if (state.orchestrator) {
      try {
        await state.orchestrator.shutdown();
      } catch (error) {
        console.warn('⚠️ Failed to shutdown orchestrator:', error.message);
      }
      state.orchestrator = null;
    }
    
    // Cleanup camera
    if (state.camera) {
      state.camera.cleanup();
      state.camera = null;
    }
    
    // Cleanup WebGL engine
    if (state.webglEngine) {
      state.webglEngine.cleanup();
      state.webglEngine = null;
    }
    
    state.isInitialized = false;
    console.log('✅ Face Analysis Engine cleanup complete');
  };

  // Public API
  return {
    initialize,
    startProcessing,
    stopProcessing,
    switchAlgorithm,
    getStats,
    getAvailableFeatures,
    cleanup,
    
    // Utilities
    getCanvas: () => state.canvas,
    getWebGLEngine: () => state.webglEngine,
    getOrchestrator: () => state.orchestrator,
    getPipeline: (name) => state.pipelines.get(name),
    getAllPipelines: () => new Map(state.pipelines),
    getCamera: () => state.camera,
    getConfigManager: () => state.configManager,
    
    // Camera controls
    getCameraInfo: () => state.camera ? state.camera.getStreamInfo() : null,
    switchCamera: async (facingMode = 'user') => {
      if (state.camera) {
        await state.camera.switchCamera(facingMode);
      }
    }
  };
};