# ADR 004: Functional Programming Enforcement via ESLint

## Status
Accepted

## Context
The user has explicitly requested strict functional programming patterns throughout the codebase, with specific preferences against ES6 classes and for factory functions. The architectural simplification effort (Phase 1) includes enforcing these patterns through automated tooling to prevent future violations.

### User Preferences (from CLAUDE.md):
- **Functional Programming**: Write JavaScript code using functions, object literals, and composition patterns instead of classes or constructors
- **No Classes**: Avoid ES6 classes, prefer factory functions and object composition
- **Pure Functions**: Favor pure functions and immutable data structures where possible
- **Composition over Inheritance**: Use function composition instead of class inheritance

## Decision
We will implement strict functional programming enforcement through ESLint with custom rules and established functional programming plugins.

### Implementation
1. **ESLint Configuration**: Created `eslint.config.functional.js` with functional programming rules
2. **Plugins Used**:
   - `eslint-plugin-fp`: Core functional programming rules
   - `eslint-plugin-functional`: Advanced functional programming patterns
   - `@typescript-eslint`: TypeScript-specific functional patterns
3. **Package Scripts**: Added `lint:functional`, `lint:functional:fix`, and `lint:functional:strict`

### Rules Enforced

#### Strict Prohibitions (Error Level)
- `fp/no-class`: No ES6 classes allowed
- `fp/no-this`: No `this` keyword usage
- `fp/no-mutating-methods`: No array mutating methods (push, pop, etc.)
- `functional/no-classes`: Redundant class prohibition
- `functional/immutable-data`: Prevent data mutations
- `no-param-reassign`: Prevent parameter mutations

#### Strong Preferences (Warning Level)
- `functional/no-let`: Prefer const over let
- `fp/no-mutation`: Comprehensive mutation prevention
- Factory function naming conventions

#### Allowed Patterns
- Built-in constructors (`Map`, `Set`, `Uint8Array`, etc.)
- Immutable array operations (`[...array].sort()`)
- Factory function patterns (`createX`, `buildY`)
- Pure function composition

## Consequences

### Positive
- **Architectural Consistency**: Enforces the user's preferred patterns automatically
- **Quality Assurance**: Prevents accidental use of prohibited patterns
- **Team Alignment**: Clear, automated guidelines for contributors
- **Refactoring Safety**: Existing patterns protected from regression

### Negative
- **Learning Curve**: Developers must understand functional programming principles
- **Initial Friction**: Existing code may trigger warnings during migration
- **Tool Complexity**: Additional ESLint configuration to maintain

### Migration Strategy
1. **Gradual Adoption**: Start with warnings, escalate to errors
2. **Documentation**: Provide functional programming examples in codebase
3. **IDE Integration**: Ensure ESLint integration works across development environments

## Compliance
This decision directly supports the Phase 1 architectural simplification goals by:
- Preventing architectural complexity through class hierarchies
- Enforcing immutable data patterns for predictability
- Maintaining consistency with user's global coding preferences
- Providing automated enforcement of design decisions

## Related Decisions
- ADR 001: Pipeline composition consolidation
- ADR 002: Error handling standardization
- ADR 003: Orchestration consolidation

## Usage
```bash
# Check functional programming compliance
bun run lint:functional

# Auto-fix functional programming issues
bun run lint:functional:fix

# Strict mode (zero warnings allowed)
bun run lint:functional:strict
```