/**
 * Type declarations for distribution-config-manager.js
 */

export interface DistributionConfig {
  distributors: Record<string, any>;
  eventRouting: Record<string, string[]>;
  filters?: any;
}

export interface ConfigManager {
  createSessionConfig(config: any): any;
  validateConfig(config: any): boolean;
  getDefaultConfig(): DistributionConfig;
}

export function createDistributionConfigManager(config?: any): ConfigManager;
