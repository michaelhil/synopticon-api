# ADR 005: Pattern Enforcement Guidelines

## Status
Accepted

## Context
Following Phase 1 architectural simplification, we have successfully:
- Consolidated pipeline composition from 5 to 3 core patterns
- Unified orchestration layers
- Eliminated all legacy code and backward compatibility
- Implemented strict functional programming linting

To maintain this architectural integrity, we need comprehensive pattern enforcement guidelines that prevent regression and ensure consistent development practices.

## Decision
We establish comprehensive pattern enforcement guidelines covering all architectural decisions made during Phase 1 simplification.

## Guidelines

### 1. Functional Programming Patterns (MANDATORY)

#### ✅ Required Patterns
```javascript
// Factory functions (NOT classes)
export const createUserService = (config) => ({
  getUser: (id) => fetch(`/users/${id}`),
  updateUser: (id, data) => fetch(`/users/${id}`, { method: 'PUT', body: data })
});

// Immutable data operations
const addItem = (array, item) => [...array, item];
const removeItem = (array, index) => [...array.slice(0, index), ...array.slice(index + 1)];

// Pure functions
const calculateTotal = (items) => items.reduce((sum, item) => sum + item.price, 0);

// Composition over inheritance
const withLogging = (service) => ({
  ...service,
  log: (message) => console.log(message)
});
```

#### ❌ Prohibited Patterns
```javascript
// NO: Classes
class UserService {
  constructor(config) { this.config = config; }
  getUser(id) { return fetch(`/users/${id}`); }
}

// NO: Mutation
array.push(item);        // Use [...array, item]
array.sort();           // Use [...array].sort()
object.property = val;  // Use {...object, property: val}

// NO: this keyword
function handler() {
  this.value = 42; // Prohibited
}
```

### 2. Pipeline Composition Patterns (3 CORE PATTERNS ONLY)

#### ✅ Supported Patterns
```javascript
// 1. SEQUENTIAL - Execute pipelines in order
const sequential = createPipelineComposer().createComposition({
  id: 'data-processing',
  pattern: 'sequential',
  pipelines: [
    { id: 'validate' },
    { id: 'transform' },
    { id: 'save' }
  ]
});

// 2. PARALLEL - Execute pipelines concurrently  
const parallel = createPipelineComposer().createComposition({
  id: 'multi-analysis',
  pattern: 'parallel',
  pipelines: [
    { id: 'face-detection' },
    { id: 'emotion-analysis' },
    { id: 'age-estimation' }
  ],
  options: { maxConcurrent: 3 }
});

// 3. ADAPTIVE - Execute based on conditions
const adaptive = createPipelineComposer().createComposition({
  id: 'dynamic-processing',
  pattern: 'adaptive',
  pipelines: [
    {
      id: 'high-quality',
      condition: (input) => input.quality === 'high',
      pipelineIds: ['advanced-processing'],
      priority: 1.0
    },
    {
      id: 'standard-quality', 
      condition: (input) => input.quality !== 'high',
      pipelineIds: ['basic-processing'],
      priority: 0.8
    }
  ]
});
```

#### ❌ Removed Patterns
- **CONDITIONAL** - Merged into ADAPTIVE
- **CASCADING** - Merged into SEQUENTIAL/PARALLEL
- **Legacy pipeline composers** - Use unified composer only

### 3. Orchestration Patterns (UNIFIED ORCHESTRATOR ONLY)

#### ✅ Required Pattern
```javascript
// Single unified orchestrator
import { createUnifiedOrchestrator } from '../core/orchestration/unified-orchestrator.ts';

const orchestrator = createUnifiedOrchestrator({
  maxConcurrentPipelines: 5,
  enableMetrics: true,
  defaultRetryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    backoffMultiplier: 2
  }
});

// Register pipelines
orchestrator.register('face-detection', faceDetectionPipeline, {
  capabilities: ['face-detection'],
  priority: 1
});

// Execute with requirements
const result = await orchestrator.execute(
  { capabilities: ['face-detection'] },
  inputData,
  { strategy: 'fallback' }
);
```

#### ❌ Prohibited Patterns
- **Multiple orchestrators** - Use single unified orchestrator
- **Legacy registry classes** - Embedded in orchestrator
- **Circuit breaker complexity** - Use simplified retry logic
- **Adapter patterns** - Direct integration only

### 4. Error Handling Patterns (STANDARDIZED)

#### ✅ Required Patterns
```javascript
// Result pattern for operations
const processUser = async (id) => {
  try {
    const user = await userService.get(id);
    return { success: true, data: user };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
};

// Explicit error types
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Promise rejection with Error objects
return Promise.reject(new Error('Specific failure reason'));
```

#### ❌ Prohibited Patterns
```javascript
// NO: Throwing non-Error objects
throw 'string error';        // Use new Error()
throw { message: 'error' };  // Use new Error()

// NO: Swallowing errors silently
try { operation(); } catch {}  // Always handle errors

// NO: Generic catch-all
catch (e) { console.log('error'); }  // Be specific about error handling
```

