# Contributing to Synopticon API

Thank you for your interest in contributing to Synopticon API! This document provides guidelines and information for contributors.

## Project Structure

```
synopticon-api/
├── src/                        # Source code
│   ├── core/                   # Core system components
│   │   ├── api/               # API routes and OpenAPI specs
│   │   ├── cognitive/         # AI and cognitive processing
│   │   ├── configuration/     # Configuration management
│   │   ├── distribution/      # Data distribution system
│   │   ├── engine/           # Processing engines
│   │   ├── orchestration/    # System orchestration
│   │   ├── pipeline/         # Processing pipelines
│   │   └── performance/      # Performance optimization
│   ├── features/              # Feature-specific modules
│   │   ├── eye-tracking/     # Eye tracking integration
│   │   ├── face-detection/   # Face detection pipelines
│   │   ├── media-streaming/  # Media streaming features
│   │   └── speech-analysis/  # Speech analysis features
│   ├── integrations/          # External integrations
│   │   ├── mcp/             # Model Context Protocol
│   │   ├── simulators/      # Flight/driving simulators
│   │   └── webrtc/          # WebRTC streaming
│   └── shared/               # Shared utilities and types
├── tests/                     # Test suites
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   ├── e2e/                 # End-to-end tests
│   ├── performance/         # Performance tests
│   └── fixtures/            # Test data and mocks
├── config/                   # Configuration files
├── docs/                     # Documentation
├── examples/                 # Example implementations
└── archive/                  # Historical documents
```

## Development Guidelines

### Code Style
- **TypeScript**: All new code should be written in TypeScript
- **Functional Programming**: Prefer factory functions over classes
- **ES Modules**: Use ES module imports/exports
- **Error Handling**: Use structured error handling patterns

### Testing
- Write tests for all new functionality
- Unit tests go in `tests/unit/`
- Integration tests go in `tests/integration/`
- Use descriptive test names
- Aim for good test coverage

### Documentation
- Update relevant documentation for new features
- Use JSDoc comments for functions and classes
- Keep README files updated
- Document breaking changes in CHANGELOG.md

## Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/synopticon-api.git
   cd synopticon-api
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests**
   ```bash
   bun test
   ```

4. **Start development server**
   ```bash
   bun run dev
   ```

## Submitting Changes

1. Create a feature branch from `main`
2. Make your changes following the guidelines above
3. Add tests for new functionality
4. Update documentation as needed
5. Run the test suite and ensure all tests pass
6. Submit a pull request with a clear description

## Code Review Process

- All submissions require review before merging
- Reviews focus on code quality, testing, and documentation
- Address feedback promptly and professionally
- Maintain a clean commit history

## Questions?

- Check existing issues and documentation first
- Create an issue for bugs or feature requests
- Join our community discussions for general questions

Thank you for contributing to Synopticon API!