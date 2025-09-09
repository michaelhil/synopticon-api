/**
 * Pipeline Registration Manager
 * Handles pipeline and plugin registration operations
 */

import { validatePipelineConfig } from '../pipeline.js';
import type { 
  PipelineFactory, 
  PipelineMetadata, 
  PipelineRegistryEntry,
  PluginConfig,
  PluginRegistrationResult,
  PluginLoader,
  RegistryState
} from './types.js';

export interface RegistrationManager {
  register: (name: string, pipelineOrFactory: any, metadata?: PipelineMetadata) => boolean;
  registerPlugin: (pluginPath: string, pluginConfig?: PluginConfig) => Promise<PluginRegistrationResult>;
  registerFromDirectory: (directoryPath: string) => Promise<string[]>;
  unregister: (name: string) => boolean;
  clear: () => Promise<boolean>;
}

/**
 * Create pipeline registration manager
 */
export const createRegistrationManager = (
  state: RegistryState, 
  pluginLoader: PluginLoader
): RegistrationManager => {
  
  /**
   * Register a pipeline directly
   */
  const register = (
    name: string, 
    pipelineOrFactory: any, 
    metadata: PipelineMetadata = {}
  ): boolean => {
    try {
      // Validate if it's a pipeline config
      if (typeof pipelineOrFactory === 'object' && 'process' in pipelineOrFactory) {
        validatePipelineConfig(pipelineOrFactory);
      }
      
      const entry: PipelineRegistryEntry = {
        name,
        factory: typeof pipelineOrFactory === 'function' 
          ? pipelineOrFactory 
          : () => pipelineOrFactory,
        metadata: {
          category: metadata.category || 'general',
          version: metadata.version || '1.0.0',
          description: metadata.description || '',
          author: metadata.author || 'unknown',
          capabilities: metadata.capabilities || [],
          dependencies: metadata.dependencies || [],
          tags: metadata.tags || [],
          registeredAt: Date.now(),
          ...metadata
        } as Required<PipelineMetadata>
      };
      
      state.pipelineFactories.set(name, entry);
      
      // Add to category index
      const { category } = entry.metadata;
      if (!state.categories.has(category)) {
        state.categories.set(category, new Set());
      }
      state.categories.get(category)!.add(name);
      
      console.log(`✅ Pipeline '${name}' registered successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ Pipeline registration failed for '${name}':`, (error as Error).message);
      throw new Error(`Pipeline registration failed for '${name}': ${(error as Error).message}`);
    }
  };
  
  /**
   * Register pipelines from a plugin
   */
  const registerPlugin = async (
    pluginPath: string, 
    pluginConfig: PluginConfig = {}
  ): Promise<PluginRegistrationResult> => {
    try {
      const result = await pluginLoader.loadPlugin(pluginPath, pluginConfig);
      
      // Plugin should return pipeline registrations
      if (result && Array.isArray(result.pipelines)) {
        let successCount = 0;
        const errors: string[] = [];
        
        for (const pipelineInfo of result.pipelines) {
          try {
            register(pipelineInfo.name, pipelineInfo.factory, {
              ...pipelineInfo.metadata,
              plugin: pluginPath
            });
            successCount++;
          } catch (error) {
            errors.push(`${pipelineInfo.name}: ${(error as Error).message}`);
          }
        }
        
        console.log(`🔌 Plugin '${pluginPath}' registered ${successCount}/${result.pipelines.length} pipelines`);
        
        if (errors.length > 0) {
          console.warn(`⚠️ Plugin '${pluginPath}' had ${errors.length} registration errors:`, errors);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Plugin registration failed for '${pluginPath}':`, (error as Error).message);
      throw new Error(`Plugin registration failed: ${(error as Error).message}`);
    }
  };
  
  /**
   * Register pipelines from a directory
   */
  const registerFromDirectory = async (directoryPath: string): Promise<string[]> => {
    try {
      // This would use fs.readdir in a real implementation
      const registeredPlugins: string[] = [];
      
      // Placeholder for directory scanning implementation
      console.log(`📁 Would scan directory: ${directoryPath}`);
      
      // In a real implementation:
      // const files = await fs.readdir(directoryPath);
      // for (const file of files) {
      //   if (file.endsWith('.js') || file.endsWith('.ts')) {
      //     try {
      //       await registerPlugin(path.join(directoryPath, file));
      //       registeredPlugins.push(file);
      //     } catch (error) {
      //       console.warn(`Failed to register plugin ${file}:`, error.message);
      //     }
      //   }
      // }
      
      return registeredPlugins;
      
    } catch (error) {
      console.error(`❌ Directory registration failed for '${directoryPath}':`, (error as Error).message);
      throw new Error(`Directory registration failed: ${(error as Error).message}`);
    }
  };
  
  /**
   * Unregister a pipeline
   */
  const unregister = (name: string): boolean => {
    const entry = state.pipelineFactories.get(name);
    if (!entry) {
      console.warn(`⚠️ Pipeline '${name}' not found for unregistration`);
      return false;
    }
    
    try {
      // Remove from category index
      const { category } = entry.metadata;
      if (state.categories.has(category)) {
        state.categories.get(category)!.delete(name);
        if (state.categories.get(category)!.size === 0) {
          state.categories.delete(category);
        }
      }
      
      // Remove from main registry
      state.pipelineFactories.delete(name);
      
      // Clean up any active instances
      const instancesToCleanup: string[] = [];
      for (const [instanceId, instance] of state.pipelines) {
        if (instance.name === name) {
          if ('cleanup' in instance.instance && typeof instance.instance.cleanup === 'function') {
            (instance.instance.cleanup as () => Promise<void>)().catch((error) => 
              console.warn(`Cleanup failed for instance ${instanceId}:`, error));
          }
          instancesToCleanup.push(instanceId);
        }
      }
      
      instancesToCleanup.forEach(id => state.pipelines.delete(id));
      
      console.log(`✅ Pipeline '${name}' unregistered successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to unregister pipeline '${name}':`, (error as Error).message);
      return false;
    }
  };
  
  /**
   * Clear all registrations
   */
  const clear = async (): Promise<boolean> => {
    try {
      // Cleanup all active instances
      const cleanupPromises: Promise<void>[] = [];
      for (const [, instance] of state.pipelines) {
        if ('cleanup' in instance.instance && typeof instance.instance.cleanup === 'function') {
          cleanupPromises.push((instance.instance.cleanup as () => Promise<void>)());
        }
      }
      
      const results = await Promise.allSettled(cleanupPromises);
      const failures = results.filter(r => r.status === 'rejected').length;
      
      if (failures > 0) {
        console.warn(`⚠️ ${failures} pipeline instances failed to cleanup properly`);
      }
      
      // Clear registries
      state.pipelines.clear();
      state.pipelineFactories.clear();
      state.categories.clear();
      
      // Unload all plugins
      const loadedPlugins = pluginLoader.getLoadedPlugins();
      const pluginCleanupPromises = loadedPlugins.map(pluginPath => 
        pluginLoader.unloadPlugin(pluginPath));
      
      await Promise.allSettled(pluginCleanupPromises);
      
      console.log('🧹 Registry cleared successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to clear registry:', (error as Error).message);
      return false;
    }
  };
  
  return {
    register,
    registerPlugin,
    registerFromDirectory,
    unregister,
    clear
  };
};