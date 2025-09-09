/**
 * Standard Interface for Face Analysis Modules
 * All detection, analysis, and processing modules must implement this interface
 */

// Performance metrics interface
export interface PerformanceMetrics {
  cpu: string | number;
  gpu: string | number;
  memory: string | number;
  latency: string | number;
}

// Accuracy metrics interface
export interface AccuracyMetrics {
  precision: string | number;
  recall: string | number;
  f1Score: string | number;
}

// Module metadata interface
export interface ModuleMetadata {
  name: string;
  version: string;
  type: string;
  capabilities: string[];
  dependencies: string[];
  performance: PerformanceMetrics;
  accuracy: AccuracyMetrics;
}

// Runtime performance tracking interface
export interface RuntimePerformanceMetrics {
  averageProcessingTime: number;
  totalProcessed: number;
  errorRate: number;
  lastProcessingTime: number;
  processingTimes: number[];
}

// Module state interface
export interface ModuleState {
  config: Record<string, any>;
  isInitialized: boolean;
  metadata: ModuleMetadata;
  performanceMetrics: RuntimePerformanceMetrics;
}

// Processing context interface
export interface ProcessingContext {
  timestamp?: number;
  source?: string;
  quality?: number;
  [key: string]: any;
}

// Module implementation interface
export interface ModuleImplementation {
  metadata: ModuleMetadata;
  initialize: (config: Record<string, any>) => Promise<any>;
  process: (input: any, context: ProcessingContext, state: ModuleState) => Promise<any>;
  cleanup?: (state: ModuleState) => void;
}

// Analysis module interface
export interface AnalysisModule {
  initialize: (config?: Record<string, any>) => Promise<any>;
  process: (input: any, context?: ProcessingContext) => Promise<any>;
  cleanup: () => void;
  validateInput: (input: any) => boolean;
  getPerformanceMetrics: () => Omit<RuntimePerformanceMetrics, 'processingTimes'>;
  getMetadata: () => ModuleMetadata;
  getConfig: () => Record<string, any>;
  isReady: () => boolean;
}

// Module factory function type
export type ModuleFactory = () => Promise<ModuleImplementation> | ModuleImplementation;

// Module registry interface
export interface ModuleRegistry {
  register: (category: string, name: string, moduleFactory: ModuleFactory) => void;
  getAvailable: (category?: string) => string[] | Record<string, string[]>;
  load: (category: string, name: string, config?: Record<string, any>) => Promise<AnalysisModule>;
  unload: (category: string, name: string) => void;
  clear: () => void;
}

// Module metadata factory
export const createModuleMetadata = (overrides: Partial<ModuleMetadata> = {}): ModuleMetadata => ({
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
export const createAnalysisModule = (implementation: ModuleImplementation): AnalysisModule => {
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

  const state: ModuleState = {
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

  const validateInput = (input: any): boolean => {
    return input !== null && input !== undefined;
  };

  const updatePerformanceMetrics = (processingTime: number, hasError: boolean = false): void => {
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

  const initialize = async (config: Record<string, any> = {}): Promise<any> => {
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

  const process = async (input: any, context: ProcessingContext = {}): Promise<any> => {
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

  const cleanup = (): void => {
    if (implementation.cleanup) {
      implementation.cleanup(state);
    }
    state.isInitialized = false;
  };

  const getPerformanceMetrics = (): Omit<RuntimePerformanceMetrics, 'processingTimes'> => ({
    averageProcessingTime: state.performanceMetrics.averageProcessingTime,
    totalProcessed: state.performanceMetrics.totalProcessed,
    errorRate: state.performanceMetrics.errorRate,
    lastProcessingTime: state.performanceMetrics.lastProcessingTime
  });

  const getMetadata = (): ModuleMetadata => ({ ...state.metadata });
  const getConfig = (): Record<string, any> => ({ ...state.config });
  const isReady = (): boolean => state.isInitialized;

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
export const createModuleRegistry = (): ModuleRegistry => {
  const state = {
    modules: new Map<string, Map<string, ModuleFactory>>(),
    loadedModules: new Map<string, AnalysisModule>()
  };

  const register = (category: string, name: string, moduleFactory: ModuleFactory): void => {
    if (!state.modules.has(category)) {
      state.modules.set(category, new Map());
    }
    state.modules.get(category)!.set(name, moduleFactory);
  };

  const getAvailable = (category?: string): string[] | Record<string, string[]> => {
    if (category) {
      const categoryModules = state.modules.get(category);
      return categoryModules ? Array.from(categoryModules.keys()) : [];
    }
    
    const all: Record<string, string[]> = {};
    for (const [cat, modules] of state.modules) {
      all[cat] = Array.from(modules.keys());
    }
    return all;
  };

  const load = async (category: string, name: string, config: Record<string, any> = {}): Promise<AnalysisModule> => {
    const moduleKey = `${category}:${name}`;
    
    // Return cached module if already loaded
    if (state.loadedModules.has(moduleKey)) {
      return state.loadedModules.get(moduleKey)!;
    }

    const categoryModules = state.modules.get(category);
    if (!categoryModules || !categoryModules.has(name)) {
      throw new Error(`Module ${category}:${name} not registered`);
    }

    const moduleFactory = categoryModules.get(name)!;
    const module = await moduleFactory();
    const moduleInstance = createAnalysisModule(module);
    
    // Initialize the module
    await moduleInstance.initialize(config);
    
    // Cache the loaded module
    state.loadedModules.set(moduleKey, moduleInstance);
    
    return moduleInstance;
  };

  const unload = (category: string, name: string): void => {
    const moduleKey = `${category}:${name}`;
    const module = state.loadedModules.get(moduleKey);
    
    if (module) {
      module.cleanup();
      state.loadedModules.delete(moduleKey);
    }
  };

  const clear = (): void => {
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
