/**
 * Dependency Resolution Module
 * Handles dependency loading with prerequisites and verification
 */

import { loadScript, loadScripts } from './script-loader.js';

// Load a dependency and its prerequisites
export const loadDependency = async (dependencies, dependencyKey) => {
  const dependency = dependencies[dependencyKey];
  
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
        await loadDependency(dependencies, depKey);
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
export const loadDependencies = async (dependencies, dependencyKeys) => {
  const results = new Map();
  
  for (const key of dependencyKeys) {
    try {
      await loadDependency(dependencies, key);
      results.set(key, { success: true });
    } catch (error) {
      results.set(key, { success: false, error: error.message });
    }
  }
  
  return results;
};

// Initialization helper for pipelines
export const createDependencyInitializer = (dependencies, dependencyKeys) => {
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
      const results = await loadDependencies(dependencies, dependencyKeys);
      
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