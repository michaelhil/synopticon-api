/**
 * Registry Types and Interfaces
 * Shared types for the modular registry system
 */

import type { Pipeline, PipelineConfig } from '../../pipeline/pipeline.js';

// Re-export from main registry types
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
  status: 'healthy' | 'degraded' | 'warning' | 'critical';
  registrySize: number;
  activeInstances: number;
  pluginStatus: string;
  lastCheck: number;
  issues: string[];
  recommendations?: string[];
}

export type PipelineFactory = (config?: PipelineConfig) => Pipeline | Promise<Pipeline>;

export interface PluginLoader {
  loadPlugin: (pluginPath: string, config?: PluginConfig) => Promise<PluginRegistrationResult>;
  unloadPlugin: (pluginPath: string) => Promise<boolean>;
  getLoadedPlugins: () => string[];
  getPluginInfo: (pluginPath: string) => LoadedPlugin | undefined;
}

export interface RegistryState {
  pipelines: Map<string, PipelineInstance>;
  pipelineFactories: Map<string, PipelineRegistryEntry>;
  categories: Map<string, Set<string>>;
}