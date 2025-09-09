/**
 * @fileoverview Main Factory and Public API for Prediction Confidence Visualization
 * 
 * Provides the main factory function and public API for creating and managing
 * prediction confidence visualization systems with modular architecture.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createCanvasManager } from './canvas-manager.js';
import { createRenderer } from './renderer.js';
import { createDataProcessor } from './data-processor.js';
import { createIntegrationManager } from './integrations.js';

import type {
  PredictionConfidenceVisualizationConfig,
  PredictionConfidenceVisualization,
  VisualizationState,
  ConfidenceVisualization,
  VisualizationStyle,
  InteractionMode,
  ImageFormat,
  ConfidenceStats,
  ExplainableAIEngine,
  TemporalContextEngine,
  CognitiveFusionEngine,
  PredictionData,
  UncertaintyMetadata,
  ConfidenceVisualizationUtils,
  ColorScheme,
  ConfidenceThresholds
} from './types.js';

// Re-export types for consumers
export type * from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<PredictionConfidenceVisualizationConfig> = {
  canvasWidth: 800,
  canvasHeight: 400,
  updateInterval: 100,
  historyLength: 300,
  confidenceThresholds: {
    high: 0.8,
    medium: 0.6,
    low: 0.4
  },
  colorScheme: {
    highConfidence: '#22c55e',
    mediumConfidence: '#f59e0b', 
    lowConfidence: '#ef4444',
    uncertainty: 'rgba(156, 163, 175, 0.3)',
    background: '#1f2937',
    grid: '#374151',
    text: '#f9fafb'
  },
  visualizationStyle: 'balanced',
  enableInteractivity: true,
  showUncertaintyBands: true,
  showTemporalProgression: true,
  resourcePool: null
};

/**
 * Creates a prediction confidence visualization system with modular architecture
 */
