# ADR 006: Universal Distributor Consolidation

## Status
Accepted

## Context
Phase 1 architectural simplification successfully reduced pipeline and orchestration complexity. Phase 2 analysis reveals the distribution system contains significant duplication and complexity:

- **8 separate distributors** with overlapping functionality
- **3,787 total lines** with ~60% duplication between runtime implementations
- **Protocol-specific implementations** lacking shared abstractions
- **Multiple configuration schemas** (15+ distribution configs)
- **Duplicate error handling and retry logic** across distributors

**Current Distributors:**
- `http-distributor.ts` (391 LOC) + `http-distributor-bun.ts` (345 LOC) = 736 LOC
- `websocket-distributor.ts` (592 LOC) + `websocket-distributor-bun.ts` (265 LOC) = 857 LOC
- `mqtt-distributor-builtin.ts` (463 LOC)
- `sse-distributor.ts` (605 LOC)
- `udp-distributor.ts` (494 LOC)
- `media-websocket-distributor.ts` (632 LOC)

This violates ADR 005 requirements for clean, non-duplicated code patterns.

## Decision
Consolidate all distributors into a single **Universal Distributor** with protocol-specific adapters, following functional programming patterns established in Phase 1.

## Architecture Design

### Universal Distributor Core
```typescript
export const createUniversalDistributor = (config: UniversalDistributorConfig = {}) => ({
  // Core distribution function
  distribute: async (data: any, targets: DistributionTarget[], options: DistributeOptions = {}) => {
    const results = await Promise.allSettled(
      targets.map(target => distributeToTarget(data, target, options))
    );
    
    return {
      success: results.every(r => r.status === 'fulfilled'),
      results: results.map(formatResult),
      metrics: calculateMetrics(results)
    };
  },

  // Protocol registration
  registerProtocol: (protocol: string, adapter: ProtocolAdapter) => { },
  
  // Lifecycle management  
  start: async () => { },
  stop: async () => { },
  getStatus: () => ({ })
});
```

### Protocol Adapter Interface
```typescript
export interface ProtocolAdapter {
  // Required adapter methods
  send: (data: any, config: any) => Promise<AdapterResult>;
  healthCheck?: () => Promise<boolean>;
  configure?: (config: any) => void;
  
  // Adapter metadata
  protocol: string;
  capabilities: string[];
}

// Standard adapters (functional factories)
export const createHttpAdapter = (config: HttpConfig) => ({ ... });
export const createWebSocketAdapter = (config: WSConfig) => ({ ... });
export const createMqttAdapter = (config: MqttConfig) => ({ ... });
export const createSSEAdapter = (config: SSEConfig) => ({ ... });
export const createUdpAdapter = (config: UdpConfig) => ({ ... });
```

### Single Configuration Schema
```typescript
export interface UniversalDistributorConfig {
  // Global settings
  maxConcurrency?: number;
  defaultTimeout?: number;
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    backoffMultiplier: number;
  };
  
  // Protocol configurations
  protocols: {
    http?: HttpConfig;
    websocket?: WebSocketConfig;
    mqtt?: MqttConfig;
    sse?: SSEConfig;
    udp?: UdpConfig;
  };
}
```

## Implementation Strategy

### Phase 1: Core Universal Distributor (Week 1-2)
1. Create universal distributor factory function
2. Implement protocol adapter interface  
3. Design unified configuration schema
4. Add comprehensive error handling with Result pattern

### Phase 2: Protocol Adapters (Week 3-4)
1. Convert existing distributors to adapters
2. Eliminate runtime-specific duplications
3. Implement standardized retry logic
4. Add unified health checking

### Phase 3: Integration & Migration (Week 5-6)  
1. Update API routes to use universal distributor
2. Migrate existing configurations
3. Remove legacy distributor files
4. Update documentation and examples

## Benefits

### Immediate
- **60% LOC Reduction**: ~2,200 lines eliminated through deduplication
- **Single Configuration**: One unified config schema
- **Consistent Patterns**: Standardized error handling and retry logic
- **Protocol Agnostic**: Add new protocols without code duplication

### Long-term
- **Maintainability**: Single codebase for all distribution logic
- **Extensibility**: Easy to add new protocols via adapters
- **Testing**: Unified test suite for all distribution functionality
- **Performance**: Optimized connection pooling and resource management

## Breaking Changes
- **Configuration**: Existing distribution configs need migration
- **API**: Distribution service interface changes
- **Imports**: Update imports from specific distributors to universal distributor

**Mitigation**: Create migration utility and provide comprehensive examples.

## Success Metrics
- **Lines of Code**: Reduce from 3,787 to ~1,500 lines (60% reduction)
- **File Count**: Reduce from 8 distributors to 1 core + 5 adapters
- **Configuration Schemas**: Reduce from 15+ to 1 unified schema
- **Test Coverage**: Maintain >95% coverage throughout migration
- **Performance**: No regression in distribution throughput

## Compliance with Phase 1 ADRs
- **ADR 001**: Uses composition pattern (adapters compose into distributor)
- **ADR 002**: Implements Result<T, E> error handling throughout  
- **ADR 004**: Pure functional programming (factory functions, immutable config)
- **ADR 005**: Follows all pattern enforcement guidelines

## Risk Assessment
- **Medium Risk**: Large refactoring but well-contained system
- **Mitigation**: Feature flags, adapter-by-adapter rollout
- **Testing**: Comprehensive integration tests for all protocols

## Related Files
- **Implementation**: `src/core/distribution/universal-distributor.ts`
- **Adapters**: `src/core/distribution/adapters/`
- **Configuration**: `src/core/distribution/config/universal-config.ts`
- **Migration**: Remove all files in `distributors/` directory

This ADR ensures Phase 2 continues the architectural simplification established in Phase 1, eliminating the final major source of complexity in the codebase.