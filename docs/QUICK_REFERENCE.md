# Quick Reference - Synopticon Development

> **Simplified Architecture - Phase 1 Complete** 🎉

## ⚡ Essential Commands

```bash
# Functional programming compliance
bun run lint:functional          # Check violations
bun run lint:functional:fix      # Auto-fix issues  
bun run lint:functional:strict   # Zero warnings mode

# Quality checks
bun run typecheck               # TypeScript validation
bun test                       # Run all tests
```

## 🚫 Prohibited Patterns

| ❌ Don't Use | ✅ Use Instead | Why |
|--------------|----------------|-----|
| `class MyClass {}` | `const createMyClass = () => ({})` | Factory functions only |
| `array.push(item)` | `[...array, item]` | Immutable operations |
| `array.sort()` | `[...array].sort()` | Avoid mutations |
| `obj.prop = val` | `{...obj, prop: val}` | Immutable updates |
| `throw 'error'` | `throw new Error('error')` | Proper Error objects |
| Multiple orchestrators | Single unified orchestrator | Simplified architecture |
| 5 composition patterns | 3 patterns (Sequential/Parallel/Adaptive) | Reduced complexity |

## ✅ Required Patterns

### Factory Functions
```javascript
export const createService = (config) => ({
  method1: () => { /* implementation */ },
  method2: (data) => { /* implementation */ }
});
```

### Pipeline Composition (3 patterns only)
```javascript
// 1. Sequential - one after another
{ pattern: 'sequential', pipelines: [{ id: 'step1' }, { id: 'step2' }] }

// 2. Parallel - all at once  
{ pattern: 'parallel', pipelines: [{ id: 'task1' }, { id: 'task2' }] }

// 3. Adaptive - conditional execution
{ 
  pattern: 'adaptive', 
  pipelines: [
    { id: 'rule1', condition: (input) => input.type === 'A', pipelineIds: ['processA'] }
  ] 
}
```

### Unified Orchestrator
```javascript
import { createUnifiedOrchestrator } from '../core/orchestration/unified-orchestrator.ts';

const orchestrator = createUnifiedOrchestrator();
orchestrator.register('my-pipeline', pipelineFunction, { capabilities: ['feature'] });
const result = await orchestrator.execute({ capabilities: ['feature'] }, data);
```

### Error Handling
```javascript
// Result pattern
const operation = async () => {
  try {
    const data = await fetch('/api');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message, code: 'FETCH_ERROR' };
  }
};
```

## 📏 Limits (Enforced by ESLint)

- **Function size**: ≤ 200 lines (warning at 200)
- **Parameters**: ≤ 4 per function (use options object)
- **Complexity**: ≤ 10 (extract complex logic)
- **No classes**: Use factory functions
- **No mutations**: Use immutable operations

## 🔍 Common Fixes

### Classes → Factory Functions
```javascript
// ❌ Class
class UserService {
  constructor(config) { this.config = config; }
  getUser(id) { return fetch(`${this.config.url}/users/${id}`); }
}

// ✅ Factory Function
const createUserService = (config) => ({
  getUser: (id) => fetch(`${config.url}/users/${id}`)
});
```

### Mutations → Immutable
```javascript
// ❌ Mutations
items.push(newItem);
items.sort((a, b) => a.id - b.id);
user.name = 'Updated';

// ✅ Immutable
const newItems = [...items, newItem];
const sortedItems = [...items].sort((a, b) => a.id - b.id);
const updatedUser = { ...user, name: 'Updated' };
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│           Unified Orchestrator          │  ← Single point of orchestration
├─────────────────────────────────────────┤
│         Pipeline Composer              │  ← 3 patterns: Sequential/Parallel/Adaptive
├─────────────────────────────────────────┤
│    Individual Pipelines (Factory)      │  ← Factory functions, not classes
└─────────────────────────────────────────┘
```

## 📚 Key Documents

- **ADR 005**: [Pattern Enforcement Guidelines](./architecture/decisions/005-pattern-enforcement-guidelines.md)
- **Full Guide**: [Development Patterns](./DEVELOPMENT_PATTERNS.md)
- **ADRs**: [Architecture Decisions](./architecture/decisions/)

## 🚦 Pre-commit Checklist

- [ ] `bun run lint:functional` passes
- [ ] `bun run typecheck` passes  
- [ ] `bun test` passes
- [ ] No classes used
- [ ] No mutations used
- [ ] Functions under 200 lines
- [ ] Max 4 parameters per function

---

**Phase 1 Complete**: Clean, simplified architecture with automated enforcement. 
New code must follow these patterns. Existing code will be gradually improved.