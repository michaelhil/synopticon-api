/**
 * Plugin loader for dynamic imports and plugin management
 */

export const createPluginLoader = () => {
  const loadedPlugins = new Map();
  
  const loadPlugin = async (pluginPath, config = {}) => {
    try {
      // Dynamic import for ES modules
      const plugin = await import(pluginPath);
      
      if (typeof plugin.register !== 'function') {
        throw new Error(`Plugin ${pluginPath} must export a 'register' function`);
      }
      
      const registrationResult = await plugin.register(config);
      loadedPlugins.set(pluginPath, { plugin, config, result: registrationResult });
      
      return registrationResult;
      
    } catch (error) {
      throw new Error(`Failed to load plugin ${pluginPath}: ${error.message}`);
    }
  };
  
  const unloadPlugin = async (pluginPath) => {
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
  
  const getLoadedPlugins = () => {
    return Array.from(loadedPlugins.keys());
  };
  
  const getPluginInfo = (pluginPath) => {
    const entry = loadedPlugins.get(pluginPath);
    return entry ? { config: entry.config, result: entry.result } : null;
  };
  
  const unloadAllPlugins = async () => {
    const results = [];
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