export const createPredictionConfidenceVisualization = (
  config: PredictionConfidenceVisualizationConfig = {}
): PredictionConfidenceVisualization => {
  
  // Merge configuration with defaults
  const mergedConfig: Required<PredictionConfidenceVisualizationConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    confidenceThresholds: {
      ...DEFAULT_CONFIG.confidenceThresholds,
      ...config.confidenceThresholds
    },
    colorScheme: {
      ...DEFAULT_CONFIG.colorScheme,
      ...config.colorScheme
    }
  };

  // Initialize state
  const state: VisualizationState = {
    confidenceHistory: new Array(mergedConfig.historyLength).fill(null),
    currentConfidence: null,
    canvas: null,
    context: null,
    animationFrame: null,
    lastUpdate: 0,
    isRunning: false,
    interactionMode: 'overview',
    selectedFeature: null,
    hoverPosition: { x: 0, y: 0 },
    temporalWindow: { start: 0, end: mergedConfig.historyLength }
  };

  // Create modular components
  const dataProcessor = createDataProcessor(state, mergedConfig.historyLength);
  
  // Canvas manager with render request callback
  const canvasManager = createCanvasManager(
    mergedConfig, 
    state, 
    () => renderer.requestRender()
  );
  
  // Renderer with canvas utilities
  const renderer = createRenderer(
    mergedConfig, 
    state, 
    () => canvasManager.clearCanvas()
  );
  
  // Integration manager with dependencies
  const integrationManager = createIntegrationManager(
    state,
    dataProcessor,
    () => renderer.requestRender()
  );

  /**
   * Start real-time visualization updates with improved loop management
   */
  const startRenderLoop = (): void => {
    if (state.isRunning) return;
    
    state.isRunning = true;
    let lastRenderTime = 0;
    
    const renderLoop = (currentTime: number) => {
      if (!state.isRunning) return;
      
      // Throttle rendering based on update interval
      if (currentTime - lastRenderTime >= mergedConfig.updateInterval) {
        renderer.requestRender();
        lastRenderTime = currentTime;
      }
      
      requestAnimationFrame(renderLoop);
    };
    
    requestAnimationFrame(renderLoop);
  };

  /**
   * Stop visualization updates and cleanup
   */
  const stopRenderLoop = (): void => {
    state.isRunning = false;
    
    if (state.animationFrame) {
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }
  };

  // Public API implementation
  const api: PredictionConfidenceVisualization = {
    /**
     * Initialize visualization system
     */
    initialize: async (container: HTMLElement): Promise<void> => {
      try {
        canvasManager.initializeCanvas(container);
        state.isRunning = false;
        
        console.log('✅ Prediction confidence visualization system initialized');
        return Promise.resolve();
      } catch (error) {
        console.error('❌ Failed to initialize prediction confidence visualization:', error);
        return Promise.reject(error);
      }
    },

    /**
     * Start real-time visualization updates
     */
    start: (): void => {
      startRenderLoop();
      console.log('▶️ Prediction confidence visualization started');
    },

    /**
     * Stop visualization updates
     */
    stop: (): void => {
      stopRenderLoop();
      console.log('⏹️ Prediction confidence visualization stopped');
    },

    /**
     * Update confidence data manually
     */
    updateConfidence: (confidenceData: ConfidenceVisualization): void => {
      dataProcessor.updateHistory(confidenceData);
      
      if (state.isRunning) {
        renderer.requestRender();
      }
    },

    /**
     * Set visualization style
     */
    setVisualizationStyle: (style: VisualizationStyle): void => {
      if (['technical', 'simple', 'balanced'].includes(style)) {
        mergedConfig.visualizationStyle = style;
        renderer.requestRender();
      } else {
        console.warn('⚠️ Invalid visualization style:', style);
      }
    },

    /**
     * Set interaction mode
     */
    setInteractionMode: (mode: InteractionMode): void => {
      if (['overview', 'detailed', 'explanation'].includes(mode)) {
        state.interactionMode = mode;
        renderer.requestRender();
      } else {
        console.warn('⚠️ Invalid interaction mode:', mode);
      }
    },

    /**
     * Export current visualization as image
     */
    exportImage: (format: ImageFormat = 'png'): string | null => {
      if (!state.canvas) {
        console.warn('⚠️ Cannot export image: canvas not initialized');
        return null;
      }
      
      try {
        return state.canvas.toDataURL(`image/${format}`);
      } catch (error) {
        console.error('❌ Failed to export image:', error);
        return null;
      }
    },

    /**
     * Get current confidence statistics
     */
    getConfidenceStats: (): ConfidenceStats | null => {
      return dataProcessor.getConfidenceStats();
    },

    /**
     * Integration methods
     */
    integrateWithExplainableAI: (engine: ExplainableAIEngine): void => {
      integrationManager.integrateWithExplainableAI(engine);
    },

    integrateWithTemporalContext: (engine: TemporalContextEngine): void => {
      integrationManager.integrateWithTemporalContext(engine);
    },

    integrateWithCognitiveFusion: (engine: CognitiveFusionEngine): void => {
      integrationManager.integrateWithCognitiveFusion(engine);
    },

    /**
     * Cleanup resources and event listeners
     */
    cleanup: (): void => {
      api.stop();
      
      // Disconnect all integrations
      integrationManager.disconnectAllIntegrations();
      
      // Remove canvas from DOM
      if (state.canvas && state.canvas.parentNode) {
        state.canvas.parentNode.removeChild(state.canvas);
      }
      
      // Clear state
      state.confidenceHistory = new Array(mergedConfig.historyLength).fill(null);
      state.currentConfidence = null;
      state.canvas = null;
      state.context = null;
      state.selectedFeature = null;
      
      console.log('🧹 Prediction confidence visualization cleaned up');
    }
  };

  return api;
};

/**
 * Utility functions for advanced usage
 */
