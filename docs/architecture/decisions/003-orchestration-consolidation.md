# ADR-003: Orchestration Layer Consolidation

**Status:** Proposed

**Date:** 2025-09-08

**Deciders:** Senior Architecture Team, Development Team

**Technical Story:** Phase 1 Architectural Simplification - Orchestration Layer Redundancy

## Context and Problem Statement

The current orchestration layer exhibits significant redundancy and unnecessary complexity:

- **Duplicate Responsibilities**: Registry and orchestrator have overlapping pipeline management
- **Multiple Registration Systems**: 3+ different ways to register pipelines
- **Over-engineered Circuit Breaker**: Full circuit breaker implementation for simple retry logic
- **Tight Coupling**: High interdependence between orchestrator, registry, and strategies
- **Configuration Explosion**: Too many configuration options for basic orchestration

Current structure:
- `orchestrator.ts` (516 LOC): Pipeline execution and circuit breaking
- `registry.js` (510 LOC): Pipeline registration and discovery
- `strategies.ts` (467 LOC): Execution strategies
- `synchronization/*`: Complex sync mechanisms

How do we simplify the orchestration layer while maintaining reliability and functionality?

## Decision Drivers

* **Simplicity**: Reduce cognitive load for developers
* **Single Responsibility**: Clear separation of concerns
* **Maintainability**: Easier to modify and extend
* **Performance**: Reduce overhead from redundant systems
* **Reliability**: Maintain fault tolerance without complexity
* **Backward Compatibility**: Preserve existing API contracts

## Considered Options

### Option 1: Unified Orchestrator (Registry + Orchestrator)
Merge registry functionality into orchestrator, creating a single component for pipeline management.

### Option 2: Simplified Registry with Delegated Execution
Keep registry separate but remove execution logic, make orchestrator a thin execution layer.

### Option 3: Event-Driven Decoupling
Use event bus to decouple components completely.

### Option 4: Minimal Orchestration
Remove orchestrator entirely, use direct pipeline composition.

## Decision Outcome

**Chosen option:** "Option 1 - Unified Orchestrator", because it eliminates redundancy while maintaining a clear single point of control for pipeline management.

### Implementation Plan

**Phase 1: Merge Core Functionality**
```typescript
// Unified orchestrator with embedded registry
export const createUnifiedOrchestrator = (config) => ({
  // Pipeline registration (from registry)
  register: (id, pipeline, options) => { },
  
  // Pipeline execution (from orchestrator)
  execute: async (requirements, input) => { },
  
  // Simple retry logic (simplified circuit breaker)
  executeWithRetry: async (pipeline, input, retries = 3) => { },
  
  // Pipeline discovery (merged functionality)
  findPipelines: (capabilities) => { }
});
```

**Phase 2: Simplify Circuit Breaker**
- Replace complex circuit breaker with simple exponential backoff
- Remove state tracking for individual pipelines
- Use simple failure counter with reset

**Phase 3: Consolidate Strategies**
- Merge strategy selection into orchestrator
- Remove separate strategy registry
- Inline strategy logic where needed

### Consequences

**Positive:**
* **35% LOC Reduction**: ~875 lines removed from orchestration
* **Simpler Mental Model**: One component for pipeline management
* **Reduced Coupling**: Fewer interdependencies
* **Easier Testing**: Single component to test
* **Better Performance**: Less indirection and overhead

**Negative:**
* **Larger Single File**: Orchestrator becomes larger
* **Migration Effort**: Need to update all consumers
* **Feature Loss**: Some advanced circuit breaker features removed
* **Less Flexibility**: Harder to swap implementations

**Neutral:**
* **API Changes**: Some methods will be renamed/moved
* **Documentation**: Need to update architecture docs

## Validation

**Success Metrics:**
* File count reduced from 8+ to 3-4 files
* LOC reduced by 35% in orchestration layer
* All existing tests pass with adapters
* Performance improvement of 10-15%
* Zero functional regressions

**Validation Methods:**
* Integration test coverage maintained at 100%
* Performance benchmarks before/after
* API compatibility tests
* Load testing for reliability

## Links

* [ADR-001: Pipeline Composition Consolidation](./001-pipeline-composition-consolidation.md) - Related consolidation
* [Phase 1 Assessment](../complexity-audit/phase1-assessment.md) - Detailed analysis
* [ADR-002: Error Handling Standardization](./002-error-handling-standardization.md) - Error patterns

---

## Implementation Notes

### Before Structure:
```
orchestration/
├── orchestrator.ts (516 LOC)
├── registry.js (510 LOC)
├── strategies.ts (467 LOC)
├── synchronization.js
├── plugin-loader.js
└── synchronization/
    ├── sync-engine.js
    └── aligners/
```

### After Structure:
```
orchestration/
├── unified-orchestrator.ts (~600 LOC)
├── retry-handler.ts (~100 LOC)
└── legacy-adapters.ts (temporary)
```

### Migration Strategy:

1. Create unified orchestrator with all functionality
2. Add legacy adapters for backward compatibility
3. Update consumers incrementally
4. Remove legacy files once migration complete
5. Remove adapters in next major version

### Key Simplifications:

**Circuit Breaker → Retry Handler:**
```typescript
// Before: Complex circuit breaker
circuitBreaker.executeWithBreaker(id, operation)

// After: Simple retry with backoff
retryHandler.executeWithRetry(operation, { maxRetries: 3 })
```

**Registry + Orchestrator → Unified:**
```typescript
// Before: Separate components
registry.register(pipeline);
orchestrator.execute(registry.get(id));

// After: Unified interface
orchestrator.register(id, pipeline);
orchestrator.execute(id, input);
```