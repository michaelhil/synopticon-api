/**
 * WebGL Lazy Loader - Performance-optimized lazy loading for WebGL components
 * Defers expensive WebGL initialization until actually needed
 */

// Lazy WebGL engine loader
let webglEngineInstance = null;
let webglResourcePoolInstance = null;
let webglShadersInstance = null;

export const createLazyWebGLLoader = () => {
  
  const getWebGLEngine = async (canvas) => {
    if (!webglEngineInstance) {
      console.log('🔄 Lazy loading WebGL engine...');
      const { createWebGLEngine } = await import('./webgl-engine.js');
      webglEngineInstance = createWebGLEngine(canvas);
      console.log('✅ WebGL engine lazy loaded');
    }
    return webglEngineInstance;
  };

  const getWebGLResourcePool = async () => {
    if (!webglResourcePoolInstance) {
      console.log('🔄 Lazy loading WebGL resource pool...');
      const { createWebGLResourcePool } = await import('../performance/resource-pool-webgl.js');
      webglResourcePoolInstance = createWebGLResourcePool();
      console.log('✅ WebGL resource pool lazy loaded');
    }
    return webglResourcePoolInstance;
  };

  const getWebGLShaders = async () => {
    if (!webglShadersInstance) {
      console.log('🔄 Lazy loading WebGL shaders...');
      const { createBaseShaders } = await import('../../shared/utils/shaders/base-shaders.js');
      webglShadersInstance = createBaseShaders();
      console.log('✅ WebGL shaders lazy loaded');
    }
    return webglShadersInstance;
  };

  // Pre-load check for WebGL availability (lightweight)
  const checkWebGLSupport = () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const supported = !!gl;
    
    if (gl) {
      // Cleanup test context
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
    
    canvas.remove();
    return supported;
  };

  // WebGL-dependent component loader
  const getWebGLDependentComponent = async (componentName, canvas) => {
    if (!checkWebGLSupport()) {
      throw new Error('WebGL not supported - cannot load WebGL-dependent components');
    }

    const components = {
      'face-processor': async () => {
        const [engine, shaders] = await Promise.all([
          getWebGLEngine(canvas),
          getWebGLShaders()
        ]);
        const { createWebGLFaceProcessor } = await import('../../features/face-detection/webgl-face-processor.js');
        return createWebGLFaceProcessor(engine, shaders);
      },
      
      'image-processor': async () => {
        const [engine, pool] = await Promise.all([
          getWebGLEngine(canvas),
          getWebGLResourcePool()
        ]);
        const { createWebGLImageProcessor } = await import('../engine/webgl-image-processor.js');
        return createWebGLImageProcessor(engine, pool);
      },

      'visualization': async () => {
        const engine = await getWebGLEngine(canvas);
        const { createWebGLVisualization } = await import('../../shared/utils/visualization/webgl-visualization.js');
        return createWebGLVisualization(engine);
      }
    };

    const loader = components[componentName];
    if (!loader) {
      throw new Error(`Unknown WebGL component: ${componentName}`);
    }

    return await loader();
  };

  // Cleanup all lazy-loaded WebGL resources
  const cleanup = async () => {
    const cleanupTasks = [];

    if (webglEngineInstance) {
      cleanupTasks.push((async () => {
        if (webglEngineInstance.buffers?.cleanup) {
          webglEngineInstance.buffers.cleanup();
        }
        if (webglEngineInstance.textures?.cleanup) {
          webglEngineInstance.textures.cleanup();
        }
        webglEngineInstance = null;
      })());
    }

    if (webglResourcePoolInstance?.cleanup) {
      cleanupTasks.push((async () => {
        await webglResourcePoolInstance.cleanup();
        webglResourcePoolInstance = null;
      })());
    }

    if (webglShadersInstance?.cleanup) {
      cleanupTasks.push((async () => {
        webglShadersInstance.cleanup();
        webglShadersInstance = null;
      })());
    }

    await Promise.all(cleanupTasks);
    console.log('✅ WebGL lazy loader cleanup completed');
  };

  return {
    getWebGLEngine,
    getWebGLResourcePool,
    getWebGLShaders,
    getWebGLDependentComponent,
    checkWebGLSupport,
    cleanup
  };
};

// Global lazy WebGL loader instance
export const globalWebGLLoader = createLazyWebGLLoader();

// Convenience factory for WebGL-dependent modules
export const createWebGLDependentFactory = (componentName) => {
  return async (canvas, config = {}) => {
    try {
      return await globalWebGLLoader.getWebGLDependentComponent(componentName, canvas);
    } catch (error) {
      console.warn(`Failed to load WebGL component '${componentName}':`, error.message);
      
      // Fallback to CPU implementation if available
      if (config.fallbackToCPU) {
        console.log(`🔄 Falling back to CPU implementation for ${componentName}...`);
        const fallbackLoader = config.cpuFallbackLoader;
        if (fallbackLoader) {
          return await fallbackLoader();
        }
      }
      
      throw error;
    }
  };
};

// Pre-configured WebGL component factories
export const createLazyWebGLFaceProcessor = createWebGLDependentFactory('face-processor');
export const createLazyWebGLImageProcessor = createWebGLDependentFactory('image-processor');
export const createLazyWebGLVisualization = createWebGLDependentFactory('visualization');