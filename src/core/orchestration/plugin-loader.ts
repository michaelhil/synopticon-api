/**
 * Plugin loader for dynamic imports and plugin management
 */

// Plugin interfaces
interface Plugin {
  register(config: any): Promise<any> | any;
  cleanup?(): Promise<void> | void;
}

interface LoadedPlugin {
  plugin: Plugin;
  config: any;
  result: any;
}

interface PluginLoader {
  loadPlugin(pluginPath: string, config?: any): Promise<any>;
  unloadPlugin(pluginPath: string): Promise<boolean>;
  getLoadedPlugins(): string[];
  getPluginInfo(pluginPath: string): { config: any; result: any } | null;
  unloadAllPlugins(): Promise<boolean[]>;
}

export const createPluginLoader = (): PluginLoader => {
  const loadedPlugins = new Map<string, LoadedPlugin>();
  
  const loadPlugin = async (pluginPath: string, config: any = {}): Promise<any> => {
    try {
      // Dynamic import for ES modules
      const plugin = await import(pluginPath);
      
      if (typeof plugin.register !== 'function') {
        throw new Error(`Plugin ${pluginPath} must export a 'register' function`);
      }
      
      const registrationResult = await plugin.register(config);
      loadedPlugins.set(pluginPath, { plugin, config, result: registrationResult });
      
      return registrationResult;
      
    } catch (error: any) {
      throw new Error(`Failed to load plugin ${pluginPath}: ${error.message}`);
    }
  };
  
  const unloadPlugin = async (pluginPath: string): Promise<boolean> => {
    const entry = loadedPlugins.get(pluginPath);
    if (!entry) return false;
    
    try {
      if (entry.plugin.cleanup) {
        await entry.plugin.cleanup();
      }
      loadedPlugins.delete(pluginPath);
      return true;
    } catch (error) {
      console.warn(`Plugin cleanup failed for ${pluginPath}:`, error);
      loadedPlugins.delete(pluginPath); // Remove anyway
      return false;
    }
  };
  
  const getLoadedPlugins = (): string[] => {
    return Array.from(loadedPlugins.keys());
  };
  
  const getPluginInfo = (pluginPath: string): { config: any; result: any } | null => {
    const entry = loadedPlugins.get(pluginPath);
    return entry ? { config: entry.config, result: entry.result } : null;
  };
  
  const unloadAllPlugins = async (): Promise<boolean[]> => {
    const results: boolean[] = [];
    for (const pluginPath of loadedPlugins.keys()) {
      results.push(await unloadPlugin(pluginPath));
    }
    return results;
  };
  
  return {
    loadPlugin,
    unloadPlugin,
    getLoadedPlugins,
    getPluginInfo,
    unloadAllPlugins
  };
};