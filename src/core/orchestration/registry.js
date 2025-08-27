/**
 * Pipeline Registry and Plugin System
 * Manages dynamic pipeline registration, discovery, and plugin loading
 */

import { validatePipelineConfig } from './pipeline.js';

// Plugin loader for dynamic imports
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
    return loadedPlugins.get(pluginPath);
  };
  
  return {
    loadPlugin,
    unloadPlugin,
    getLoadedPlugins,
    getPluginInfo
  };
};

// Main pipeline registry
export const createPipelineRegistry = () => {
  const state = {
    pipelines: new Map(),
    pipelineFactories: new Map(),
    categories: new Map()
  };
  
  const pluginLoader = createPluginLoader();
  // const operations = createRegistryOperations(state); // Missing function
  // const queries = createRegistryQueries(state); // Missing function
  
  // Direct pipeline registration
  const register = (name, pipelineOrFactory, metadata = {}) => {
    try {
      // Validate if it's a pipeline config
      if (typeof pipelineOrFactory === 'object' && pipelineOrFactory.process) {
        validatePipelineConfig(pipelineOrFactory);
      }
      
      const entry = {
        name,
        factory: typeof pipelineOrFactory === 'function' ? pipelineOrFactory : () => pipelineOrFactory,
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
        }
      };
      
      pipelineFactories.set(name, entry);
      
      // Add to category index
      const {category} = entry.metadata;
      if (!categories.has(category)) {
        categories.set(category, new Set());
      }
      categories.get(category).add(name);
      
      return true;
      
    } catch (error) {
      throw new Error(`Pipeline registration failed for '${name}': ${error.message}`);
    }
  };
  
  // Pipeline creation
  const create = async (name, config = {}) => {
    const entry = pipelineFactories.get(name);
    if (!entry) {
      throw new Error(`Pipeline '${name}' not found in registry`);
    }
    
    try {
      const pipeline = await entry.factory(config);
      
      // Store active instance
      pipelines.set(`${name}:${Date.now()}`, {
        instance: pipeline,
        name,
        config,
        createdAt: Date.now()
      });
      
      return pipeline;
      
    } catch (error) {
      throw new Error(`Failed to create pipeline '${name}': ${error.message}`);
    }
  };
  
  // Plugin-based registration
  const registerPlugin = async (pluginPath, pluginConfig = {}) => {
    try {
      const result = await pluginLoader.loadPlugin(pluginPath, pluginConfig);
      
      // Plugin should return pipeline registrations
      if (result && Array.isArray(result.pipelines)) {
        result.pipelines.forEach(pipelineInfo => {
          register(pipelineInfo.name, pipelineInfo.factory, {
            ...pipelineInfo.metadata,
            plugin: pluginPath
          });
        });
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Plugin registration failed: ${error.message}`);
    }
  };
  
  // Bulk registration from directory
  const registerFromDirectory = async (directoryPath) => {
    try {
      // This would use fs.readdir in a real implementation
      // For now, we'll provide the interface
      const registeredPlugins = [];
      
      // Placeholder for directory scanning
      console.log(`Would scan directory: ${directoryPath}`);
      
      return registeredPlugins;
      
    } catch (error) {
      throw new Error(`Directory registration failed: ${error.message}`);
    }
  };
  
  // Pipeline discovery and querying
  const list = () => {
    return Array.from(pipelineFactories.keys());
  };
  
  const getInfo = (name) => {
    const entry = pipelineFactories.get(name);
    return entry ? { ...entry.metadata, name } : null;
  };
  
  const findByCapability = (capability) => {
    const results = [];
    for (const [name, entry] of pipelineFactories) {
      if (entry.metadata.capabilities.includes(capability)) {
        results.push(name);
      }
    }
    return results;
  };
  
  const findByCategory = (category) => {
    return Array.from(categories.get(category) || []);
  };
  
  const findByTags = (tags) => {
    const targetTags = Array.isArray(tags) ? tags : [tags];
    const results = [];
    
    for (const [name, entry] of pipelineFactories) {
      const hasAnyTag = targetTags.some(tag => entry.metadata.tags.includes(tag));
      if (hasAnyTag) {
        results.push(name);
      }
    }
    
    return results;
  };
  
  const search = (query) => {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (const [name, entry] of pipelineFactories) {
      const searchable = [
        name,
        entry.metadata.description,
        entry.metadata.category,
        ...entry.metadata.tags,
        ...entry.metadata.capabilities
      ].join(' ').toLowerCase();
      
      if (searchable.includes(searchTerm)) {
        results.push({
          name,
          relevance: searchable.split(searchTerm).length - 1, // Simple relevance scoring
          metadata: entry.metadata
        });
      }
    }
    
    return results.sort((a, b) => b.relevance - a.relevance);
  };
  
  // Registry management
  const unregister = (name) => {
    const entry = pipelineFactories.get(name);
    if (!entry) return false;
    
    // Remove from category index
    const {category} = entry.metadata;
    if (categories.has(category)) {
      categories.get(category).delete(name);
      if (categories.get(category).size === 0) {
        categories.delete(category);
      }
    }
    
    // Remove from main registry
    pipelineFactories.delete(name);
    
    // Clean up any active instances
    for (const [instanceId, instance] of pipelines) {
      if (instance.name === name) {
        if (instance.instance.cleanup) {
          instance.instance.cleanup().catch(console.warn);
        }
        pipelines.delete(instanceId);
      }
    }
    
    return true;
  };
  
  const clear = async () => {
    // Cleanup all active instances
    const cleanupPromises = [];
    for (const [, instance] of pipelines) {
      if (instance.instance.cleanup) {
        cleanupPromises.push(instance.instance.cleanup());
      }
    }
    
    await Promise.allSettled(cleanupPromises);
    
    // Clear registries
    pipelines.clear();
    pipelineFactories.clear();
    categories.clear();
    
    // Unload all plugins
    const loadedPlugins = pluginLoader.getLoadedPlugins();
    for (const pluginPath of loadedPlugins) {
      await pluginLoader.unloadPlugin(pluginPath);
    }
    
    return true;
  };
  
  // Statistics and health
  const getStats = () => {
    const stats = {
      totalPipelines: pipelineFactories.size,
      activePipelines: pipelines.size,
      categories: categories.size,
      loadedPlugins: pluginLoader.getLoadedPlugins().length,
      byCategory: {},
      byCapability: {}
    };
    
    // Category breakdown
    for (const [category, pipelineSet] of categories) {
      stats.byCategory[category] = pipelineSet.size;
    }
    
    // Capability breakdown
    const capabilityCount = new Map();
    for (const [, entry] of pipelineFactories) {
      entry.metadata.capabilities.forEach(cap => {
        capabilityCount.set(cap, (capabilityCount.get(cap) || 0) + 1);
      });
    }
    stats.byCapability = Object.fromEntries(capabilityCount);
    
    return stats;
  };
  
  const getHealth = () => {
    const health = {
      status: 'healthy',
      registrySize: pipelineFactories.size,
      activeInstances: pipelines.size,
      pluginStatus: 'ok',
      lastCheck: Date.now(),
      issues: []
    };
    
    // Check for common issues
    if (pipelineFactories.size === 0) {
      health.issues.push('No pipelines registered');
      health.status = 'degraded';
    }
    
    // Check active instances for memory leaks
    const oldInstances = Array.from(pipelines.values())
      .filter(instance => Date.now() - instance.createdAt > 300000); // 5 minutes
    
    if (oldInstances.length > 10) {
      health.issues.push(`${oldInstances.length} old pipeline instances detected`);
      health.status = 'warning';
    }
    
    return health;
  };
  
  return {
    // Registration
    register,
    registerPlugin,
    registerFromDirectory,
    unregister,
    clear,
    
    // Creation
    create,
    
    // Discovery
    list,
    getInfo,
    findByCapability,
    findByCategory,
    findByTags,
    search,
    
    // Management
    getStats,
    getHealth,
    
    // Plugin access
    pluginLoader
  };
};

// Lazy pipeline loaders - High performance ML modules
export const createLazyPipelineLoaders = () => {
  const loaders = {
    // MediaPipe pipelines - Heavy ML dependencies
    'mediapipe-face': null,
    'mediapipe-mesh': null,
    'emotion-analysis': null,
    'eye-tracking': null
  };

  const getMediaPipeFacePipeline = async () => {
    if (!loaders['mediapipe-face']) {
      console.log('🔄 Lazy loading MediaPipe face detection pipeline...');
      const module = await import('../../features/face-detection/mediapipe-face-pipeline.js');
      loaders['mediapipe-face'] = module.createMediaPipeFacePipeline;
      console.log('✅ MediaPipe face detection pipeline loaded');
    }
    return loaders['mediapipe-face'];
  };

  const getMediaPipeMeshPipeline = async () => {
    if (!loaders['mediapipe-mesh']) {
      console.log('🔄 Lazy loading MediaPipe mesh pipeline...');
      const module = await import('../../features/face-detection/mediapipe-pipeline.js');
      loaders['mediapipe-mesh'] = module.createMediaPipeMeshPipeline;
      console.log('✅ MediaPipe mesh pipeline loaded');
    }
    return loaders['mediapipe-mesh'];
  };

  const getEmotionAnalysisPipeline = async () => {
    if (!loaders['emotion-analysis']) {
      console.log('🔄 Lazy loading emotion analysis pipeline...');
      const module = await import('../../features/emotion-analysis/emotion-analysis-pipeline.js');
      loaders['emotion-analysis'] = module.createEmotionAnalysisPipeline;
      console.log('✅ Emotion analysis pipeline loaded');
    }
    return loaders['emotion-analysis'];
  };

  const getEyeTrackingPipeline = async () => {
    if (!loaders['eye-tracking']) {
      console.log('🔄 Lazy loading eye tracking pipeline...');
      const module = await import('../../features/eye-tracking/devices/webcam/pipeline.js');
      loaders['eye-tracking'] = module.createEyeTrackingPipeline;
      console.log('✅ Eye tracking pipeline loaded');
    }
    return loaders['eye-tracking'];
  };

  return {
    getMediaPipeFacePipeline,
    getMediaPipeMeshPipeline,
    getEmotionAnalysisPipeline,
    getEyeTrackingPipeline
  };
};

// Enhanced auto-registration with lazy loading
export const autoRegisterBuiltins = async (registry) => {
  const lazyLoaders = createLazyPipelineLoaders();
  
  try {
    // Register lazy-loaded MediaPipe Face pipeline
    registry.register('mediapipe-face', async (config) => {
      const createPipeline = await lazyLoaders.getMediaPipeFacePipeline();
      return createPipeline(config);
    }, {
      category: 'detection',
      description: 'Fast face detection with MediaPipe (lazy loaded)',
      version: '2.0.0',
      capabilities: ['face_detection', 'pose_estimation_3dof', 'landmark_detection'],
      tags: ['fast', 'mobile', 'real-time', 'efficient', 'lazy'],
      author: 'Google/MediaPipe',
      dependencies: ['@mediapipe/face_detection'],
      lazy: true
    });

    // Register lazy-loaded MediaPipe Mesh pipeline
    registry.register('mediapipe-mesh', async (config) => {
      const createPipeline = await lazyLoaders.getMediaPipeMeshPipeline();
      return createPipeline(config);
    }, {
      category: 'detection',
      description: 'High-precision face mesh with 468 landmarks (lazy loaded)',
      version: '2.0.0',
      capabilities: ['face_mesh', 'pose_estimation_6dof', 'iris_tracking'],
      tags: ['high-precision', 'mesh', 'landmarks', 'lazy'],
      author: 'Google/MediaPipe',
      dependencies: ['@mediapipe/face_mesh'],
      lazy: true
    });

    // Register lazy-loaded Emotion Analysis pipeline
    registry.register('emotion-analysis', async (config) => {
      const createPipeline = await lazyLoaders.getEmotionAnalysisPipeline();
      return createPipeline(config);
    }, {
      category: 'analysis',
      description: 'CNN-based emotion recognition (lazy loaded)',
      version: '2.0.0',
      capabilities: ['emotion_detection', 'expression_analysis'],
      tags: ['cnn', 'emotion', 'analysis', 'lazy'],
      author: 'Synopticon',
      dependencies: ['tensorflow', 'onnx'],
      lazy: true
    });

    // Register lazy-loaded Eye Tracking pipeline
    registry.register('eye-tracking', async (config) => {
      const createPipeline = await lazyLoaders.getEyeTrackingPipeline();
      return createPipeline(config);
    }, {
      category: 'tracking',
      description: 'Real-time eye tracking and gaze estimation (lazy loaded)',
      version: '2.0.0',
      capabilities: ['eye_tracking', 'gaze_estimation', 'pupil_detection'],
      tags: ['eye', 'gaze', 'tracking', 'lazy'],
      author: 'Synopticon',
      dependencies: ['mediapipe', 'opencv'],
      lazy: true
    });
    
    console.log('✅ Built-in pipelines registered with lazy loading');
    
  } catch (error) {
    console.warn('⚠️ Some built-in pipelines failed to register:', error.message);
  }
};