### 5. Code Quality Enforcement

#### ✅ Function Guidelines
```javascript
// Maximum 150 lines per function
const processData = (input) => {
  // Implementation should be focused and concise
  // If larger, break into smaller composed functions
};

// Maximum 4 parameters
const createUser = (name, email, age, preferences) => {
  // If more parameters needed, use options object
};

// Better: Options object pattern
const createUser = ({ name, email, age, preferences, ...options }) => {
  // More flexible and maintainable
};

// Maximum complexity of 10
const validateInput = (input) => {
  // Avoid deeply nested conditions
  // Extract complex logic into separate functions
};
```

#### ✅ File Organization
```javascript
// Prefer editing existing files to creating new ones
// When creating new files, follow naming conventions:
// - Factory functions: create-service-name.js
// - Types: service-name-types.ts  
// - Tests: service-name.test.js
// - Utilities: utility-name.js
```

### 6. Development Workflow (ENFORCED BY TOOLING)

#### ✅ Required Commands
```bash
# Check functional programming compliance
bun run lint:functional

# Auto-fix violations where possible
bun run lint:functional:fix  

# Strict mode (zero warnings)
bun run lint:functional:strict

# Type checking
bun run typecheck

# Run tests before commits
bun test
```

#### ✅ Pre-commit Requirements
1. **Functional linting passes** - No class violations
2. **Type checking passes** - No TypeScript errors
3. **Tests pass** - All existing tests continue working
4. **No new legacy patterns** - Automated detection

## Enforcement Mechanisms

### 1. Automated Enforcement
- **ESLint Rules**: Functional programming violations blocked
- **TypeScript**: Type safety enforced
- **Package Scripts**: Easy access to validation tools
- **Git Hooks**: Pre-commit validation (recommended)

### 2. Code Review Checklist
- [ ] No classes or `this` usage
- [ ] Immutable data patterns used
- [ ] Functions under 150 lines
- [ ] Maximum 4 parameters per function
- [ ] Pure functions where possible
- [ ] Factory functions for object creation
- [ ] Proper error handling with Result pattern
- [ ] One of 3 composition patterns used (Sequential/Parallel/Adaptive)
- [ ] Single unified orchestrator used
- [ ] No legacy or adapter patterns

### 3. Documentation Requirements
- **ADRs**: All architectural decisions documented
- **Examples**: Pattern usage examples in code comments
- **Migration**: Clear guidance for updating existing code
- **Onboarding**: New team members receive pattern training

## Migration Strategy

### Existing Code
1. **Warnings First**: Existing violations show as warnings
2. **Gradual Improvement**: Address warnings during feature work  
3. **No Breaking Changes**: Maintain functionality during refactoring
4. **Team Education**: Regular sessions on functional patterns

### New Code
1. **Strict Enforcement**: All new code must pass functional linting
2. **Code Review**: Patterns verified in pull requests
3. **Examples**: Template code following all patterns
4. **Mentoring**: Senior developers guide pattern adoption

## Benefits

### Immediate
- **Consistency**: All new code follows same patterns
- **Quality**: Automated quality enforcement
- **Maintainability**: Simplified, predictable code structure

### Long-term
- **Reduced Complexity**: No architectural drift
- **Team Velocity**: Consistent patterns reduce cognitive load
- **Reliability**: Functional patterns reduce bugs
- **Onboarding**: Clear patterns speed up new team member productivity

## Violation Resolution

### Functional Programming Violations
1. **Classes → Factory Functions**: Convert class to factory function
2. **Mutations → Immutable Operations**: Use spread operators and immutable methods
3. **this → Closures**: Use closure scope instead of object context

### Architecture Violations  
1. **Multiple Orchestrators → Unified**: Consolidate to single orchestrator
2. **Legacy Patterns → Modern**: Update to supported patterns
3. **Adapters → Direct**: Remove adaptation layers

### Code Quality Violations
1. **Large Functions → Composition**: Break into smaller, composed functions
2. **Complex Logic → Extraction**: Extract complex conditions to named functions
3. **Parameter Lists → Options Objects**: Use destructured options pattern

## Compliance Monitoring

### Daily
- Development team runs `bun run lint:functional`
- CI/CD pipeline enforces functional linting

### Weekly  
- Architecture review of new patterns
- Team discussion of any guideline questions

### Monthly
- Review violation trends
- Update guidelines based on learnings
- Team training on emerging patterns

## Related ADRs
- ADR 001: Pipeline composition consolidation  
- ADR 002: Error handling standardization
- ADR 003: Orchestration consolidation
- ADR 004: Functional programming enforcement

## Conclusion
These pattern enforcement guidelines ensure the architectural simplification achieved in Phase 1 is maintained and extended. They provide clear, actionable guidance while supporting both existing code improvement and strict new code quality.