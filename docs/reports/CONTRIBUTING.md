# Contributing to Synopticon API

Thank you for your interest in contributing to Synopticon API! This document provides guidelines for contributing to the project.

## 🎯 Project Vision

Synopticon API is an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization, designed for behavioral research environments.

## 🛠️ Development Setup

### Prerequisites

- **Bun** (preferred): Install from [bun.sh](https://bun.sh)
- **Node.js** 18+ (alternative runtime)
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/synopticon-api.git
   cd synopticon-api
   ```

2. **Install dependencies**
   ```bash
   bun install  # preferred
   # or
   npm install
   ```

3. **Run development server**
   ```bash
   bun run dev
   # Open http://localhost:3000/examples/basic-demo.html
   ```

4. **Run tests**
   ```bash
   bun test
   ```

## 🏗️ Architecture Overview

### Core Components

- **Pipelines**: Individual analysis modules (face detection, emotion analysis, etc.)
- **Orchestrator**: Multi-pipeline coordination with circuit breakers
- **Runtime Detection**: Hybrid browser/Node.js compatibility
- **API Server**: REST endpoints for external integration

### Hybrid Architecture

All pipelines follow a hybrid pattern:
- **Browser**: Full WebGL/GPU acceleration
- **Node.js**: CPU fallbacks with graceful degradation
- **Universal**: Single codebase works everywhere

## 📝 Code Standards

### JavaScript Style

- **Functional Programming**: Use factory functions, not classes
- **ES Modules**: Import/export syntax
- **Configuration Objects**: Prefer config objects over multiple parameters
- **Pure Functions**: Avoid side effects where possible

### Example Pattern

```javascript
// ✅ Preferred: Factory function
export const createAnalyzer = (config = {}) => ({
  initialize: async () => { /* setup */ },
  process: async (input) => { /* analysis */ },
  cleanup: () => { /* teardown */ }
});

// ❌ Avoid: Class-based approach
class Analyzer {
  constructor(config) { /* avoid */ }
}
```

### File Organization

```
src/
├── core/           # Core orchestration and types
├── pipelines/      # Analysis pipelines
├── api/           # REST API server
├── utils/         # Runtime detection and utilities
└── examples/      # Demo applications
```

## 🔄 Contribution Workflow

### 1. Issues and Discussion

- Check existing [issues](../../issues) before creating new ones
- Use issue templates when available
- For major changes, open a discussion first

### 2. Development Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Implement** your changes following code standards
4. **Test** your changes: `bun test`
5. **Build** the project: `bun run build`
6. **Commit** with descriptive messages

### 3. Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain the change and its purpose
- **Tests**: Include tests for new functionality
- **Documentation**: Update docs if needed

## 🧪 Testing

### Running Tests

```bash
# Unit tests
bun test

# Performance benchmarks
bun run test:performance

# API tests
bun run api:test
```

### Writing Tests

- Place tests alongside source files or in `tests/` directory
- Use descriptive test names
- Test both browser and Node.js scenarios for hybrid features

## 📊 Performance Considerations

### Targets

- **Frame Time**: < 16.67ms (60 FPS ideal)
- **Detection**: < 10ms
- **Memory Growth**: < 100MB/hour

### Optimization Guidelines

- Use GPU processing where available
- Implement efficient memory management
- Profile before optimizing
- Document performance trade-offs

## 🐛 Bug Reports

Include:
- **Environment**: Browser/Node.js version, OS
- **Steps**: Clear reproduction steps
- **Expected vs Actual**: What should happen vs what happens
- **Minimal Example**: Smallest code that reproduces the issue

## 💡 Feature Requests

For new features:
- **Use Case**: Why is this feature needed?
- **Scope**: How does it fit with existing architecture?
- **Implementation**: Any thoughts on approach?

## 📋 Pipeline Development

### Creating New Pipelines

1. **Follow hybrid pattern** from existing pipelines
2. **Implement capabilities** from `src/core/types.js`
3. **Add runtime detection** for browser/Node.js compatibility
4. **Include fallback** implementations
5. **Export** from main `src/index.js`

### Pipeline Interface

```javascript
export const createYourPipeline = (config = {}) => {
  return createPipeline({
    name: 'your-pipeline',
    capabilities: [Capability.YOUR_CAPABILITY],
    performance: createPerformanceProfile({ fps: 30, latency: '20ms' }),
    initialize: async () => { /* setup */ },
    process: async (input) => { /* analysis */ },
    cleanup: () => { /* cleanup */ }
  });
};
```

## 🔐 Security

- **No Credentials**: Never commit API keys or secrets
- **Input Validation**: Validate all external inputs
- **Dependencies**: Keep dependencies minimal and updated
- **Sanitization**: Sanitize user-provided data

## 📄 Documentation

- **README**: Keep up-to-date with new features
- **Code Comments**: Document complex algorithms
- **API Docs**: Update endpoint documentation
- **Examples**: Provide working examples for new features

## 🏷️ Versioning

We follow [Semantic Versioning](https://semver.org/):
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

## 📞 Getting Help

- **Issues**: [Create an issue](../../issues/new)
- **Discussions**: [Start a discussion](../../discussions)
- **Documentation**: Check the [README](README.md)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Synopticon API! 🙏