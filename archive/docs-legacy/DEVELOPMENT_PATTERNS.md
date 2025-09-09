# Synopticon Development Patterns Guide

> **Phase 1 Architectural Simplification Complete** - This guide documents the simplified, clean patterns for all development.

## 🎯 Quick Reference

### Essential Commands
```bash
# Check code compliance
bun run lint:functional

# Fix automatically fixable issues  
bun run lint:functional:fix

# Strict mode (zero warnings)
bun run lint:functional:strict

# Type checking
bun run typecheck

# Run tests
bun test
```

### Core Principles
1. **Factory Functions** (NOT classes)
2. **Immutable Data** (NO mutations) 
3. **Pure Functions** (NO side effects where possible)
4. **3 Pipeline Patterns** (Sequential, Parallel, Adaptive)
5. **Unified Orchestration** (Single orchestrator)

---

## 🏗️ Architecture Patterns

### Pipeline Composition (3 Patterns Only)

#### 1. Sequential Pipeline
```javascript
import { createPipelineComposer } from '../core/pipeline/composers/index.js';

const composer = createPipelineComposer();

// Execute pipelines in order
const sequential = composer.createComposition({
  id: 'data-processing-flow',
  pattern: 'sequential',
  pipelines: [
    { id: 'validate-input' },
    { id: 'transform-data' }, 
    { id: 'save-results' }
  ],
  options: {
    passPreviousResults: true,
    continueOnError: false
  }
});

const result = await composer.executeComposition('data-processing-flow', inputData);
```

#### 2. Parallel Pipeline  
```javascript
// Execute pipelines concurrently
const parallel = composer.createComposition({
  id: 'multi-analysis',
  pattern: 'parallel',
  pipelines: [
    { id: 'face-detection' },
    { id: 'emotion-analysis' },
    { id: 'age-estimation' }
  ],
  options: {
    maxConcurrency: 3,
    waitForAll: true,
    failureThreshold: 0.5
  }
});
```

#### 3. Adaptive Pipeline
```javascript
// Execute based on conditions
const adaptive = composer.createComposition({
  id: 'quality-based-processing',
  pattern: 'adaptive',
  pipelines: [
    {
      id: 'high-quality-rule',
      condition: (input) => input.quality === 'high',
      pipelineIds: ['advanced-processing'],
      priority: 1.0
    },
    {
      id: 'standard-rule',
      condition: (input) => true, // fallback
      pipelineIds: ['basic-processing'],
      priority: 0.5
    }
  ]
});
```

### Unified Orchestration

```javascript
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
  capabilities: ['face-detection', 'computer-vision'],
  priority: 1
});

// Execute by capability
const result = await orchestrator.execute(
  { capabilities: ['face-detection'] },
  inputData,
  { 
    strategy: 'fallback',  // or 'first', 'parallel'
    retry: true 
  }
);
```

---

## 💻 Code Patterns

### Factory Functions (Required)

```javascript
// ✅ DO: Factory function pattern
export const createUserService = (config) => {
  const { apiUrl, timeout = 5000 } = config;
  
  return {
    async getUser(id) {
      const response = await fetch(`${apiUrl}/users/${id}`, { 
        signal: AbortSignal.timeout(timeout) 
      });
      return response.json();
    },
    
    async updateUser(id, userData) {
      const response = await fetch(`${apiUrl}/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    }
  };
};

// ❌ DON'T: Class pattern (prohibited)
class UserService {  // ESLint will error on this
  constructor(config) {
    this.config = config;
  }
  
  getUser(id) {
    return fetch(`${this.config.apiUrl}/users/${id}`);
  }
}
```

### Immutable Data Operations

```javascript
// ✅ DO: Immutable operations
const addItem = (array, item) => [...array, item];
const removeItem = (array, index) => [
  ...array.slice(0, index),
  ...array.slice(index + 1)
];
const updateItem = (array, index, newItem) => [
  ...array.slice(0, index),
  newItem,
  ...array.slice(index + 1)
];

