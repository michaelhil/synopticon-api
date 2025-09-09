/**
 * Modular Face Analysis Engine - Main Entry Point
 * Composable, plugin-based face analysis system with unified configuration
 * Updated to support all integrated pipelines including eye tracking
 */

import { createWebGLEngine } from './webgl-engine.js';
import type { WebGLEngineInterface } from './webgl-engine.js';
import { createCameraManager } from '../../shared/utils/camera.js';
import type { CameraManager } from '../../shared/utils/camera.js';
import { ErrorCategory, ErrorSeverity, createErrorHandler } from '../../shared/utils/error-handler.js'
import type { ErrorHandler, StandardError } from '../../shared/utils/error-handler.js'
import { createAnalysisPipeline } from '../pipeline/analysis-pipeline.js';
import type { AnalysisPipeline } from '../pipeline/analysis-pipeline.js';
import { createConfigurationManager } from '../configuration/configuration.js';
import type { ConfigurationManager, EngineConfiguration } from '../configuration/configuration.js';
import { createOrchestrator } from '../orchestration/orchestrator.js';
import type { Orchestrator, OrchestratorStatus } from '../orchestration/orchestrator.js';

// Import pipeline factories
import { createEyeTrackingPipelineFactory } from '../../features/eye-tracking/devices/neon/pipeline.js';

export interface PipelineFactory {
  name: string;
  description: string;
  create: (config: any) => Promise<Pipeline> | Pipeline;
  requiresHardware: boolean;
  supportsRealtime: boolean;
}

export interface Pipeline {
  process?: (frameData: any, options: ProcessingOptions) => Promise<any>;
  getCapabilities?: () => string[];
  getStatus?: () => PipelineStatus;
  cleanup?: () => Promise<void>;
  [key: string]: unknown;
}

export interface PipelineStatus {
  isActive: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface ProcessingOptions {
  timestamp: number;
  frameNumber: number;
}

export interface EngineStats {
  fps: number;
  frameTime: number;
  pipelineTime: number;
  totalFrames: number;
  lastFpsUpdate: number;
  pipelineStats: Map<string, PipelineStatus>;
}

export interface ProcessingResult {
  results: Record<string, any>;
  stats: ExtendedStats;
  timestamp: number;
  pipelineStats: Record<string, PipelineStatus>;
}

export interface ExtendedStats extends EngineStats {
  pipelineStats: Record<string, PipelineStatus>;
  orchestratorStats: any | null;
  activePipelines: string[];
}

export interface InitializationOptions {
  camera?: boolean;
  cameraConstraints?: MediaStreamConstraints;
  [key: string]: unknown;
}

export interface InitializationResult {
  webglVersion: number;
  orchestrator: OrchestratorStatus | null;
  pipelines: string[];
  pipelineStats: Record<string, PipelineStatus>;
  features: Record<string, boolean>;
  errorStats: any;
  configuration: {
    validated: boolean;
    enabledPipelines: string[];
  };
}

export interface ProcessingStartOptions {
  getFrame?: () => any;
  onResults?: (result: ProcessingResult) => void;
  onError?: (error: StandardError) => void;
}

export interface FaceAnalysisEngine {
  initialize: (options?: InitializationOptions) => Promise<InitializationResult>;
  startProcessing: (options?: ProcessingStartOptions) => void;
  stopProcessing: () => void;
  switchAlgorithm: (pipelineName: string, algorithm: string, config?: any) => Promise<void>;
  getStats: () => ExtendedStats;
  getAvailableFeatures: () => Record<string, boolean>;
  cleanup: () => Promise<void>;
  
  // Utilities
  getCanvas: () => HTMLCanvasElement;
  getWebGLEngine: () => WebGLEngineInterface | null;
  getOrchestrator: () => Orchestrator | null;
  getPipeline: (name: string) => Pipeline | undefined;
  getAllPipelines: () => Map<string, Pipeline>;
  getCamera: () => CameraManager | null;
  getConfigManager: () => ConfigurationManager;
  
  // Camera controls
  getCameraInfo: () => any;
  switchCamera: (facingMode?: string) => Promise<void>;
}

interface EngineState {
  canvas: HTMLCanvasElement;
  webglEngine: WebGLEngineInterface | null;
  camera: CameraManager | null;
  pipeline: AnalysisPipeline | null;
  orchestrator: Orchestrator | null;
  isInitialized: boolean;
  isProcessing: boolean;
  config: EngineConfiguration;
  configManager: ConfigurationManager;
  errorHandler: ErrorHandler | null;
  stats: EngineStats;
  pipelines: Map<string, Pipeline>;
}

export const createFaceAnalysisEngine = (canvas: HTMLCanvasElement, userConfig: any = {}): FaceAnalysisEngine => {
  // Initialize unified configuration system
  const configManager = createConfigurationManager(userConfig);
  const config = configManager.getConfig();
  
  const state: EngineState = {
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
  const initializeErrorHandler = (): void => {
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

  const initializePipelines = async (): Promise<void> => {
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
        console.warn(`⚠️ Failed to initialize ${pipelineConfig.name} pipeline:`, (error as Error).message);
        
        // Continue with other pipelines - graceful degradation
        state.errorHandler?.handleError(
          `Pipeline initialization failed: ${pipelineConfig.name}`,
          ErrorCategory.INITIALIZATION,
          ErrorSeverity.WARNING,
          { pipeline: pipelineConfig.name, error: (error as Error).message }
        );
      }
    }
    
    console.log(`📦 ${state.pipelines.size} pipelines initialized successfully`);
  };

  const createPipeline = (): void => {
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
  
  const registerPipelineFactories = (enabledPipelines: any[]): void => {
    if (!state.orchestrator) return;

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
      create: (config: any) => createAnalysisPipeline(config),
      requiresHardware: false,
      supportsRealtime: true
    });
    
    console.log('📦 Core detection pipeline factory registered');
  };

