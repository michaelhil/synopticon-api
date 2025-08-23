/**
 * Standard Interface for Face Analysis Modules
 * All detection, analysis, and processing modules must implement this interface
 */

// Module metadata factory
export const createModuleMetadata = (overrides = {}) => ({
  name: 'unknown',
  version: '1.0.0',
  type: 'unknown',
  capabilities: [],
  dependencies: [],
  performance: {
    cpu: 'unknown',
    gpu: 'unknown',
    memory: 'unknown',
    latency: 'unknown'
  },
  accuracy: {
    precision: 'unknown',
    recall: 'unknown',
    f1Score: 'unknown'
  },
  ...overrides
});

// Base module factory function
export const createAnalysisModule = (implementation) => {
  // Validate required implementation methods
  if (!implementation.initialize) {
    throw new Error('Module must implement initialize() function');
  }
  if (!implementation.process) {
    throw new Error('Module must implement process() function');
  }
  if (!implementation.metadata) {
    throw new Error('Module must provide metadata object');
  }

  const state = {
    config: {},
    isInitialized: false,
    metadata: implementation.metadata,
    performanceMetrics: {
      averageProcessingTime: 0,
      totalProcessed: 0,
      errorRate: 0,
      lastProcessingTime: 0,
      processingTimes: []
    }
  };

  const validateInput = (input) => {
    return input !== null && input !== undefined;
  };

  const updatePerformanceMetrics = (processingTime, hasError = false) => {
    state.performanceMetrics.totalProcessed++;
    state.performanceMetrics.lastProcessingTime = processingTime;
    
    // Keep rolling average of last 100 processing times
    state.performanceMetrics.processingTimes.push(processingTime);
    if (state.performanceMetrics.processingTimes.length > 100) {
      state.performanceMetrics.processingTimes.shift();
    }
    
    state.performanceMetrics.averageProcessingTime = 
      state.performanceMetrics.processingTimes.reduce((a, b) => a + b, 0) / 
      state.performanceMetrics.processingTimes.length;

    if (hasError) {
      state.performanceMetrics.errorRate = 
        (state.performanceMetrics.errorRate * (state.performanceMetrics.totalProcessed - 1) + 1) / 
        state.performanceMetrics.totalProcessed;
    }
  };

  const initialize = async (config = {}) => {
    state.config = { ...state.config, ...config };
    
    try {
      const result = await implementation.initialize(state.config);
      state.isInitialized = true;
      return result;
    } catch (error) {
      state.isInitialized = false;
      throw error;
    }
  };

  const process = async (input, context = {}) => {
    if (!state.isInitialized) {
      throw new Error('Module not initialized. Call initialize() first.');
    }
    
    if (!validateInput(input)) {
      throw new Error('Invalid input provided to module');
    }

    const startTime = performance.now();
    
    try {
      const result = await implementation.process(input, context, state);
      const processingTime = performance.now() - startTime;
      updatePerformanceMetrics(processingTime, false);
      return result;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      updatePerformanceMetrics(processingTime, true);
      throw error;
    }
  };

  const cleanup = () => {
    if (implementation.cleanup) {
      implementation.cleanup(state);
    }
    state.isInitialized = false;
  };

  const getPerformanceMetrics = () => ({
    ...state.performanceMetrics,
    processingTimes: undefined // Don't expose internal array
  });

  const getMetadata = () => ({ ...state.metadata });
  const getConfig = () => ({ ...state.config });
  const isReady = () => state.isInitialized;

  return {
    initialize,
    process,
    cleanup,
    validateInput,
    getPerformanceMetrics,
    getMetadata,
    getConfig,
    isReady
  };
};

// Module registry for dynamic loading
export const createModuleRegistry = () => {
  const state = {
    modules: new Map(),
    loadedModules: new Map()
  };

  const register = (category, name, moduleFactory) => {
    if (!state.modules.has(category)) {
      state.modules.set(category, new Map());
    }
    state.modules.get(category).set(name, moduleFactory);
  };

  const getAvailable = (category = null) => {
    if (category) {
      const categoryModules = state.modules.get(category);
      return categoryModules ? Array.from(categoryModules.keys()) : [];
    }
    
    const all = {};
    for (const [cat, modules] of state.modules) {
      all[cat] = Array.from(modules.keys());
    }
    return all;
  };

  const load = async (category, name, config = {}) => {
    const moduleKey = `${category}:${name}`;
    
    // Return cached module if already loaded
    if (state.loadedModules.has(moduleKey)) {
      return state.loadedModules.get(moduleKey);
    }

    const categoryModules = state.modules.get(category);
    if (!categoryModules || !categoryModules.has(name)) {
      throw new Error(`Module ${category}:${name} not registered`);
    }

    const moduleFactory = categoryModules.get(name);
    const module = await moduleFactory();
    const moduleInstance = createAnalysisModule(module);
    
    // Initialize the module
    await moduleInstance.initialize(config);
    
    // Cache the loaded module
    state.loadedModules.set(moduleKey, moduleInstance);
    
    return moduleInstance;
  };

  const unload = (category, name) => {
    const moduleKey = `${category}:${name}`;
    const module = state.loadedModules.get(moduleKey);
    
    if (module) {
      module.cleanup();
      state.loadedModules.delete(moduleKey);
    }
  };

  const clear = () => {
    // Cleanup all loaded modules
    for (const module of state.loadedModules.values()) {
      module.cleanup();
    }
    state.loadedModules.clear();
  };

  return {
    register,
    getAvailable,
    load,
    unload,
    clear
  };
};