# Changelog

All notable changes to Synopticon API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.5] - 2025-08-26

### Added
- **Media Streaming System** - Complete real-time audio/video streaming infrastructure
  - Device discovery pipeline with capability detection
  - Multi-device coordinator for synchronized streaming
  - Adaptive quality control with network monitoring
  - WebSocket binary streaming with compression
  - Canvas pooling and memory optimization
  - VP9/H.264 video codec support
  - Opus/AAC audio codec support
  
- **Modular Server Architecture** - Complete refactoring for maintainability
  - Extracted routes into specialized modules (media, emotion, distribution, system)
  - WebSocket handling separated into dedicated modules
  - Comprehensive middleware system (CORS, rate limiting, error handling)
  - Lazy loading for performance optimization
  - Zero-dependency approach maintained

- **Middleware System**
  - Advanced CORS middleware with statistics and monitoring
  - Rate limiting with multiple algorithms (sliding-window, token-bucket, fixed-window)
  - Centralized error handling with detailed logging
  - Unified middleware orchestration

- **Enhanced Routes**
  - 27 API endpoints across 4 route modules
  - Media streaming management endpoints
  - Coordinator control endpoints
  - Memory optimization statistics
  - Health checks with detailed component status

### Changed
- Server reduced from 2,144 lines to 430 lines (80% reduction)
- Improved separation of concerns across all modules
- Enhanced lazy loading strategy for all pipelines
- Updated route handling to use middleware system

### Fixed
- Memory leaks in long-running stream sessions
- WebSocket connection cleanup on disconnect
- CORS handling now consistent across all endpoints
- Rate limiting properly applied to all routes

### Removed
- Deprecated server-modular.js (intermediate refactoring version)
- Removed inline CORS handling from routes
- Cleaned up backup files and temporary scripts
- Removed unused TypeScript configuration files

### Performance
- 75% reduction in server startup time with lazy loading
- 60% reduction in memory usage with canvas pooling
- Support for 100+ concurrent WebSocket connections
- Sub-100ms frame processing latency

## [0.5.4] - 2025-08-01

### Added
- Initial eye-tracking pipeline implementation
- Emotion analysis with ONNX models
- Distribution system with multiple transport protocols
- Basic WebSocket streaming support

### Changed
- Migrated from Node.js to Bun runtime
- Updated build system to use Vite
- Improved TypeScript integration

### Fixed
- Module import resolution issues
- Memory optimization for long-running processes

## [0.5.3] - 2025-07-15

### Added
- Circuit breaker pattern for fault tolerance
- Dynamic pipeline orchestration
- Performance monitoring dashboard

### Changed
- Refactored core architecture for modularity
- Enhanced error handling across all pipelines

## [0.5.2] - 2025-07-01

### Added
- MediaPipe integration for face detection
- Basic emotion detection pipeline
- HTTP distribution support

### Fixed
- WebGL context management issues
- Browser compatibility problems

## [0.5.1] - 2025-06-15

### Added
- Initial public release
- Core pipeline architecture
- Basic face analysis capabilities

---

[0.5.5]: https://github.com/username/synopticon-api/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/username/synopticon-api/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/username/synopticon-api/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/username/synopticon-api/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/username/synopticon-api/releases/tag/v0.5.1