export const ConfidenceVisualizationUtils: ConfidenceVisualizationUtils = {
  /**
   * Create confidence data from raw prediction with enhanced processing
   */
  createConfidenceData: (
    prediction: PredictionData, 
    metadata: UncertaintyMetadata = {}
  ): ConfidenceVisualization => {
    const featureConfidences = new Map<string, number>();
    
    // Extract confidence from prediction structure with validation
    if (prediction.features) {
      Object.entries(prediction.features).forEach(([name, data]) => {
        const rawConfidence = data.confidence ?? data.certainty ?? 0.5;
        const validatedConfidence = Math.max(0, Math.min(1, rawConfidence));
        featureConfidences.set(name, validatedConfidence);
      });
    }
    
    // Calculate overall confidence with proper fallbacks
    const featureValues = Array.from(featureConfidences.values());
    const overallConfidence = prediction.confidence ?? 
      (featureValues.length > 0 ? 
        featureValues.reduce((sum, conf) => sum + conf, 0) / featureValues.length : 
        0.5);
    
    // Validate overall confidence
    const validatedOverallConfidence = Math.max(0, Math.min(1, overallConfidence));
    
    // Calculate uncertainty bounds
    const uncertaintyValue = metadata.uncertainty ?? 0.1;
    const validatedUncertainty = Math.max(0, Math.min(0.5, uncertaintyValue));
    
    return {
      timestamp: Date.now(),
      overallConfidence: validatedOverallConfidence,
      featureConfidences,
      uncertaintyBounds: {
        upper: Math.min(1, validatedOverallConfidence + validatedUncertainty),
        lower: Math.max(0, validatedOverallConfidence - validatedUncertainty),
        uncertainty: validatedUncertainty
      },
      predictionType: prediction.type ?? 'generic',
      explanation: prediction.explanation ?? null,
      temporalTrend: 0
    };
  },

  /**
   * Validate confidence visualization configuration with comprehensive checks
   */
  validateConfig: (config: PredictionConfidenceVisualizationConfig): boolean => {
    try {
      // Check required fields
      const requiredFields = ['canvasWidth', 'canvasHeight'];
      const hasRequired = requiredFields.every(key => 
        config.hasOwnProperty(key) && 
        typeof config[key as keyof PredictionConfidenceVisualizationConfig] === 'number' &&
        (config[key as keyof PredictionConfidenceVisualizationConfig] as number) > 0
      );
      
      if (!hasRequired) {
        console.error('❌ Missing or invalid required configuration fields');
        return false;
      }
      
      // Validate visualization style
      const validStyle = !config.visualizationStyle || 
        ['technical', 'simple', 'balanced'].includes(config.visualizationStyle);
      
      if (!validStyle) {
        console.error('❌ Invalid visualization style:', config.visualizationStyle);
        return false;
      }
      
      // Validate confidence thresholds
      if (config.confidenceThresholds) {
        const thresholds = config.confidenceThresholds;
        const validThresholds = 
          thresholds.low >= 0 && thresholds.low <= 1 &&
          thresholds.medium >= 0 && thresholds.medium <= 1 &&
          thresholds.high >= 0 && thresholds.high <= 1 &&
          thresholds.low < thresholds.medium &&
          thresholds.medium < thresholds.high;
        
        if (!validThresholds) {
          console.error('❌ Invalid confidence thresholds:', thresholds);
          return false;
        }
      }
      
      // Validate color scheme
      if (config.colorScheme) {
        const requiredColors = [
          'highConfidence', 'mediumConfidence', 'lowConfidence',
          'uncertainty', 'background', 'text'
        ];
        
        const hasAllColors = requiredColors.every(color => 
          config.colorScheme!.hasOwnProperty(color as keyof ColorScheme)
        );
        
        if (!hasAllColors) {
          console.error('❌ Incomplete color scheme configuration');
          return false;
        }
      }
      
      // Validate numeric ranges
      if (config.updateInterval !== undefined && config.updateInterval < 16) {
        console.warn('⚠️ Update interval too low, may cause performance issues');
      }
      
      if (config.historyLength !== undefined && config.historyLength < 10) {
        console.warn('⚠️ History length too small for meaningful trend analysis');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Configuration validation error:', error);
      return false;
    }
  }
};

// Legacy compatibility export
export const createLazyPipelineLoaders = () => {
  console.warn('⚠️ createLazyPipelineLoaders is deprecated, use createPredictionConfidenceVisualization instead');
  return createPredictionConfidenceVisualization();
};