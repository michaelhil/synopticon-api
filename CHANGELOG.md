# Changelog

All notable changes to Synopticon API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.9] - 2025-08-27 - WebRTC Face Streaming & Performance Optimization

### 🎥 **Major Feature: WebRTC Face Streaming**
- **Complete WebRTC Implementation**: Real-time video and face landmark streaming
  - Two-phase signaling architecture with discovery and direct peer-to-peer
  - MediaPipe Face Mesh integration with 468 landmark points
  - Data channel for efficient landmark transmission (12 FPS, optimized JSON)
  - HD video streaming (1280x720 at 25 FPS, 1.5 Mbps)
  - Support for broadcaster and receiver roles

### 🔧 **Critical Fixes**
- **WebRTC Signaling**: Fixed session ID mismatches and missing sourceSession in broadcasts
- **Face Mesh Issues**: Resolved displacement and inverted movement (removed selfieMode)
- **Initial Rendering**: Fixed face mesh not appearing on camera start
- **Performance**: Resolved FPS drop from 55 to 25 when broadcasting starts
- **Lint Errors**: Fixed undefined globals (FaceMesh, RTCPeerConnection) and unused variables

### 📈 **Performance Improvements**
- **Optimized Face Data**: 40% reduction in JSON size with 4 decimal precision
- **Video Encoding**: Balanced quality/performance (1.5 Mbps, 25 FPS)
- **Data Throttling**: Reduced from 15 to 12 FPS for better CPU sharing
- **MediaPipe**: Disabled refineLandmarks for 15% performance gain
- **Result**: Maintains 40+ FPS while broadcasting (up from 25 FPS)

### 🎨 **UI/UX Enhancements**
- **Toggle Buttons**: Removed redundant stop button, all controls are now toggles
- **Visual Distinction**: Remote face mesh rendered in red, local in green
- **HD Video**: Upgraded from 640x480 to 1280x720 resolution
- **Auto-start**: Camera starts automatically on page load

### 📚 **Documentation**
- **WebRTC Architecture Guide**: Complete signaling flow and infrastructure design
- **Implementation Guide (JSON)**: Comprehensive troubleshooting and patterns
- **Problem-Solution Reference**: Documented all issues and their fixes
- **Best Practices**: Testing, debugging, and production recommendations

### 🛠️ **Developer Experience**
- **ESLint Configuration**: Added .eslintrc.json with proper browser API globals
- **Quick Fixes**: Automated lint fixes for common issues
- **Error Prefixing**: Consistent `_error` convention for unused catches
- **Cache Busting**: Better development experience with forced refreshes

## [0.5.8] - 2025-08-27 - Breaking Changes: Clean Modern API

### 💥 **BREAKING CHANGES**
- **Runtime**: Bun-only (Node.js support fully removed)
- **Dependencies**: Express.js and related middleware completely removed from optionalDependencies
- **Speech Recognition**: Fallback mechanisms removed (Web Speech API required)
- **API**: All backward compatibility layers and legacy support removed

### 🧹 **Code Cleanup**
- **Removed fallback systems**: Eliminated speech recognition fallback UI and backend
- **Cleaned compatibility comments**: Removed 50+ "backward compatibility" references
- **Simplified interfaces**: Removed legacy support comments and compatibility layers
- **Modernized test suite**: Removed browser compatibility tests
- **Streamlined package.json**: Only essential dependencies remain

### 🚀 **Performance & Maintainability**
- **Reduced complexity**: Cleaner codebase with single runtime target
- **Improved performance**: No compatibility overhead or fallback checking
- **Better maintainability**: Simplified code paths and clear requirements
- **Modern patterns**: Current best practices throughout

### 📋 **Migration Required**
- **Runtime**: Ensure Bun >=1.0.0 is installed
- **Server**: Update any Express.js usage to Bun.serve
- **Speech**: Verify Web Speech API availability in target browsers
- **Dependencies**: Remove any Node.js or Express.js assumptions

