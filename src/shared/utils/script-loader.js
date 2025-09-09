/**
 * Script Loading Module  
 * Handles individual script loading with SRI verification and fallback support
 */

// Script loading cache to prevent duplicate loads
const loadingCache = new Map();
const loadedScripts = new Set();

// Load a single script with SRI verification and fallback support
export const loadScript = (scriptConfig) => {
  // Handle string format
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
export const loadScripts = async (scriptConfigs) => {
  for (const scriptConfig of scriptConfigs) {
    await loadScript(scriptConfig);
  }
};

// Get loading status
export const getScriptStatus = (url) => {
  return {
    isLoaded: loadedScripts.has(url),
    isLoading: loadingCache.has(url)
  };
};

// Clear caches (for testing/cleanup)
export const clearScriptCache = () => {
  loadingCache.clear();
  loadedScripts.clear();
};
