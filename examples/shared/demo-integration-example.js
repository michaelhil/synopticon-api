/**
 * Demo Integration Example - Refactored for better maintainability
 * Shows how to integrate the new component system with demo pages
 * Broken down into focused, single-responsibility functions
 */

import { createLifecycleManager } from './lifecycle-manager.js';
import { createStateManager } from './state-manager.js';
import { createResilientDemo } from './error-boundaries.js';

// Create managers with proper configuration
const createManagers = (config = {}) => {
  const stateManager = createStateManager({
    enableHistory: config.enableHistory ?? true,
    enablePersistence: config.enablePersistence ?? true,
    persistenceKey: config.persistenceKey ?? 'mediapipe-demo-state'
  });

  const lifecycleManager = createLifecycleManager({
    enableMetrics: config.enableMetrics ?? true,
    timeout: config.timeout ?? 10000
  });

  return { stateManager, lifecycleManager };
};

// Helper function to update performance metrics
const updatePerformanceMetrics = (stateManager) => {
  const metrics = stateManager.getState('metrics.performance', {});
  const currentTime = Date.now();
  const fps = metrics.lastFrameTime ? 
    1000 / (currentTime - (metrics.lastFrameTime || currentTime)) : 0;
  
  stateManager.setState('metrics.performance', {
    ...metrics,
    lastFrameTime: currentTime,
    fps: Math.round(fps * 100) / 100,
    totalFrames: (metrics.totalFrames || 0) + 1
  });
};

// Create camera component with proper error handling
const createCameraComponent = (stateManager, lifecycleManager) => {
  return createResilientDemo(async (componentConfig) => {
    const camera = {
      stream: null,
      isActive: false,
      
      async initialize() {
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Camera API not supported');
          }
          console.log('📸 Camera component initialized');
          return true;
        } catch (error) {
          console.error('Camera initialization failed:', error);
          throw error;
        }
      },

      async start() {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: componentConfig?.video?.width || 640, 
              height: componentConfig?.video?.height || 480 
            }
          });
          
          this.isActive = true;
          stateManager.setState('components.camera.active', true);
          console.log('📸 Camera started successfully');
          return this.stream;
        } catch (error) {
          console.error('Camera start failed:', error);
          stateManager.setState('components.camera.error', error.message);
          throw error;
        }
      },

      async stop() {
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        this.isActive = false;
        stateManager.setState('components.camera.active', false);
        console.log('📸 Camera stopped');
      },

      async cleanup() {
        await this.stop();
        lifecycleManager.unregister('camera');
        console.log('📸 Camera cleaned up');
      }
    };

    lifecycleManager.register('camera', camera);
    return camera;
  });
};

// Create MediaPipe processing component
const createMediaPipeComponent = (stateManager, lifecycleManager) => {
  return createResilientDemo(async (componentConfig) => {
    const mediapipe = {
      processor: null,
      isProcessing: false,
      
      async initialize() {
        console.log('🤖 MediaPipe component initialized');
        stateManager.setState('mediapipe.ready', true);
        return true;
      },

      async start() {
        this.isProcessing = true;
        stateManager.setState('mediapipe.processing', true);
        console.log('🔍 MediaPipe started');
      },

      async process(videoFrame) {
        if (!this.isProcessing) return null;
        
        // Debug frame processing if enabled
        if (componentConfig?.debug && videoFrame) {
          console.log('Processing video frame:', { 
            timestamp: videoFrame.timestamp || Date.now(),
            width: videoFrame.width,
            height: videoFrame.height 
          });
        }
        
        // Mock face detection results for demo
        const results = {
          landmarks: Array(componentConfig?.landmarkCount || 468)
            .fill()
            .map(() => ({ 
              x: Math.random(), 
              y: Math.random(), 
              z: Math.random() 
            })),
          confidence: componentConfig?.confidence || 0.95,
          timestamp: Date.now()
        };
        
        stateManager.setState('mediapipe.lastResults', results);
        updatePerformanceMetrics(stateManager);
        
        return results;
      },

      async stop() {
        this.isProcessing = false;
        stateManager.setState('mediapipe.processing', false);
        console.log('🔍 MediaPipe stopped');
      },

      async cleanup() {
        await this.stop();
        stateManager.setState('mediapipe.ready', false);
        lifecycleManager.unregister('mediapipe');
        console.log('🔍 MediaPipe cleaned up');
      }
    };

    lifecycleManager.register('mediapipe', mediapipe);
    return mediapipe;
  }, { name: 'MediaPipeComponent', severity: 'high' });
};

