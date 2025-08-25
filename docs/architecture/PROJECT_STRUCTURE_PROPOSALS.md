# 🏗️ Project Structure Reorganization Proposals

## Current State Analysis

### 🔴 Critical Issues Identified
- **99 files at root level** (64 docs/configs, 35 scripts/tests)
- **49 .md files** scattered at root (audits, guides, reports)
- **15 .json files** at root (configs, reports)
- **Duplicate folders**: `demos/` vs `examples/` with similar content
- **Inconsistent naming**: test-*.js, *test.js, *-demo.js mixed at root
- **No clear separation** between dev tools, docs, and production code
- **Mixed TypeScript/JavaScript** files without clear organization

---

## 📋 Proposal 1: Domain-Driven Monorepo Structure

```
synopticon-api/
├── packages/                    # Monorepo packages (publishable units)
│   ├── core/                   # Core TypeScript functionality
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   ├── pipelines/              # Analysis pipelines
│   │   ├── mediapipe/
│   │   ├── eye-tracking/
│   │   └── emotion/
│   ├── api/                    # API servers
│   │   ├── http/
│   │   ├── websocket/
│   │   └── distribution/
│   └── client/                 # Client SDKs
│       ├── browser/
│       └── node/
├── apps/                       # Deployable applications
│   ├── server/                # Main API server
│   ├── demo-site/            # Interactive demos
│   └── docs-site/            # Documentation website
├── tools/                      # Development tools
│   ├── scripts/               # Build/dev scripts
│   ├── fixtures/              # Test fixtures
│   └── generators/            # Code generators
├── docs/                       # All documentation
│   ├── api/                   # API docs
│   ├── guides/                # User guides
│   ├── audits/                # Audit reports
│   └── architecture/          # Architecture docs
├── examples/                   # Example implementations
│   ├── basic/
│   ├── advanced/
│   └── integration/
├── .config/                    # Configuration files
│   ├── typescript/
│   ├── eslint/
│   └── vite/
└── [root config files only]   # package.json, tsconfig.json, etc.
```

### ✅ Pros
- **Industry standard** monorepo structure (similar to Next.js, Babel, React)
- **Clear separation** of concerns with packages
- **Scalable** for future growth with independent packages
- **Publishable** modules to npm if needed
- **CI/CD friendly** with clear build targets
- **Tool compatibility** with Lerna, Nx, Turborepo

### ❌ Cons
- **Complex refactoring** required to split into packages
- **Learning curve** for monorepo tooling
- **Overhead** for small team
- **More configuration** files needed per package

---

## 📋 Proposal 2: Feature-Based Modular Structure

```
synopticon-api/
├── src/                        # All source code
│   ├── core/                  # Core system (TypeScript)
│   │   ├── config/
│   │   ├── orchestrator/
│   │   ├── strategies/
│   │   └── types/
│   ├── features/              # Feature modules (gradual TS migration)
│   │   ├── face-detection/
│   │   ├── eye-tracking/
│   │   ├── emotion-analysis/
│   │   ├── speech-analysis/
│   │   └── distribution/
│   ├── services/              # Service layer
│   │   ├── api/              # HTTP/WebSocket servers
│   │   ├── storage/          # Data persistence
│   │   └── streaming/        # Real-time streaming
│   └── shared/                # Shared utilities
│       ├── utils/
│       ├── types/
│       └── constants/
├── tests/                      # All tests organized by type
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── docs/                       # Centralized documentation
│   ├── README.md              # Main readme
│   ├── api/                   # API documentation
│   ├── guides/                # How-to guides
│   ├── reports/               # Audit/analysis reports
│   │   └── archive/          # Old reports
│   └── roadmap/              # Project roadmap
├── examples/                   # All examples/demos
│   ├── playground/           # Interactive demos
│   ├── snippets/            # Code snippets
│   └── tutorials/           # Step-by-step tutorials
├── scripts/                    # Build and utility scripts
│   ├── build/
│   ├── deploy/
│   └── dev/
├── config/                     # All configuration
│   ├── env/                  # Environment configs
│   ├── build/                # Build configs
│   └── ci/                   # CI/CD configs
└── [minimal root files]       # Only essential root files
```

### ✅ Pros
- **Feature cohesion** - Related code stays together
- **Gradual migration** friendly (JS to TS per feature)
- **Clear boundaries** between features
- **Simple mental model** for developers
- **Easy navigation** for both AI and humans
- **Flexible** for adding new features

### ❌ Cons
- **Potential duplication** between features
- **Cross-feature dependencies** might be complex
- **Less suitable** for publishing individual packages
- **Testing organization** separated from source

---

## 📋 Proposal 3: Clean Architecture Layers

