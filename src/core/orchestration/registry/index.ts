/**
 * Modular Pipeline Registry System
 * Composed from specialized management modules
 */

import { createPluginLoader } from './plugin-loader.js';
import { createRegistrationManager } from './registration-manager.js';
import { createDiscoveryManager } from './discovery-manager.js';
import { createLifecycleManager } from './lifecycle-manager.js';
import { createHealthManager } from './health-manager.js';

import type { 
  PipelineRegistry,
  RegistryState,
  PipelineMetadata,
  PluginConfig,
  PluginRegistrationResult,
  SearchResult,
  RegistryStats,
  RegistryHealth,
  PipelineFactory
} from './types.js';

export * from './types.js';

/**
 * Create the main pipeline registry with modular components
 */
export const createPipelineRegistry = (): PipelineRegistry => {
  // Initialize shared state
  const state: RegistryState = {
    pipelines: new Map(),
    pipelineFactories: new Map(),
    categories: new Map()
  };
  
  // Create component managers
  const pluginLoader = createPluginLoader();
  const registrationManager = createRegistrationManager(state, pluginLoader);
  const discoveryManager = createDiscoveryManager(state);
  const lifecycleManager = createLifecycleManager(state);
  const healthManager = createHealthManager(state, pluginLoader);
  
  return {
    // Registration operations (delegated to RegistrationManager)
    register: registrationManager.register,
    registerPlugin: registrationManager.registerPlugin,
    registerFromDirectory: registrationManager.registerFromDirectory,
    unregister: registrationManager.unregister,
    clear: registrationManager.clear,
    
    // Pipeline creation (delegated to LifecycleManager)
    create: lifecycleManager.create,
    
    // Discovery operations (delegated to DiscoveryManager)
    list: discoveryManager.list,
    getInfo: discoveryManager.getInfo,
    findByCapability: discoveryManager.findByCapability,
    findByCategory: discoveryManager.findByCategory,
    findByTags: discoveryManager.findByTags,
    search: discoveryManager.search,
    
    // Health and statistics (delegated to HealthManager)
    getStats: healthManager.getStats,
    getHealth: healthManager.getHealth,
    
    // Plugin loader access
    pluginLoader
  };
};

// Re-export key factory functions and types
export { createPluginLoader } from './plugin-loader.js';
export { autoRegisterBuiltins } from './builtin-registrations.js';

// Legacy compatibility - maintain old interface
export const createLazyPipelineLoaders = () => {
  console.warn('createLazyPipelineLoaders is deprecated, use autoRegisterBuiltins instead');
  // Return empty implementation for backwards compatibility
  return {
    getMediaPipeFacePipeline: async () => null,
    getMediaPipeMeshPipeline: async () => null,
    getEmotionAnalysisPipeline: async () => null,
    getEyeTrackingPipeline: async () => null
  };
};