  const initialize = async (options: InitializationOptions = {}): Promise<InitializationResult> => {
    try {
      initializeErrorHandler();
      
      state.errorHandler!.handleError(
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

      state.errorHandler!.handleError(
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
      if (state.pipelines.size > 0 && state.orchestrator) {
        await state.orchestrator.start();
        console.log('✅ Pipeline orchestrator started');
      }

      // Initialize camera if requested
      if (options.camera === true) {
        await initializeCamera(options.cameraConstraints);
      }

      state.isInitialized = true;

      state.errorHandler!.handleError(
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
        errorStats: state.errorHandler!.getStatistics(),
        configuration: {
          validated: state.configManager.isValidated(),
          enabledPipelines: state.configManager.getEnabledPipelines().map(p => p.name)
        }
      };

    } catch (error) {
      state.errorHandler?.handleError(
        `Initialization failed: ${(error as Error).message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.FATAL,
        { originalError: (error as Error).stack }
      );
      throw error;
    }
  };

  const initializeCamera = async (constraints?: MediaStreamConstraints): Promise<void> => {
    state.camera = createCameraManager();
    await state.camera.initialize(constraints);
    console.log('📹 Camera initialized');
  };

  const getAvailableFeatures = (): Record<string, boolean> => {
    const features: Record<string, boolean> = {};
    
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
        console.warn(`Failed to get capabilities from ${pipelineName}:`, (error as Error).message);
      }
    }
    
    // Add core WebGL features
    if (state.webglEngine) {
      features.webgl = true;
      features.webgl2 = state.webglEngine.isWebGL2;
    }
    
    return features;
  };
  
  const getPipelineStats = (): Record<string, PipelineStatus> => {
    const stats: Record<string, PipelineStatus> = {};
    
    for (const [pipelineName, pipeline] of state.pipelines) {
      try {
        if (pipeline.getStatus) {
          stats[pipelineName] = pipeline.getStatus();
        } else {
          stats[pipelineName] = { isActive: true };
        }
      } catch (error) {
        stats[pipelineName] = { isActive: false, error: (error as Error).message };
      }
    }
    
    return stats;
  };

  const startProcessing = (options: ProcessingStartOptions = {}): void => {
    if (!state.isInitialized) {
      throw new Error('Engine not initialized');
    }

    if (state.isProcessing) {
      return;
    }

    state.isProcessing = true;
    console.log('▶️ Starting processing loop...');

    const frameLoop = async (): Promise<void> => {
      if (!state.isProcessing) return;

      const frameStart = performance.now();

      try {
        // Get current frame
        let frameData: any;
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
        const results: Record<string, any> = {};
        
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
              `Pipeline ${pipelineName} processing failed: ${(pipelineError as Error).message}`,
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
        const standardError = state.errorHandler!.handleError(
          `Frame processing failed: ${(error as Error).message}`,
          ErrorCategory.PROCESSING,
          ErrorSeverity.ERROR,
          {
            frameNumber: state.stats.totalFrames,
            hasCamera: Boolean(state.camera),
            originalError: (error as Error).stack
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

  const stopProcessing = (): void => {
    state.isProcessing = false;
    console.log('⏹️ Processing stopped');
  };

  const updateStats = (frameTime: number, pipelineTime: number): void => {
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

  const getStats = (): ExtendedStats => ({
    ...state.stats,
    pipelineStats: getPipelineStats(),
    orchestratorStats: state.orchestrator ? state.orchestrator.getStats() : null,
    activePipelines: Array.from(state.pipelines.keys())
  });

  const switchAlgorithm = async (pipelineName: string, algorithm: string, config: any = {}): Promise<void> => {
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
        { pipeline: pipelineName, algorithm, error: (error as Error).message }
      );
      throw error;
    }
  };

  const cleanup = async (): Promise<void> => {
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
        console.warn(`⚠️ Failed to cleanup ${pipelineName} pipeline:`, (error as Error).message);
      }
    }
    state.pipelines.clear();
    
    // Cleanup orchestrator
    if (state.orchestrator) {
      try {
        await state.orchestrator.shutdown();
      } catch (error) {
        console.warn('⚠️ Failed to shutdown orchestrator:', (error as Error).message);
      }
      state.orchestrator = null;
    }
    
    // Cleanup camera
    if (state.camera) {
      state.camera.cleanup();
      state.camera = null;
    }
    
    // Cleanup WebGL engine
    if (state.webglEngine && 'cleanup' in state.webglEngine) {
      (state.webglEngine as any).cleanup();
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
    getPipeline: (name: string) => state.pipelines.get(name),
    getAllPipelines: () => new Map(state.pipelines),
    getCamera: () => state.camera,
    getConfigManager: () => state.configManager,
    
    // Camera controls
    getCameraInfo: () => state.camera ? state.camera.getStreamInfo() : null,
    switchCamera: async (facingMode: string = 'user') => {
      if (state.camera) {
        await state.camera.switchCamera(facingMode);
      }
    }
  };
};