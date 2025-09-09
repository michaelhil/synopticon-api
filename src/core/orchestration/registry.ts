/**
 * Pipeline Registry and Plugin System
 * Manages dynamic pipeline registration, discovery, and plugin loading
 */

import { validatePipelineConfig } from './pipeline.js';
import type { Pipeline, PipelineConfig } from '../pipeline/pipeline.js';

export interface PluginConfig {
  [key: string]: unknown;
}

export interface PluginModule {
  register: (config: PluginConfig) => Promise<PluginRegistrationResult>;
  cleanup?: () => Promise<void>;
}

export interface PluginRegistrationResult {
  pipelines?: PipelineInfo[];
  [key: string]: unknown;
}

export interface PipelineInfo {
  name: string;
  factory: PipelineFactory;
  metadata?: PipelineMetadata;
}

export interface LoadedPlugin {
  plugin: PluginModule;
  config: PluginConfig;
  result: PluginRegistrationResult;
}

export interface PipelineMetadata {
  category?: string;
  version?: string;
  description?: string;
  author?: string;
  capabilities?: string[];
  dependencies?: string[];
  tags?: string[];
  registeredAt?: number;
  plugin?: string;
  lazy?: boolean;
  [key: string]: unknown;
}

export interface PipelineRegistryEntry {
  name: string;
  factory: PipelineFactory;
  metadata: Required<PipelineMetadata>;
}

export interface PipelineInstance {
  instance: Pipeline;
  name: string;
  config: PipelineConfig;
  createdAt: number;
}

export interface SearchResult {
  name: string;
  relevance: number;
  metadata: Required<PipelineMetadata>;
}

export interface RegistryStats {
  totalPipelines: number;
  activePipelines: number;
  categories: number;
  loadedPlugins: number;
  byCategory: Record<string, number>;
  byCapability: Record<string, number>;
}

export interface RegistryHealth {
  status: 'healthy' | 'degraded' | 'warning';
  registrySize: number;
  activeInstances: number;
  pluginStatus: string;
  lastCheck: number;
  issues: string[];
}

export type PipelineFactory = (config?: PipelineConfig) => Pipeline | Promise<Pipeline>;

export interface PluginLoader {
  loadPlugin: (pluginPath: string, config?: PluginConfig) => Promise<PluginRegistrationResult>;
  unloadPlugin: (pluginPath: string) => Promise<boolean>;
  getLoadedPlugins: () => string[];
  getPluginInfo: (pluginPath: string) => LoadedPlugin | undefined;
}

export interface PipelineRegistry {
  // Registration
  register: (name: string, pipelineOrFactory: Pipeline | PipelineFactory, metadata?: PipelineMetadata) => boolean;
  registerPlugin: (pluginPath: string, pluginConfig?: PluginConfig) => Promise<PluginRegistrationResult>;
  registerFromDirectory: (directoryPath: string) => Promise<string[]>;
  unregister: (name: string) => boolean;
  clear: () => Promise<boolean>;
  
  // Creation
  create: (name: string, config?: PipelineConfig) => Promise<Pipeline>;
  
  // Discovery
  list: () => string[];
  getInfo: (name: string) => (PipelineMetadata & { name: string }) | null;
  findByCapability: (capability: string) => string[];
  findByCategory: (category: string) => string[];
  findByTags: (tags: string | string[]) => string[];
  search: (query: string) => SearchResult[];
  
  // Management
  getStats: () => RegistryStats;
  getHealth: () => RegistryHealth;
  
  // Plugin access
  pluginLoader: PluginLoader;
}

interface RegistryState {
  pipelines: Map<string, PipelineInstance>;
  pipelineFactories: Map<string, PipelineRegistryEntry>;
  categories: Map<string, Set<string>>;
}

