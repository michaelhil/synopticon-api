/**
 * Dependency loading utilities for external ML libraries
 * Provides dynamic loading and availability checking for MediaPipe, TensorFlow.js, etc.
 */

// Dependency registry with CDN URLs and version info
const DEPENDENCIES = {
  tensorflow: {
    name: 'TensorFlow.js',
    globalName: 'tf',
    scripts: [
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js'
    ],
    check: () => typeof window !== 'undefined' && window.tf
  },
  blazeface: {
    name: 'BlazeFace',
    globalName: 'blazeface',
    scripts: [
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js'
    ],
    dependencies: ['tensorflow'],
    check: () => typeof window !== 'undefined' && window.blazeface
  },
  mediapipe: {
    name: 'MediaPipe',
    globalName: 'mediapipe',
    scripts: [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6.1640029074/control_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1640029074/drawing_utils.js'
    ],
    check: () => typeof window !== 'undefined' && window.mediapipe
  },
  mediapipeFaceMesh: {
    name: 'MediaPipe Face Mesh',
    globalName: 'FaceMesh',
    scripts: [
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js'
    ],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.FaceMesh
  },
  mediapipeIris: {
    name: 'MediaPipe Iris',
    globalName: 'Iris', 
    scripts: [
      'https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/iris.js'
    ],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.Iris
  }
};

// Script loading cache to prevent duplicate loads
const loadingCache = new Map();
const loadedScripts = new Set();

// Load a single script with caching and error handling
const loadScript = (url) => {
  if (loadedScripts.has(url)) {
    return Promise.resolve();
  }

  if (loadingCache.has(url)) {
    return loadingCache.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    
    script.onload = () => {
      loadedScripts.add(url);
      resolve();
    };
    
    script.onerror = () => {
      loadingCache.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    };
    
    document.head.appendChild(script);
  });

  loadingCache.set(url, promise);
  return promise;
};

// Load multiple scripts sequentially
const loadScripts = async (urls) => {
  for (const url of urls) {
    await loadScript(url);
  }
};

// Check if dependency is available
export const isDependencyAvailable = (dependencyKey) => {
  const dependency = DEPENDENCIES[dependencyKey];
  if (!dependency) {
    return false;
  }
  
  return dependency.check();
};

// Load a dependency and its prerequisites
export const loadDependency = async (dependencyKey) => {
  const dependency = DEPENDENCIES[dependencyKey];
  
  if (!dependency) {
    throw new Error(`Unknown dependency: ${dependencyKey}`);
  }

  // Check if already available
  if (dependency.check()) {
    return true;
  }

  // Check browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(`Cannot load ${dependency.name} in non-browser environment`);
  }

  try {
    // Load dependencies first
    if (dependency.dependencies) {
      for (const depKey of dependency.dependencies) {
        await loadDependency(depKey);
      }
    }

    // Load the main scripts
    await loadScripts(dependency.scripts);
    
    // Verify loading was successful
    let retries = 0;
    const maxRetries = 10;
    const checkInterval = 100; // ms
    
    while (!dependency.check() && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      retries++;
    }

    if (!dependency.check()) {
      throw new Error(`${dependency.name} failed to initialize after loading`);
    }

    console.log(`✅ ${dependency.name} loaded successfully`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to load ${dependency.name}:`, error);
    throw new Error(`Failed to load ${dependency.name}: ${error.message}`);
  }
};

// Load multiple dependencies
export const loadDependencies = async (dependencyKeys) => {
  const results = new Map();
  
  for (const key of dependencyKeys) {
    try {
      await loadDependency(key);
      results.set(key, { success: true });
    } catch (error) {
      results.set(key, { success: false, error: error.message });
    }
  }
  
  return results;
};

// Get dependency info
export const getDependencyInfo = (dependencyKey) => {
  const dependency = DEPENDENCIES[dependencyKey];
  if (!dependency) {
    return null;
  }

  return {
    name: dependency.name,
    available: dependency.check(),
    dependencies: dependency.dependencies || [],
    scripts: dependency.scripts
  };
};

// Check system capabilities
export const checkSystemCapabilities = () => {
  const capabilities = {};
  
  for (const [key, dependency] of Object.entries(DEPENDENCIES)) {
    capabilities[key] = {
      available: dependency.check(),
      name: dependency.name
    };
  }
  
  return capabilities;
};

// MediaPipe-specific utilities
export const createMediaPipeLoader = () => {
  let faceMesh = null;
  let iris = null;

  const loadFaceMesh = async (options = {}) => {
    await loadDependency('mediapipeFaceMesh');
    
    if (!faceMesh) {
      faceMesh = new window.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });

      faceMesh.setOptions({
        maxNumFaces: options.maxNumFaces || 1,
        refineLandmarks: options.refineLandmarks !== false,
        minDetectionConfidence: options.minDetectionConfidence || 0.5,
        minTrackingConfidence: options.minTrackingConfidence || 0.5
      });
    }

    return faceMesh;
  };

  const loadIris = async (options = {}) => {
    await loadDependency('mediapipeIris');
    
    if (!iris) {
      iris = new window.Iris({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/${file}`;
        }
      });

      iris.setOptions({
        maxNumFaces: options.maxNumFaces || 1,
        minDetectionConfidence: options.minDetectionConfidence || 0.5,
        minTrackingConfidence: options.minTrackingConfidence || 0.5
      });
    }

    return iris;
  };

  const cleanup = async () => {
    if (faceMesh) {
      await faceMesh.close();
      faceMesh = null;
    }
    if (iris) {
      await iris.close();
      iris = null;
    }
  };

  return {
    loadFaceMesh,
    loadIris,
    cleanup,
    isLoaded: () => ({ faceMesh: !!faceMesh, iris: !!iris })
  };
};

// TensorFlow.js specific utilities
export const createTensorFlowLoader = () => {
  let blazefaceModel = null;

  const loadBlazeFace = async (options = {}) => {
    await loadDependencies(['tensorflow', 'blazeface']);
    
    if (!blazefaceModel) {
      blazefaceModel = await window.blazeface.load({
        maxFaces: options.maxFaces || 10,
        iouThreshold: options.iouThreshold || 0.3,
        scoreThreshold: options.scoreThreshold || 0.75
      });
    }

    return blazefaceModel;
  };

  const cleanup = () => {
    if (blazefaceModel && blazefaceModel.dispose) {
      blazefaceModel.dispose();
      blazefaceModel = null;
    }
  };

  return {
    loadBlazeFace,
    cleanup,
    isLoaded: () => ({ blazeface: !!blazefaceModel })
  };
};

// Initialization helper for pipelines
export const createDependencyInitializer = (dependencyKeys) => {
  let loaded = false;
  let loading = false;
  let error = null;

  const initialize = async (options = {}) => {
    if (loaded) return true;
    if (loading) {
      // Wait for current loading to complete
      while (loading && !loaded && !error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (error) throw error;
      return loaded;
    }

    loading = true;
    error = null;

    try {
      const results = await loadDependencies(dependencyKeys);
      
      // Check if all required dependencies loaded successfully
      for (const [key, result] of results.entries()) {
        if (!result.success) {
          throw new Error(`Failed to load ${key}: ${result.error}`);
        }
      }

      loaded = true;
      loading = false;
      return true;

    } catch (err) {
      error = err;
      loading = false;
      throw err;
    }
  };

  const isInitialized = () => loaded;
  const getError = () => error;
  const isLoading = () => loading;

  return { initialize, isInitialized, getError, isLoading };
};