```
synopticon-api/
├── domain/                     # Business logic (pure TS)
│   ├── entities/              # Core entities
│   ├── pipelines/             # Pipeline definitions
│   └── contracts/             # Interfaces/types
├── application/                # Application services
│   ├── orchestration/         # Pipeline orchestration
│   ├── strategies/            # Processing strategies
│   └── use-cases/             # Business use cases
├── infrastructure/             # External interfaces
│   ├── api/                   # API implementations
│   │   ├── http/
│   │   ├── websocket/
│   │   └── graphql/
│   ├── persistence/           # Data storage
│   ├── streaming/             # Real-time protocols
│   └── integrations/          # External services
├── presentation/               # User interfaces
│   ├── web/                   # Web demos/playground
│   ├── cli/                   # CLI tools
│   └── sdk/                   # Client SDKs
├── quality/                    # Quality assurance
│   ├── tests/                 # All tests
│   │   ├── specs/            # By specification
│   │   └── fixtures/          # Test data
│   ├── benchmarks/            # Performance tests
│   └── security/              # Security tests
├── documentation/              # All documentation
│   ├── architecture/          # Architecture Decision Records
│   ├── api-reference/         # Generated API docs
│   ├── tutorials/             # Learning materials
│   ├── reports/               # Analysis/audit reports
│   └── changelog/             # Version history
├── operations/                 # DevOps/Operations
│   ├── docker/                # Container configs
│   ├── kubernetes/            # K8s manifests
│   ├── scripts/               # Automation scripts
│   └── monitoring/            # Monitoring configs
└── [root essentials]          # Minimal root files
```

### ✅ Pros
- **Clean architecture** principles (Uncle Bob)
- **Testable** with dependency inversion
- **Framework agnostic** core domain
- **Clear layers** with unidirectional dependencies
- **Enterprise-grade** organization
- **Excellent** for large teams

### ❌ Cons
- **Over-engineered** for current project size
- **Steep learning curve** for clean architecture
- **More abstraction** layers than needed
- **Verbose** file paths and imports

---

## 🎯 Recommendation: Proposal 2 (Feature-Based Modular)

### Why Proposal 2 is Optimal

1. **Best fit for current state**
   - Minimal restructuring required
   - Preserves existing feature organization
   - Supports gradual TypeScript migration

2. **Optimal for AI assistance**
   - Clear, predictable paths
   - Feature-focused organization
   - Easy to describe locations in prompts

3. **Human-friendly**
   - Intuitive navigation
   - Related files stay together
   - Simple mental model

4. **Future-proof**
   - Easy to add new features
   - Can evolve to monorepo later
   - Supports both growth and simplification

### 📅 Migration Plan

#### Phase 1: Documentation Cleanup (Week 1)
```bash
# Move all .md files to organized docs/
mkdir -p docs/{reports,guides,roadmap,api}
mv *.md docs/reports/
mv *GUIDE*.md docs/guides/
mv *ROADMAP*.md docs/roadmap/
```

#### Phase 2: Test Organization (Week 1)
```bash
# Organize tests by type
mkdir -p tests/{unit,integration,e2e}
mv test-*.js tests/integration/
mv tests/*.test.js tests/unit/
```

#### Phase 3: Example Consolidation (Week 2)
```bash
# Merge demos and examples
mkdir -p examples/{playground,tutorials}
mv demos/* examples/playground/
mv examples/*.html examples/playground/
```

#### Phase 4: Config Centralization (Week 2)
```bash
# Move configs to dedicated directory
mkdir -p config/{env,build}
mv *.json config/
mv .env* config/env/
```

#### Phase 5: Source Reorganization (Week 3-4)
- Reorganize src/ into features/
- Move services to dedicated layer
- Establish shared utilities

### 📏 Naming Conventions

```
Files:
- TypeScript: kebab-case.ts
- Tests: *.test.ts or *.spec.ts
- Configs: kebab-case.config.ts

Directories:
- Features: kebab-case/
- Grouping: singular (config/, not configs/)

Documentation:
- Guides: GUIDE_*.md
- Reports: REPORT_*.md
- Roadmaps: ROADMAP_*.md
```

### 🔄 Maintenance Rules

1. **No files at root** except package.json, README.md, LICENSE
2. **All docs in docs/** - no scattered .md files
3. **All tests in tests/** - organized by type
4. **One feature, one folder** - complete encapsulation
5. **Configs centralized** - easier to manage environments

### 📊 Success Metrics

- **Root directory**: < 10 files (currently 99)
- **Documentation findability**: 100% in docs/
- **Test organization**: Clear unit/integration/e2e separation
- **Import paths**: Maximum 3 levels deep
- **Feature isolation**: < 5% cross-feature imports

---

## 🚀 Immediate Actions

1. **Create migration script** to automate file moves
2. **Update all imports** after reorganization  
3. **Update .gitignore** for new structure
4. **Create README** in each major directory
5. **Update CI/CD** paths if needed

This structure will make the project:
- **Easier to navigate** on GitHub
- **Clearer for new contributors**
- **More efficient for AI assistance**
- **Scalable for future growth**
- **Professional and maintainable**