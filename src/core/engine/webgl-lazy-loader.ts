/**
 * WebGL Lazy Loader - Performance-optimized lazy loading for WebGL components
 * Defers expensive WebGL initialization until actually needed
 */

export interface WebGLEngine {
  buffers?: {
    cleanup: () => void;
  };
  textures?: {
    cleanup: () => void;
  };
  [key: string]: unknown;
}

export interface WebGLResourcePool {
  cleanup: () => Promise<void>;
  [key: string]: unknown;
}

export interface WebGLShaders {
  cleanup: () => void;
  [key: string]: unknown;
}

export interface WebGLComponent {
  [key: string]: unknown;
}

export interface WebGLDependentFactoryConfig {
  fallbackToCPU?: boolean;
  cpuFallbackLoader?: () => Promise<any>;
  [key: string]: unknown;
}

export type WebGLComponentName = 'face-processor' | 'image-processor' | 'visualization';

export interface LazyWebGLLoader {
  getWebGLEngine: (canvas: HTMLCanvasElement) => Promise<WebGLEngine>;
  getWebGLResourcePool: () => Promise<WebGLResourcePool>;
  getWebGLShaders: () => Promise<WebGLShaders>;
  getWebGLDependentComponent: (componentName: WebGLComponentName, canvas: HTMLCanvasElement) => Promise<WebGLComponent>;
  checkWebGLSupport: () => boolean;
  cleanup: () => Promise<void>;
}

export type WebGLDependentFactory = (
  canvas: HTMLCanvasElement, 
  config?: WebGLDependentFactoryConfig
) => Promise<WebGLComponent>;

// Lazy WebGL engine loader
let webglEngineInstance: WebGLEngine | null = null;
let webglResourcePoolInstance: WebGLResourcePool | null = null;
let webglShadersInstance: WebGLShaders | null = null;

export const createLazyWebGLLoader = (): LazyWebGLLoader => {
  
  const getWebGLEngine = async (canvas: HTMLCanvasElement): Promise<WebGLEngine> => {
    if (!webglEngineInstance) {
      console.log('🔄 Lazy loading WebGL engine...');
      const { createWebGLEngine } = await import('./webgl-engine.js');
      webglEngineInstance = createWebGLEngine(canvas);
      console.log('✅ WebGL engine lazy loaded');
    }
    return webglEngineInstance;
  };

  const getWebGLResourcePool = async (): Promise<WebGLResourcePool> => {
    if (!webglResourcePoolInstance) {
      console.log('🔄 Lazy loading WebGL resource pool...');
      const { createWebGLResourcePool } = await import('../performance/resource-pool-webgl.js');
      webglResourcePoolInstance = createWebGLResourcePool();
      console.log('✅ WebGL resource pool lazy loaded');
    }
    return webglResourcePoolInstance;
  };

  const getWebGLShaders = async (): Promise<WebGLShaders> => {
    if (!webglShadersInstance) {
      console.log('🔄 Lazy loading WebGL shaders...');
      const { createBaseShaders } = await import('../../shared/utils/shaders/base-shaders.js');
      webglShadersInstance = createBaseShaders();
      console.log('✅ WebGL shaders lazy loaded');
    }
    return webglShadersInstance;
  };

  // Pre-load check for WebGL availability (lightweight)
  const checkWebGLSupport = (): boolean => {
    if (typeof document === 'undefined') return false;
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const supported = Boolean(gl);
    
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
  const getWebGLDependentComponent = async (
    componentName: WebGLComponentName, 
    canvas: HTMLCanvasElement
  ): Promise<WebGLComponent> => {
    if (!checkWebGLSupport()) {
      throw new Error('WebGL not supported - cannot load WebGL-dependent components');
    }

    const components: Record<WebGLComponentName, () => Promise<WebGLComponent>> = {
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
  const cleanup = async (): Promise<void> => {
    const cleanupTasks: Promise<void>[] = [];

    if (webglEngineInstance) {
      cleanupTasks.push((async () => {
        if (webglEngineInstance?.buffers?.cleanup) {
          webglEngineInstance.buffers.cleanup();
        }
        if (webglEngineInstance?.textures?.cleanup) {
          webglEngineInstance.textures.cleanup();
        }
        webglEngineInstance = null;
      })());
    }

    if (webglResourcePoolInstance?.cleanup) {
      cleanupTasks.push((async () => {
        await webglResourcePoolInstance!.cleanup();
        webglResourcePoolInstance = null;
      })());
    }

    if (webglShadersInstance?.cleanup) {
      cleanupTasks.push((async () => {
        webglShadersInstance!.cleanup();
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
export const createWebGLDependentFactory = (componentName: WebGLComponentName): WebGLDependentFactory => {
  return async (canvas: HTMLCanvasElement, config: WebGLDependentFactoryConfig = {}) => {
    try {
      return await globalWebGLLoader.getWebGLDependentComponent(componentName, canvas);
    } catch (error) {
      console.warn(`Failed to load WebGL component '${componentName}':`, (error as Error).message);
      
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