const updateObject = (obj, updates) => ({ ...obj, ...updates });

// ❌ DON'T: Mutating operations (ESLint warnings)
array.push(item);           // Use [...array, item]
array.splice(index, 1);     // Use array.slice() combinations
array.sort();               // Use [...array].sort()
object.property = value;    // Use {...object, property: value}
```

### Pure Functions

```javascript
// ✅ DO: Pure functions (same input = same output)
const calculateTotal = (items) => 
  items.reduce((sum, item) => sum + item.price, 0);

const formatCurrency = (amount, currency = 'USD') => 
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);

const validateUser = (user) => {
  const errors = [];
  if (!user.name) errors.push('Name is required');
  if (!user.email?.includes('@')) errors.push('Valid email is required');
  return { isValid: errors.length === 0, errors };
};

// ❌ DON'T: Side effects in functions
const impureFunction = (data) => {
  console.log('Processing...'); // Side effect
  someGlobalVar = data;         // Global mutation
  return Math.random();         // Non-deterministic
};
```

### Function Composition

```javascript
// ✅ DO: Compose functions
const withLogging = (fn) => (...args) => {
  console.log(`Calling ${fn.name} with:`, args);
  const result = fn(...args);
  console.log(`Result:`, result);
  return result;
};

const withRetry = (fn, maxRetries = 3) => async (...args) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(...args);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
};

// Compose behaviors
const robustUserService = withRetry(
  withLogging(createUserService({ apiUrl: '/api' }).getUser),
  3
);
```

---

## 🛠️ Error Handling Patterns

### Result Pattern

```javascript
// ✅ DO: Result pattern for operations
const fetchUserData = async (id) => {
  try {
    const response = await fetch(`/api/users/${id}`);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        code: 'HTTP_ERROR'
      };
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code || 'FETCH_ERROR'
    };
  }
};

// Usage
const result = await fetchUserData(123);
if (result.success) {
  console.log('User:', result.data);
} else {
  console.error(`Error (${result.code}): ${result.error}`);
}
```

### Explicit Error Types

```javascript
// ✅ DO: Custom error classes
class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

class NetworkError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
    this.url = url;
  }
}

// ✅ DO: Throw proper Error objects
const validateEmail = (email) => {
  if (!email?.includes('@')) {
    throw new ValidationError('Invalid email format', 'email', email);
  }
};

// ❌ DON'T: Throw primitives (ESLint error)
throw 'Invalid email';           // Use new Error()
throw { message: 'Failed' };     // Use new Error()
throw 404;                       // Use new Error()
```

---

## 📏 Code Quality Standards

### Function Size Limits

```javascript
// ✅ DO: Keep functions focused (max 150 lines)
const processUserData = (userData) => {
  const validated = validateUserData(userData);
  const normalized = normalizeUserData(validated);
  const enriched = enrichUserData(normalized);
  return enriched;
};

// Break down complex operations
const validateUserData = (data) => {
  // Validation logic (< 150 lines)
};

const normalizeUserData = (data) => {
  // Normalization logic (< 150 lines) 
};

// ❌ DON'T: Large functions (ESLint warning at 200+ lines)
const massiveFunction = () => {
  // 400+ lines of mixed logic (hard to maintain)
};
```

### Parameter Limits  

```javascript
// ✅ DO: Use options object for many parameters
const createUser = ({ name, email, age, preferences, metadata }) => ({
  id: generateId(),
  name,
  email,
  age,
  preferences: preferences || {},
  metadata: metadata || {},
  createdAt: new Date().toISOString()
});

// ❌ DON'T: Too many parameters (ESLint error at 5+)
const createUser = (name, email, age, pref1, pref2, meta1, meta2) => {
  // Hard to call and maintain
};
```

### Complexity Limits

```javascript
// ✅ DO: Extract complex logic
const determineUserAccess = (user, resource) => {
  if (isAdmin(user)) return 'full';
  if (isOwner(user, resource)) return 'full';  
  if (isCollaborator(user, resource)) return 'limited';
  return 'none';
};