// Plugin loader for dynamic imports
export const createPluginLoader = (): PluginLoader => {
  const loadedPlugins = new Map<string, LoadedPlugin>();
  
  const loadPlugin = async (pluginPath: string, config: PluginConfig = {}): Promise<PluginRegistrationResult> => {
    try {
      // Dynamic import for ES modules
      const plugin = await import(pluginPath) as PluginModule;
      
      if (typeof plugin.register !== 'function') {
        throw new Error(`Plugin ${pluginPath} must export a 'register' function`);
      }
      
      const registrationResult = await plugin.register(config);
      loadedPlugins.set(pluginPath, { plugin, config, result: registrationResult });
      
      return registrationResult;
      
    } catch (error) {
      throw new Error(`Failed to load plugin ${pluginPath}: ${(error as Error).message}`);
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
  
  const getPluginInfo = (pluginPath: string): LoadedPlugin | undefined => {
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
export const createPipelineRegistry = (): PipelineRegistry => {
  const state: RegistryState = {
    pipelines: new Map(),
    pipelineFactories: new Map(),
    categories: new Map()
  };
  
  const pluginLoader = createPluginLoader();
  
  // Direct pipeline registration
  const register = (
    name: string, 
    pipelineOrFactory: Pipeline | PipelineFactory, 
    metadata: PipelineMetadata = {}
  ): boolean => {
    try {
      // Validate if it's a pipeline config
      if (typeof pipelineOrFactory === 'object' && 'process' in pipelineOrFactory) {
        validatePipelineConfig(pipelineOrFactory as PipelineConfig);
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
      
      return true;
      
    } catch (error) {
      throw new Error(`Pipeline registration failed for '${name}': ${(error as Error).message}`);
    }
  };
  
  // Pipeline creation
  const create = async (name: string, config: PipelineConfig = {}): Promise<Pipeline> => {
    const entry = state.pipelineFactories.get(name);
    if (!entry) {
      throw new Error(`Pipeline '${name}' not found in registry`);
    }
    
    try {
      const pipeline = await entry.factory(config);
      
      // Store active instance
      state.pipelines.set(`${name}:${Date.now()}`, {
        instance: pipeline,
        name,
        config,
        createdAt: Date.now()
      });
      
      return pipeline;
      
    } catch (error) {
      throw new Error(`Failed to create pipeline '${name}': ${(error as Error).message}`);
    }
  };
  
  // Plugin-based registration
  const registerPlugin = async (
    pluginPath: string, 
    pluginConfig: PluginConfig = {}
  ): Promise<PluginRegistrationResult> => {
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
      throw new Error(`Plugin registration failed: ${(error as Error).message}`);
    }
  };
  
  // Bulk registration from directory
  const registerFromDirectory = async (directoryPath: string): Promise<string[]> => {
    try {
      // This would use fs.readdir in a real implementation
      // For now, we'll provide the interface
      const registeredPlugins: string[] = [];
      
      // Placeholder for directory scanning
      console.log(`Would scan directory: ${directoryPath}`);
      
      return registeredPlugins;
      
    } catch (error) {
      throw new Error(`Directory registration failed: ${(error as Error).message}`);
    }
  };
  
  // Pipeline discovery and querying
  const list = (): string[] => {
    return Array.from(state.pipelineFactories.keys());
  };
  
  const getInfo = (name: string): (PipelineMetadata & { name: string }) | null => {
    const entry = state.pipelineFactories.get(name);
    return entry ? { ...entry.metadata, name } : null;
  };
  
  const findByCapability = (capability: string): string[] => {
    const results: string[] = [];
    for (const [name, entry] of state.pipelineFactories) {
      if (entry.metadata.capabilities.includes(capability)) {
        results.push(name);
      }
    }
    return results;
  };
  
  const findByCategory = (category: string): string[] => {
    return Array.from(state.categories.get(category) || []);
  };
  
  const findByTags = (tags: string | string[]): string[] => {
    const targetTags = Array.isArray(tags) ? tags : [tags];
    const results: string[] = [];
    
    for (const [name, entry] of state.pipelineFactories) {
      const hasAnyTag = targetTags.some(tag => entry.metadata.tags.includes(tag));
      if (hasAnyTag) {
        results.push(name);
      }
    }
    
    return results;
  };
  
  const search = (query: string): SearchResult[] => {
    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase();
    
    for (const [name, entry] of state.pipelineFactories) {
      const searchable = [
        name,
        entry.metadata.description,
        entry.metadata.category,
        ...entry.metadata.tags,
        ...entry.metadata.capabilities
      ].join('\n') ').toLowerCase();
      
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
  const unregister = (name: string): boolean => {
    const entry = state.pipelineFactories.get(name);
    if (!entry) return false;
    
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
    for (const [instanceId, instance] of state.pipelines) {
      if (instance.name === name) {
        if ('cleanup' in instance.instance && typeof instance.instance.cleanup === 'function') {
          (instance.instance.cleanup as () => Promise<void>)().catch(console.warn);
        }
        state.pipelines.delete(instanceId);
      }
    }
    
    return true;
  };
  
  const clear = async (): Promise<boolean> => {
    // Cleanup all active instances
    const cleanupPromises: Promise<void>[] = [];
    for (const [, instance] of state.pipelines) {
      if ('cleanup' in instance.instance && typeof instance.instance.cleanup === 'function') {
        cleanupPromises.push((instance.instance.cleanup as () => Promise<void>)());
      }
    }
    
    await Promise.allSettled(cleanupPromises);
    
    // Clear registries
    state.pipelines.clear();
    state.pipelineFactories.clear();
    state.categories.clear();
    
    // Unload all plugins
    const loadedPlugins = pluginLoader.getLoadedPlugins();
    for (const pluginPath of loadedPlugins) {
      await pluginLoader.unloadPlugin(pluginPath);
    }
    
    return true;
  };
  
  // Statistics and health
  const getStats = (): RegistryStats => {
    const stats: RegistryStats = {
      totalPipelines: state.pipelineFactories.size,
      activePipelines: state.pipelines.size,
      categories: state.categories.size,
      loadedPlugins: pluginLoader.getLoadedPlugins().length,
      byCategory: {},
      byCapability: {}
    };
    
    // Category breakdown
    for (const [category, pipelineSet] of state.categories) {
      stats.byCategory[category] = pipelineSet.size;
    }
    
    // Capability breakdown
    const capabilityCount = new Map<string, number>();
    for (const [, entry] of state.pipelineFactories) {
      entry.metadata.capabilities.forEach(cap => {
        capabilityCount.set(cap, (capabilityCount.get(cap) || 0) + 1);
      });
    }
    stats.byCapability = Object.fromEntries(capabilityCount);
    
    return stats;
  };
  
  const getHealth = (): RegistryHealth => {
    const health: RegistryHealth = {
      status: 'healthy',
      registrySize: state.pipelineFactories.size,
      activeInstances: state.pipelines.size,
      pluginStatus: 'ok',
      lastCheck: Date.now(),
      issues: []
    };
    
    // Check for common issues
    if (state.pipelineFactories.size === 0) {
      health.issues.push('No pipelines registered');
      health.status = 'degraded';
    }
    
    // Check active instances for memory leaks
    const oldInstances = Array.from(state.pipelines.values())
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
export interface LazyPipelineLoaders {
  getMediaPipeFacePipeline: () => Promise<PipelineFactory>;
  getMediaPipeMeshPipeline: () => Promise<PipelineFactory>;
  getEmotionAnalysisPipeline: () => Promise<PipelineFactory>;
  getEyeTrackingPipeline: () => Promise<PipelineFactory>;
}

export const createLazyPipelineLoaders = (): LazyPipelineLoaders => {
  const loaders: Record<string, PipelineFactory | null> = {
    'mediapipe-face': null,
    'mediapipe-mesh': null,
    'emotion-analysis': null,
    'eye-tracking': null
  };

  const getMediaPipeFacePipeline = async (): Promise<PipelineFactory> => {
    if (!loaders['mediapipe-face']) {
      console.log('🔄 Lazy loading MediaPipe face detection pipeline...');
      const module = await import('../../features/face-detection/mediapipe-face-pipeline.js');
      loaders['mediapipe-face'] = module.createMediaPipeFacePipeline;
      console.log('✅ MediaPipe face detection pipeline loaded');
    }
    return loaders['mediapipe-face']!;
  };

  const getMediaPipeMeshPipeline = async (): Promise<PipelineFactory> => {
    if (!loaders['mediapipe-mesh']) {
      console.log('🔄 Lazy loading MediaPipe mesh pipeline...');
      const module = await import('../../features/face-detection/mediapipe-pipeline.js');
      loaders['mediapipe-mesh'] = module.createMediaPipeMeshPipeline;
      console.log('✅ MediaPipe mesh pipeline loaded');
    }
    return loaders['mediapipe-mesh']!;
  };

  const getEmotionAnalysisPipeline = async (): Promise<PipelineFactory> => {
    if (!loaders['emotion-analysis']) {
      console.log('🔄 Lazy loading emotion analysis pipeline...');
      const module = await import('../../features/emotion-analysis/emotion-analysis-pipeline.js');
      loaders['emotion-analysis'] = module.createEmotionAnalysisPipeline;
      console.log('✅ Emotion analysis pipeline loaded');
    }
    return loaders['emotion-analysis']!;
  };

  const getEyeTrackingPipeline = async (): Promise<PipelineFactory> => {
    if (!loaders['eye-tracking']) {
      console.log('🔄 Lazy loading eye tracking pipeline...');
      const module = await import('../../features/eye-tracking/devices/webcam/pipeline.js');
      loaders['eye-tracking'] = module.createEyeTrackingPipeline;
      console.log('✅ Eye tracking pipeline loaded');
    }
    return loaders['eye-tracking']!;
  };

  return {
    getMediaPipeFacePipeline,
    getMediaPipeMeshPipeline,
    getEmotionAnalysisPipeline,
    getEyeTrackingPipeline
  };
};

// Enhanced auto-registration with lazy loading
export const autoRegisterBuiltins = async (registry: PipelineRegistry): Promise<void> => {
  const lazyLoaders = createLazyPipelineLoaders();
  
  try {
    // Register lazy-loaded MediaPipe Face pipeline
    registry.register('mediapipe-face', async (config?: PipelineConfig) => {
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
    registry.register('mediapipe-mesh', async (config?: PipelineConfig) => {
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
    registry.register('emotion-analysis', async (config?: PipelineConfig) => {
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
    registry.register('eye-tracking', async (config?: PipelineConfig) => {
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
    console.warn('⚠️ Some built-in pipelines failed to register:', (error as Error).message);
  }
};