// Create visualization component for rendering
const createVisualizationComponent = (stateManager, lifecycleManager) => {
  return createResilientDemo(async (componentConfig) => {
    const visualization = {
      canvas: null,
      ctx: null,
      
      async initialize() {
        const canvasId = componentConfig?.canvasId || 'demo-canvas';
        this.canvas = document.getElementById(canvasId) || document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (componentConfig?.canvasSize) {
          this.canvas.width = componentConfig.canvasSize.width;
          this.canvas.height = componentConfig.canvasSize.height;
        }
        
        console.log('🎨 Visualization component initialized');
        return true;
      },

      async start() {
        stateManager.setState('visualization.active', true);
        console.log('🎨 Visualization started');
      },

      async render(landmarks, videoElement) {
        if (!this.ctx || !landmarks) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw video frame if provided
        if (videoElement && componentConfig?.showVideo) {
          this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw landmarks
        this.ctx.fillStyle = componentConfig?.landmarkColor || 'red';
        landmarks.forEach(point => {
          this.ctx.fillRect(
            point.x * this.canvas.width - 2,
            point.y * this.canvas.height - 2,
            4, 4
          );
        });
        
        // Update render statistics
        stateManager.updateState('visualization.stats', stats => ({
          ...stats,
          framesRendered: (stats?.framesRendered || 0) + 1,
          lastRender: Date.now()
        }));
      },

      async stop() {
        stateManager.setState('visualization.active', false);
        console.log('🎨 Visualization stopped');
      },

      async cleanup() {
        await this.stop();
        lifecycleManager.unregister('visualization');
        console.log('🎨 Visualization cleaned up');
      }
    };

    lifecycleManager.register('visualization', visualization);
    return visualization;
  });
};

// Create main demo controller with all components
const createDemoController = (stateManager, lifecycleManager, componentFactories) => {
  let components = {};
  
  return {
    async initialize() {
      console.log('🎬 Initializing integrated demo...');
      stateManager.setState('demo.status', 'initializing');
      
      try {
        // Initialize all components
        components.camera = await componentFactories.camera({});
        components.mediapipe = await componentFactories.mediapipe({});
        components.visualization = await componentFactories.visualization({});
        
        // Initialize each component
        await Promise.all([
          components.camera.initialize(),
          components.mediapipe.initialize(), 
          components.visualization.initialize()
        ]);
        
        stateManager.setState('demo.status', 'ready');
        console.log('✅ Demo initialization complete');
        return true;
        
      } catch (error) {
        console.error('❌ Demo initialization failed:', error);
        stateManager.setState('demo.status', 'error');
        stateManager.setState('demo.error', error.message);
        throw error;
      }
    },

    async start() {
      console.log('▶️ Starting demo...');
      stateManager.setState('demo.status', 'starting');
      
      try {
        await components.camera.start();
        await components.mediapipe.start();
        await components.visualization.start();
        
        stateManager.setState('demo.status', 'running');
        console.log('🚀 Demo is now running!');
        return true;
        
      } catch (error) {
        console.error('❌ Demo start failed:', error);
        stateManager.setState('demo.status', 'error');
        throw error;
      }
    },

    async stop() {
      console.log('⏸️ Stopping demo...');
      stateManager.setState('demo.status', 'stopping');
      
      await Promise.all([
        components.camera?.stop(),
        components.mediapipe?.stop(),
        components.visualization?.stop()
      ].filter(Boolean));
      
      stateManager.setState('demo.status', 'stopped');
      console.log('🛑 Demo stopped');
    },

    async cleanup() {
      console.log('🧹 Cleaning up demo...');
      
      await Promise.all([
        components.camera?.cleanup(),
        components.mediapipe?.cleanup(),
        components.visualization?.cleanup()
      ].filter(Boolean));
      
      components = {};
      stateManager.setState('demo.status', 'cleaned');
      console.log('✨ Demo cleanup complete');
    },

    getComponents: () => components,
    getState: () => ({
      status: stateManager.getState('demo.status'),
      metrics: stateManager.getState('metrics.performance', {}),
      errors: stateManager.getState('components.errors', {})
    })
  };
};

// Setup state change subscriptions for debugging
const setupStateSubscriptions = (stateManager) => {
  stateManager.subscribe('demo.status', (status, oldStatus) => {
    console.log(`Demo status: ${oldStatus} → ${status}`);
  });

  stateManager.subscribe('components.errors', (errors) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      console.warn(`Component errors detected: ${errorCount}`);
    }
  });
};

// Main factory function - creates integrated demo
export const createIntegratedMediaPipeDemo = (config = {}) => {
  const { stateManager, lifecycleManager } = createManagers(config);
  
  const componentFactories = {
    camera: createCameraComponent(stateManager, lifecycleManager),
    mediapipe: createMediaPipeComponent(stateManager, lifecycleManager),
    visualization: createVisualizationComponent(stateManager, lifecycleManager)
  };
  
  const demoController = createDemoController(stateManager, lifecycleManager, componentFactories);
  
  // Setup debugging subscriptions
  setupStateSubscriptions(stateManager);
  
  return demoController;
};

// Simplified initialization function for demo pages
export const initializeDemo = async () => {
  try {
    console.log('🎬 Starting integrated demo initialization...');
    
    const demo = createIntegratedMediaPipeDemo();
    
    // Initialize and start the demo
    await demo.initialize();
    await demo.start();
    
    console.log('🎉 Demo is now running with enhanced integration!');
    
    // Expose demo controller globally for manual control
    window.demoController = demo;
    
    return demo;
    
  } catch (error) {
    console.error('❌ Demo initialization failed:', error);
    
    // Show error to user if error display element exists
    const errorElement = document.getElementById('error-display');
    if (errorElement) {
      errorElement.textContent = `Demo initialization failed: ${error.message}`;
      errorElement.style.display = 'block';
    }
    
    throw error;
  }
};