See `BREAKING_CHANGES_v0.5.8.md` for complete migration guide.

## [0.5.7] - 2025-08-27 - Model Context Protocol Integration

### 🤖 **Major Feature: LLM Integration**
- **Model Context Protocol (MCP) Server**: Complete LLM client integration for natural language control
  - 16 production-ready MCP tools across 4 categories (System, Face Analysis, Emotion Analysis, Media Streaming)
  - Full support for Claude Desktop, Cursor, and Continue
  - Zero-configuration setup wizard with automatic Synopticon detection
  - Comprehensive API client with retry logic and error handling
  - Lazy tool loading based on Synopticon capabilities
  - Interactive setup wizard supporting local, remote, and Docker deployments

### 📚 **Documentation & Developer Experience**
- **Complete MCP Documentation Suite**: 1,380+ lines of comprehensive documentation
  - `docs/MCP_SETUP_GUIDE.md` - Complete setup instructions for all scenarios (380 lines)
  - `docs/MCP_API_REFERENCE.md` - Detailed API reference for all 16 tools (520 lines)
  - `docs/MCP_DEVELOPMENT_GUIDE.md` - Development guide with best practices (480 lines)
- **Developer Tools**: Interactive helpers for MCP development
  - `scripts/setup-mcp.js` - Automated setup wizard (350 lines)
  - `scripts/add-mcp-tools.js` - Tool creation helper (280 lines)
- **Pre-built Configurations**: Ready-to-use configs for all major LLM clients

### 🛠 **Technical Implementation**
- **MCP Server Architecture**: Production-ready implementation (~3,200 lines TypeScript/JavaScript)
  - `src/services/mcp/server.ts` - Main MCP server with stdio/SSE transport (346 lines)
  - `src/services/mcp/client/http-client.ts` - HTTP API client with circuit breakers (324 lines)
  - `src/services/mcp/tools/` - 16 tools with comprehensive validation (693 lines total)
  - `src/services/mcp/utils/` - Logging, error handling, validation utilities (389 lines)
- **Quality Assurance**: 48+ unit tests with comprehensive coverage
- **Package Integration**: Updated scripts, keywords, and documentation

### ✨ **User Experience Features**
- **Natural Language Control**: Conversational interface for all Synopticon capabilities
  - *"Check if Synopticon is running properly"*
  - *"Start face detection on my webcam with high quality"* 
  - *"What emotions are currently detected?"*
  - *"List available cameras and microphones"*
- **Multi-Deployment Support**: Local, remote server, Docker container scenarios
- **Automatic Configuration**: Setup wizard handles 90% of scenarios without manual intervention

## [0.5.6] - 2025-08-27 - Knip Optimization & Built-in MQTT Implementation

### 🚀 **Major Features**
- **Model Context Protocol (MCP) Integration**: Complete LLM client integration for natural language control
  - 16 production-ready MCP tools across 4 categories (System, Face, Emotion, Media)
  - Full support for Claude Desktop, Cursor, and Continue
  - Zero-configuration setup wizard with automatic Synopticon detection
  - Comprehensive API client with retry logic and error handling
  - Lazy tool loading based on Synopticon capabilities
  - Interactive setup wizard supporting local, remote, and Docker deployments
  - Complete documentation with setup guides, API reference, and development guide

- **Built-in MQTT Implementation**: Complete zero-dependency MQTT client with full protocol support
  - Zero external dependencies - built from scratch for Bun/Node.js
  - Full MQTT v3.1.1 protocol compliance with QoS 0, 1, and 2 support
  - Wildcard subscriptions with `+` and `#` patterns
  - Circuit breaker patterns for reliability
  - Comprehensive test suite with 11 passing tests

### 🔧 **Code Quality Improvements**
- **Import Structure Overhaul**: Fixed all unresolved imports (40+ issues resolved)
  - Updated all import paths to point to correct file locations
  - Resolved core module dependencies (`types.js`, `pipeline.js`, `orchestrator.js`)
  - Fixed eye-tracking, face-detection, and speech-analysis import paths

