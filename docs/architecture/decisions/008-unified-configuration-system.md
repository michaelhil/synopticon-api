# ADR 008: Unified Configuration System

## Status
Accepted

## Context

**Phase 3 Configuration System Analysis:**

**Current Complexity:**
- **3 Major Configuration Managers**: 1,351 total lines
  - `core/configuration/index.ts` (405 lines) - System-wide configuration
  - `core/distribution/config/config-manager.ts` (344 lines) - Distribution-specific config
  - `core/distribution/distribution-config-manager.ts` (602 lines) - Legacy distribution config
- **13 Configuration Files** scattered across core systems  
- **Duplicate Configuration Logic** between different subsystems
- **Multiple Validation Systems** with overlapping functionality
- **Inconsistent Configuration APIs** across different components

**Problems:**
1. **Fragmented Configuration**: Multiple config managers with overlapping responsibilities
2. **Validation Duplication**: Similar validation logic repeated across systems
3. **Schema Inconsistency**: Different configuration formats for similar concepts
4. **Developer Confusion**: Multiple APIs to learn and maintain
5. **Testing Complexity**: Need to test multiple configuration systems

## Decision

Create a **Unified Configuration System** that consolidates all configuration management into a single, coherent system following ADR 004/005 functional programming patterns.

## Unified Configuration Architecture

### **Core Unified Configuration Manager**

```typescript
/**
 * Universal Configuration Manager - Phase 3 Consolidation
 * Single source of truth for all system configuration
 */

export const createUnifiedConfigManager = (initialConfig: Partial<UnifiedConfig> = {}) => {
  const state = {
    config: { ...DEFAULT_UNIFIED_CONFIG, ...initialConfig },
    validators: new Map<string, ConfigValidator>(),
    watchers: new Map<string, ConfigWatcher[]>(),
    sources: new Map<string, ConfigSource>(),
  };

  // Core configuration functions
  const load = async (sources: ConfigSource[]): Promise<UnifiedConfig> => {
    // Unified loading from multiple sources
  };

  const validate = (config: Partial<UnifiedConfig>): ValidationResult => {
    // Single validation pipeline for all config
  };

  const get = <T>(path: string): T => {
    // Type-safe configuration access
  };

  const set = <T>(path: string, value: T): void => {
    // Immutable configuration updates
  };

  const watch = (path: string, callback: ConfigWatcher): () => void => {
    // Configuration change notifications
  };

  // Subsystem configuration accessors
  const getServerConfig = (): ServerConfig => get('server');
  const getPipelineConfig = (): PipelineConfig => get('pipeline');  
  const getDistributionConfig = (): DistributionConfig => get('distribution');
  const getOrchestrationConfig = (): OrchestrationConfig => get('orchestration');

  return {
    // Core functionality
    load,
    validate,
    get,
    set,
    watch,
    
    // Subsystem accessors
    getServerConfig,
    getPipelineConfig, 
    getDistributionConfig,
    getOrchestrationConfig,
    
    // Configuration management
    reload: () => load(Array.from(state.sources.values())),
    getStatus: () => ({ ...state, config: undefined }), // Status without exposing full config
  };
};
```

### **Unified Configuration Schema**

```typescript
export interface UnifiedConfig {
  // Server configuration
  server: {
    port: number;
    host: string;
    enableHttps: boolean;
    cors: CorsConfig;
    rateLimit: RateLimitConfig;
    compression: boolean;
    helmet: boolean;
  };
  
  // Pipeline configuration
  pipeline: {
    maxConcurrentPipelines: number;
    enableMetrics: boolean;
    retryConfig: RetryConfig;
    compositions: CompositionConfig[];
  };
  
  // Distribution configuration (unified from multiple sources)
  distribution: {
    maxConcurrency: number;
    defaultTimeout: number;
    retryConfig: RetryConfig;
    adapters: {
      http?: HttpAdapterConfig;
      websocket?: WebSocketAdapterConfig;
      mqtt?: MqttAdapterConfig;
      sse?: SSEAdapterConfig;
      udp?: UdpAdapterConfig;
    };
  };
  
  // Orchestration configuration
  orchestration: {
    maxConcurrentPipelines: number;
    enableMetrics: boolean;
    defaultRetryConfig: RetryConfig;
  };
  
  // Feature configuration
  features: {
    faceAnalysis: FaceAnalysisConfig;
    eyeTracking: EyeTrackingConfig;
    speechAnalysis: SpeechAnalysisConfig;
  };
  
  // Environment configuration
  environment: {
    type: 'development' | 'testing' | 'production';
    debug: boolean;
    telemetryEnabled: boolean;
    metricsEnabled: boolean;
  };
  
  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    enableConsole: boolean;
    enableFile: boolean;
    maxFileSize: string;
    maxFiles: number;
  };
}
```

