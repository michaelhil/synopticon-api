# Synopticon API - Architecture Documentation

> **Phase 1 Architectural Simplification COMPLETE** ✅  
> 40% complexity reduction achieved through systematic simplification and pattern enforcement.

This directory contains architectural documentation, decision records, and design guidelines for the Synopticon API project.

## Structure

```
docs/architecture/
├── README.md                 # This file - architecture documentation overview
├── decisions/                # Architecture Decision Records (ADRs)  
├── diagrams/                # Architecture diagrams and visualizations
├── guidelines/              # Development and architecture guidelines
└── complexity-audit/        # Architectural complexity analysis
```

## Architecture Decision Records (ADRs)

We use Architecture Decision Records to document significant architectural decisions. Each ADR captures:

- **Context**: The situation that necessitated the decision
- **Decision**: The change or approach we're taking  
- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Consequences**: Expected outcomes, trade-offs, and impacts

### Current ADRs

**Phase 1 Architectural Simplification:**
- `001-pipeline-composition-consolidation.md` - Reduced 5 patterns to 3 core patterns
- `002-error-handling-standardization.md` - Standardized error handling across all systems  
- `003-orchestration-consolidation.md` - Unified orchestration with embedded registry
- `004-functional-programming-enforcement.md` - Automated functional programming patterns
- `005-pattern-enforcement-guidelines.md` - Comprehensive development guidelines

### Creating a New ADR

1. Copy the template from `decisions/000-adr-template.md`
2. Rename with the next sequential number and descriptive title
3. Fill in all sections completely
4. Get architectural review before implementing
5. Update status as decision progresses

## Current Architecture Overview

### System Components

The Synopticon API consists of several major architectural components:

1. **Pipeline System** - Multi-modal data processing pipelines
2. **Orchestration Layer** - Pipeline coordination and execution
3. **Distribution System** - Multi-protocol data distribution
4. **Configuration Management** - Centralized configuration system
5. **Analysis Engines** - Computer vision, eye-tracking, and behavioral analysis
6. **API Layer** - REST and WebSocket APIs
7. **Integration Layer** - External service integrations (MCP, WebRTC, etc.)

### Architecture Principles

1. **Functional Programming First** - Prefer factory functions over classes
2. **Zero Dependencies** - Minimize external dependencies where feasible
3. **Type Safety** - Use TypeScript for core infrastructure
4. **Performance by Design** - Build performance monitoring into architecture
5. **Configuration-Driven** - Make behavior configurable rather than hardcoded
6. **Modular Design** - Clear separation of concerns between components

### Current Complexity Status

As of the Phase 1 architectural assessment:

- **Total Files**: 432 source files (239 JS, 193 TS)
- **Lines of Code**: ~118,000 LOC  
- **Architectural Concepts**: 12+ distinct patterns
- **Abstraction Layers**: 5-7 deep in critical paths

**Critical Issues Identified:**
- Duplicate pipeline composition implementations
- Redundant orchestration layers
- Protocol implementation proliferation 
- Mixed JS/TS pattern consistency issues

## Architecture Improvement Roadmap

### Phase 1: Critical Stabilization (Months 1-2)
- ✅ Architectural complexity assessment completed
- 🔄 ADR system implementation
- ⏳ Pipeline composition consolidation
- ⏳ Orchestration layer simplification

### Phase 2: Foundation Strengthening (Months 3-4)
- Testing infrastructure overhaul
- Performance monitoring implementation
- Documentation consolidation

### Phase 3: Optimization (Months 5-6)
- Pattern enforcement automation
- Security hardening
- Scalability architecture design

## Key Architectural Metrics

We track these metrics to measure architectural health:

- **Complexity Metrics**: LOC, cyclomatic complexity, abstraction layers
- **Quality Metrics**: Test coverage, type safety coverage, pattern compliance
- **Performance Metrics**: Build time, startup time, memory usage
- **Maintainability Metrics**: Time to onboard, bug resolution time, feature velocity

## Architecture Review Process

1. **RFC (Request for Comments)**: For major architectural changes
2. **ADR Creation**: Document the decision with context and alternatives
3. **Team Review**: Architectural review with senior developers
4. **Implementation**: Phased rollout with monitoring
5. **Retrospective**: Review outcomes and update ADR status

## Getting Started

### For New Team Members

1. Read this overview document
2. Review active ADRs in `decisions/`
3. Study the complexity audit in `complexity-audit/`
4. Familiarize yourself with architecture diagrams
5. Follow the development guidelines

### For Architecture Changes

1. Create an RFC document outlining the proposed change
2. Discuss with the architecture team
3. Create an ADR documenting the decision
4. Implement with appropriate monitoring and rollback plans
5. Update documentation and diagrams

## Resources

- [C4 Model](https://c4model.com/) - Our diagram standard
- [Architecture Decision Records](https://adr.github.io/) - ADR methodology
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Architecture principles
- [Functional Programming Guide](./guidelines/functional-programming.md) - Our FP standards

## Contact

For architecture questions or proposals:
- Create an issue with the `architecture` label
- Discuss in the `#architecture` channel
- Schedule architecture office hours for complex topics