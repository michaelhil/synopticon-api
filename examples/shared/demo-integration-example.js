/**
 * Demo Integration Example
 * Shows how to integrate the new component system with demo pages
 */

import { createComponentIntegrationManager } from './component-integration.js';
import { createLifecycleManager } from './lifecycle-manager.js';
import { createStateManager } from './state-manager.js';
import { createResilientDemo } from './error-boundaries.js';

// Example integration for MediaPipe demo
export const createIntegratedMediaPipeDemo = (config = {}) => {
  // Create managers
  const stateManager = createStateManager({
    enableHistory: true,
    enablePersistence: true,
    persistenceKey: 'mediapipe-demo-state'
  });

  const lifecycleManager = createLifecycleManager({
    enableMetrics: true,
    timeout: 10000
  });

  const componentManager = createComponentIntegrationManager({
    maxRetries: 3,
    retryDelay: 1000
  });

  // Define component factories with error handling
  const createCameraComponent = createResilientDemo(async (config) => {
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
            video: { width: 640, height: 480 }
          });
          this.isActive = true;
          stateManager.setState('camera.active', true);
          console.log('📸 Camera started');
          return this.stream;
        } catch (error) {
          stateManager.setState('camera.error', error.message);
          throw error;
        }
      },

      async stop() {
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        this.isActive = false;
        stateManager.setState('camera.active', false);
        console.log('📸 Camera stopped');
      },

      async cleanup() {
        await this.stop();
        console.log('📸 Camera cleaned up');
      }
    };

    return camera;
  }, {
    name: 'CameraComponent',
    severity: 'high'
  });

  const createMediaPipeComponent = createResilientDemo(async (config) => {
    const mediapipe = {
      faceMesh: null,
      isProcessing: false,
      
      async initialize() {
        try {
          // In real implementation, this would initialize MediaPipe
          console.log('🔍 MediaPipe component initialized');
          stateManager.setState('mediapipe.ready', true);
          return true;
        } catch (error) {
          stateManager.setState('mediapipe.error', error.message);
          throw error;
        }
      },

      async start() {
        this.isProcessing = true;
        stateManager.setState('mediapipe.processing', true);
        console.log('🔍 MediaPipe started');
      },

      async process(videoFrame) {
        if (!this.isProcessing) return null;
        
        // Mock face detection results
        const results = {
          landmarks: Array(468).fill().map(() => ({ x: Math.random(), y: Math.random(), z: Math.random() })),
          confidence: 0.95,
          timestamp: Date.now()
        };
        
        stateManager.setState('mediapipe.lastResults', results);
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
        console.log('🔍 MediaPipe cleaned up');
      }
    };

    return mediapipe;
  }, {
    name: 'MediaPipeComponent',
    severity: 'high'
  });

  const createVisualizationComponent = createResilientDemo(async (config) => {
    const visualization = {
      canvas: null,
      ctx: null,
      
      async initialize() {
        this.canvas = document.getElementById('demo-canvas') || document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
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
        
        // Draw landmarks
        this.ctx.fillStyle = 'red';
        landmarks.forEach(point => {
          this.ctx.fillRect(
            point.x * this.canvas.width - 2,
            point.y * this.canvas.height - 2,
            4, 4
          );
        });
        
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
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        console.log('🎨 Visualization cleaned up');
      }
    };

    return visualization;
  }, {
    name: 'VisualizationComponent',
    severity: 'medium'
  });

  // Register components with dependencies
  lifecycleManager.registerComponent('camera', createCameraComponent, {
    required: true,
    autoStart: true
  });

  lifecycleManager.registerComponent('mediapipe', createMediaPipeComponent, {
    dependencies: ['camera'],
    required: true,
    autoStart: true
  });

  lifecycleManager.registerComponent('visualization', createVisualizationComponent, {
    dependencies: ['mediapipe'],
    required: false,
    autoStart: true
  });

  // Add lifecycle hooks
  lifecycleManager.addGlobalHook('afterInit', ({ component, state }) => {
    console.log(`✅ ${component} initialized successfully`);
    stateManager.updateState('components.status', status => ({
      ...status,
      [component]: 'initialized'
    }));
  });

  lifecycleManager.addGlobalHook('onError', ({ component, error }) => {
    console.error(`❌ ${component} error:`, error);
    stateManager.updateState('components.errors', errors => ({
      ...errors,
      [component]: { message: error.message, timestamp: Date.now() }
    }));
  });

  // Create main demo controller
  const demoController = {
    isRunning: false,
    animationFrame: null,

    async initialize() {
      console.log('🚀 Initializing integrated MediaPipe demo...');
      
      // Initialize state
      stateManager.setState('demo.status', 'initializing');
      stateManager.setState('components.status', {});
      stateManager.setState('components.errors', {});
      
      try {
        const components = await lifecycleManager.initializeAll();
        console.log('✅ All components initialized');
        stateManager.setState('demo.status', 'ready');
        return components;
      } catch (error) {
        stateManager.setState('demo.status', 'error');
        stateManager.setState('demo.error', error.message);
        throw error;
      }
    },

    async start() {
      if (this.isRunning) return;
      
      try {
        console.log('🚀 Starting demo...');
        stateManager.setState('demo.status', 'starting');
        
        await lifecycleManager.startAll();
        
        this.isRunning = true;
        stateManager.setState('demo.status', 'running');
        stateManager.setState('demo.startTime', Date.now());
        
        // Start processing loop
        this.startProcessingLoop();
        
        console.log('✅ Demo started successfully');
      } catch (error) {
        stateManager.setState('demo.status', 'error');
        stateManager.setState('demo.error', error.message);
        throw error;
      }
    },

    startProcessingLoop() {
      const processFrame = async () => {
        if (!this.isRunning) return;
        
        try {
          const camera = lifecycleManager.getComponent('camera');
          const mediapipe = lifecycleManager.getComponent('mediapipe');
          const visualization = lifecycleManager.getComponent('visualization');
          
          if (camera && mediapipe && visualization && camera.stream) {
            // Process current video frame
            const results = await mediapipe.process(camera.stream);
            
            if (results) {
              await visualization.render(results.landmarks);
              
              // Update performance metrics
              stateManager.updateState('demo.metrics', metrics => ({
                ...metrics,
                fps: this.calculateFPS(),
                processedFrames: (metrics?.processedFrames || 0) + 1,
                lastUpdate: Date.now()
              }));
            }
          }
        } catch (error) {
          console.error('Processing loop error:', error);
          stateManager.updateState('demo.processingErrors', count => (count || 0) + 1);
        }
        
        this.animationFrame = requestAnimationFrame(processFrame);
      };
      
      this.animationFrame = requestAnimationFrame(processFrame);
    },

    calculateFPS() {
      const metrics = stateManager.getState('demo.metrics', {});
      const now = Date.now();
      const lastUpdate = metrics.lastUpdate || now;
      const timeDiff = now - lastUpdate;
      
      return timeDiff > 0 ? Math.round(1000 / timeDiff) : 0;
    },

    async stop() {
      if (!this.isRunning) return;
      
      console.log('⏹️ Stopping demo...');
      this.isRunning = false;
      stateManager.setState('demo.status', 'stopping');
      
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      
      await lifecycleManager.stopAll();
      
      stateManager.setState('demo.status', 'stopped');
      console.log('✅ Demo stopped');
    },

    async cleanup() {
      await this.stop();
      await lifecycleManager.cleanupAll();
      stateManager.resetState();
      console.log('🧹 Demo cleaned up');
    },

    getStatus() {
      return {
        isRunning: this.isRunning,
        state: stateManager.getState('demo.status'),
        components: lifecycleManager.getStatus(),
        metrics: stateManager.getState('demo.metrics', {}),
        errors: stateManager.getState('components.errors', {})
      };
    }
  };

  // Subscribe to state changes for debugging
  stateManager.subscribe('demo.status', (status, oldStatus) => {
    console.log(`Demo status: ${oldStatus} → ${status}`);
  });

  stateManager.subscribe('components.errors', (errors) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      console.warn(`Component errors detected: ${errorCount}`);
    }
  });

  return demoController;
};

// Example usage in demo page
export const initializeDemo = async () => {
  try {
    console.log('🎬 Starting integrated demo initialization...');
    
    const demo = createIntegratedMediaPipeDemo();
    
    // Initialize the demo
    await demo.initialize();
    
    // Start the demo
    await demo.start();
    
    console.log('🎉 Demo is now running with enhanced integration!');
    
    // Return demo controller for manual control
    window.demoController = demo;
    
    return demo;
    
  } catch (error) {
    console.error('❌ Demo initialization failed:', error);
    
    // Show error to user
    const errorElement = document.getElementById('error-display');
    if (errorElement) {
      errorElement.textContent = `Demo initialization failed: ${error.message}`;
      errorElement.style.display = 'block';
    }
    
    throw error;
  }
};

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDemo);
  } else {
    initializeDemo();
  }
}