- **Export Cleanup**: Eliminated all duplicate exports (22+ duplicates removed)
  - Removed redundant default exports where named exports existed  
  - Cleaned up circular export references
  - Maintained clean API surface with only necessary exports

- **Unused Code Cleanup**: 
  - Removed 7 clearly unused files with `-new` suffixes
  - Eliminated all unused enum members (7 removed from base distributors)
  - Conservative approach preserving functional code (184 unused files identified for future cleanup)

### 🛠 **Technical Improvements**
- **Zero Dependency Goals**: Eliminated unlisted `mqtt` dependency via built-in implementation
- **Factory Function Patterns**: All MQTT code follows functional programming patterns
- **TypeScript Integration**: Full type safety with proper interfaces and enums
- **Industry Standards**: All file sizes and function complexity within industry standards

### 📦 **MCP Implementation Details**
**Core Components** (`src/services/mcp/`):
- `server.ts` - Main MCP server with stdio/SSE transport support (346 lines)
- `client/http-client.ts` - HTTP API client with retry logic and error handling (324 lines)
- `tools/` - 16 production-ready tools across 4 categories (693 lines total)
  - `system-tools.ts` - Health checks, status, capabilities (3 tools)
  - `face-tools.ts` - Face detection and configuration (4 tools)
  - `emotion-tools.ts` - Emotion analysis and thresholds (4 tools)
  - `media-tools.ts` - Media streaming and device management (4 tools)
- `config/` - Configuration system and tool registry (196 lines)
- `utils/` - Logging, error handling, and validation utilities (389 lines)

**Setup and Documentation**:
- `scripts/setup-mcp.js` - Interactive setup wizard (350 lines)
- `scripts/add-mcp-tools.js` - Tool creation helper (280 lines)
- `docs/MCP_SETUP_GUIDE.md` - Complete setup documentation (380 lines)
- `docs/MCP_API_REFERENCE.md` - Detailed API reference (520 lines)
- `docs/MCP_DEVELOPMENT_GUIDE.md` - Development guide (480 lines)
- `configs/mcp-clients/` - Pre-built configurations for all major LLM clients

### 📦 **MQTT Implementation Details**
**Core Components** (`src/core/distribution/mqtt/`):
- `mqtt-client.ts` - Main MQTT client factory function (460 lines)
- `mqtt-connection.ts` - TCP connection using Bun's native socket API (295 lines)
- `mqtt-parser.ts` - MQTT packet parsing (308 lines)
- `mqtt-packet-builder.ts` - MQTT packet construction (280 lines)
- `mqtt-subscription-manager.ts` - Topic pattern matching (180 lines)
- `mqtt-types.ts` - Comprehensive TypeScript definitions (158 lines)

### 🧪 **Testing & Validation**
- **MQTT Test Suite**: 11 comprehensive tests covering all components
- **Security Audit**: No vulnerabilities found in dependencies
- **Phase 2 Integration**: 17/17 tests passing with 100% success rate
- **Distribution System**: Full functionality preserved during refactoring

### 📊 **Knip Analysis Results**
**Before**: 228 unused files, 40+ unresolved imports, 22+ duplicate exports, 7 unused enums
**After**: 184 unused files, 0 unresolved imports, 0 duplicate exports, 0 unused enums

### 🏗️ **Architecture Updates**
- **Event-Driven MQTT**: Proper event handling and callbacks
- **Distributor Integration**: Seamless integration with existing distributor system
- **Circuit Breaker Patterns**: Built-in reliability and failure handling
- **Real-time Capabilities**: Full support for real-time data distribution

### 📋 **Migration Notes**
- All MQTT functionality now uses built-in implementation
- Import paths updated - no action required for users of public APIs
- Backward compatibility maintained for all public interfaces
- Zero breaking changes to existing functionality

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