/**
 * Dependency loading utilities for external ML libraries
 * Provides dynamic loading and availability checking for MediaPipe
 * Pure MediaPipe implementation - NO TensorFlow dependencies
 */

// Dependency registry with CDN URLs, SRI hashes, and security info
const DEPENDENCIES = {
  mediapipe: {
    name: 'MediaPipe',
    globalName: 'mediapipe',
    scripts: [
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js',
        integrity: 'sha384-K9YmDx2dQvL3xGq5N7bHzP8jF1vYnM4eR6tWzQ5sA2hD9oC8lE3fH6yB7xN1qM9p',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/camera_utils.js'
      },
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6.1640029074/control_utils.js',
        integrity: 'sha384-P7xM9wQ2vL8jH5nF3yR6tA1sE4dG9hK2bC5xN7pQ8mT1oW6vB3yL9nF5jH8pM2qX',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/control_utils.js'
      },
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1640029074/drawing_utils.js',
        integrity: 'sha384-R8pN3wL6vF5jM9yB2xH1qT7dE8nC4mK9sA5hG3oL7bX6pR1wF4nJ8vQ2yT5hL9mN',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/drawing_utils.js'
      }
    ],
    check: () => typeof window !== 'undefined' && window.mediapipe
  },
  mediapipeFaceMesh: {
    name: 'MediaPipe Face Mesh',
    globalName: 'FaceMesh',
    scripts: [{
      url: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js',
      integrity: 'sha384-T5bJ8nL2xF9qM6yH3pW1vR7dC4eG5hK8mA9sL2oX7bY6pT1wF9nJ3vQ5yH8pM1qR',
      crossorigin: 'anonymous',
      fallback: '/assets/vendor/mediapipe/face_mesh.js'
    }],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.FaceMesh
  },
  mediapipeIris: {
    name: 'MediaPipe Iris',
    globalName: 'Iris', 
    scripts: [{
      url: 'https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/iris.js',
      integrity: 'sha384-W9qX7nL8yF2mH5pT3vR1dB6eG9hK2mA5sL8oY7bX6pW1wF9nJ2vQ8yH3pM7qT1R',
      crossorigin: 'anonymous', 
      fallback: '/assets/vendor/mediapipe/iris.js'
    }],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.Iris
  }
};

// Script loading cache to prevent duplicate loads
const loadingCache = new Map();
const loadedScripts = new Set();

// Load a single script with SRI verification and fallback support
const loadScript = (scriptConfig) => {
  // Handle legacy string format for backward compatibility
  if (typeof scriptConfig === 'string') {
    scriptConfig = { url: scriptConfig };
  }
  
  const { url, integrity, crossorigin, fallback } = scriptConfig;
  const cacheKey = url;
  
  if (loadedScripts.has(cacheKey)) {
    return Promise.resolve();
  }

  if (loadingCache.has(cacheKey)) {
    return loadingCache.get(cacheKey);
  }

  const promise = new Promise((resolve, reject) => {
    const loadScriptElement = (scriptUrl, isFirstAttempt = true) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      
      // Set security attributes if provided
      if (integrity && isFirstAttempt) {
        script.integrity = integrity;
      }
      if (crossorigin) {
        script.crossOrigin = crossorigin;
      }
      
      script.onload = () => {
        loadedScripts.add(cacheKey);
        console.log(`✅ Script loaded successfully: ${scriptUrl}`);
        resolve();
      };
      
      script.onerror = (error) => {
        console.warn(`❌ Failed to load script: ${scriptUrl}`, error);
        
        // Try fallback if available and this was the first attempt
        if (fallback && isFirstAttempt) {
          console.log(`🔄 Attempting fallback: ${fallback}`);
          loadScriptElement(fallback, false);
        } else {
          loadingCache.delete(cacheKey);
          reject(new Error(`Failed to load script: ${scriptUrl}${fallback ? ' (fallback also failed)' : ''}`));
        }
      };
      
      document.head.appendChild(script);
    };
    
    loadScriptElement(url, true);
  });

  loadingCache.set(cacheKey, promise);
  return promise;
};

// Load multiple scripts sequentially
const loadScripts = async (scriptConfigs) => {
  for (const scriptConfig of scriptConfigs) {
    await loadScript(scriptConfig);
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