### **Unified Validation System**

```typescript
export const createUnifiedValidator = (): ConfigValidator => {
  // Single validation pipeline for all configuration
  const validateConfig = (config: Partial<UnifiedConfig>): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Server validation
    if (config.server) {
      errors.push(...validateServerConfig(config.server));
    }
    
    // Distribution validation  
    if (config.distribution) {
      errors.push(...validateDistributionConfig(config.distribution));
    }
    
    // Pipeline validation
    if (config.pipeline) {
      errors.push(...validatePipelineConfig(config.pipeline));
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  };
  
  return { validateConfig };
};
```

## Implementation Plan

### **Week 1: Core Unified System**
1. Create unified configuration manager factory function
2. Design unified configuration schema
3. Implement core configuration functions (get, set, watch)
4. Create unified validation pipeline

### **Week 2: Migration & Integration**  
1. Migrate existing configurations to unified schema
2. Update all subsystems to use unified config manager
3. Replace individual config managers with unified system
4. Remove duplicate configuration code

### **Week 3: Testing & Polish**
1. Comprehensive testing of unified system
2. Performance optimization
3. Documentation and examples
4. Remove obsolete configuration files

## Breaking Changes

### **Configuration API Changes**
- **Old**: Multiple config managers with different APIs
- **New**: Single unified configuration manager

### **Configuration Schema Changes**
- **Old**: Separate schemas for each subsystem
- **New**: Single unified schema with subsystem sections

### **Import Changes**
```typescript
// Before (multiple imports)
import { createDistributionConfig } from '../distribution/config-manager.js';
import { createServerConfig } from '../configuration/index.js';

// After (single import)
import { createUnifiedConfigManager } from '../configuration/unified-config-manager.js';
```

## Benefits

### **Immediate Benefits**
- **50% Code Reduction**: From 1,351 to ~675 lines
- **Single API**: One configuration interface to learn and maintain
- **Consistent Validation**: Unified validation across all configuration
- **Type Safety**: Complete TypeScript coverage for all configuration

### **Long-term Benefits**
- **Maintainability**: Single system to maintain and debug
- **Testing**: Simplified testing with unified configuration
- **Developer Experience**: Clear, consistent configuration API
- **Extensibility**: Easy to add new configuration sections

## Implementation Compliance

### **ADR 004/005 Compliance**
- **Factory Functions**: All configuration managers use factory pattern
- **Immutable Operations**: Configuration updates use immutable patterns
- **Pure Functions**: Configuration functions are side-effect free
- **Functional Composition**: Configuration building uses composition

### **No Backwards Compatibility**
- Clean removal of old configuration systems
- Breaking changes acceptable for architectural improvement
- Focus on clean, unified architecture

## Success Metrics

### **Code Quality**
- **LOC Reduction**: 50% reduction in configuration code
- **File Reduction**: From 13 to 5 configuration files
- **API Simplification**: Single configuration API
- **Type Coverage**: 100% TypeScript in configuration system

### **Developer Experience**  
- **Learning Curve**: Single configuration system to learn
- **Debugging**: Centralized configuration state
- **Testing**: Unified configuration mocking/stubbing
- **Documentation**: Single comprehensive configuration guide

### **System Performance**
- **Startup Time**: 10% improvement from unified config loading
- **Memory Usage**: Reduced overhead from single config system
- **Validation Speed**: Optimized unified validation pipeline

## Risk Mitigation

### **Migration Risk**
- **Gradual Migration**: Subsystem-by-subsystem migration
- **Feature Flags**: Toggle between old and new config systems during transition
- **Comprehensive Testing**: Full test suite for configuration functionality

### **Breaking Change Risk**
- **Clear Migration Guide**: Step-by-step migration documentation
- **Automated Migration Tools**: Scripts to convert existing configurations
- **Team Communication**: Clear communication of breaking changes

This unified configuration system represents the final consolidation of fragmented configuration management, delivering a clean, maintainable, and developer-friendly configuration architecture aligned with all established ADR principles.