const isAdmin = (user) => user.role === 'admin';
const isOwner = (user, resource) => resource.ownerId === user.id;
const isCollaborator = (user, resource) => 
  resource.collaborators?.includes(user.id);

// ❌ DON'T: Deeply nested conditions (complexity warning at 10+)
const complexFunction = (user, resource, context) => {
  if (user) {
    if (user.role === 'admin') {
      if (context.env === 'production') {
        if (resource.type === 'sensitive') {
          // Too much nesting...
        }
      }
    }
  }
};
```

---

## 🔧 Development Workflow

### Before Coding
1. **Read relevant ADRs** - Understand architectural decisions
2. **Check existing patterns** - Follow established conventions
3. **Run linter** - `bun run lint:functional` 

### During Coding
1. **Factory functions only** - No classes
2. **Immutable operations** - No mutations
3. **Pure functions** - Minimize side effects
4. **Small functions** - Under 150 lines
5. **Clear naming** - Express intent clearly

### Before Committing  
```bash
# Required checks
bun run lint:functional       # Fix any functional programming violations
bun run typecheck            # Fix any TypeScript errors  
bun test                     # Ensure all tests pass

# Optional but recommended
bun run lint:functional:strict   # Zero warnings
```

### Code Review Checklist
- [ ] No classes or `this` usage
- [ ] Immutable data operations used
- [ ] Functions under 150 lines  
- [ ] Max 4 parameters per function
- [ ] Proper error handling
- [ ] One of 3 composition patterns used
- [ ] Single unified orchestrator used
- [ ] Tests added/updated

---

## 📚 Resources

### Documentation
- **ADR 001**: Pipeline composition consolidation
- **ADR 002**: Error handling standardization  
- **ADR 003**: Orchestration consolidation
- **ADR 004**: Functional programming enforcement
- **ADR 005**: Pattern enforcement guidelines

### Tools
- **ESLint Config**: `eslint.config.functional.js`
- **Package Scripts**: `lint:functional`, `lint:functional:fix`, `lint:functional:strict`
- **TypeScript**: Type checking and IDE support

### Examples
- **Unified Orchestrator**: `src/core/orchestration/unified-orchestrator.ts`
- **Pipeline Composer**: `src/core/pipeline/composers/index.ts`  
- **Composition Engine**: `src/core/pipeline/composition/composition-engine.ts`

---

## ❗ Common Violations & Fixes

### Classes → Factory Functions
```javascript
// ❌ Before (Class)
class ApiClient {
  constructor(baseUrl) { this.baseUrl = baseUrl; }
  get(path) { return fetch(`${this.baseUrl}${path}`); }
}

// ✅ After (Factory Function)  
const createApiClient = (baseUrl) => ({
  get: (path) => fetch(`${baseUrl}${path}`),
  post: (path, data) => fetch(`${baseUrl}${path}`, { 
    method: 'POST', 
    body: JSON.stringify(data) 
  })
});
```

### Mutations → Immutable Operations
```javascript
// ❌ Before (Mutating)
const addUser = (users, newUser) => {
  users.push(newUser);        // Mutates original array
  return users;
};

// ✅ After (Immutable)
const addUser = (users, newUser) => [...users, newUser];
```

### Complex Functions → Composition
```javascript
// ❌ Before (Complex, 200+ lines)
const processOrder = (order) => {
  // 200+ lines of mixed validation, calculation, and saving
};

// ✅ After (Composed)
const processOrder = (order) => {
  const validated = validateOrder(order);
  const calculated = calculateTotals(validated);
  const saved = saveOrder(calculated);
  return saved;
};
```

---

This guide reflects the clean, simplified architecture achieved in Phase 1. All patterns are enforced by automated tooling and designed for maintainability, consistency, and team productivity.