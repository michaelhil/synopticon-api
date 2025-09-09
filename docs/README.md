# Synopticon API Documentation

Welcome to the complete documentation suite for the Synopticon API - an open-source multi-modal behavioral analysis and cognitive advisory platform.

## 📚 Core Documentation

### Essential Guides
- **[📖 API Reference](API_REFERENCE.md)**: Complete REST and WebSocket API documentation
- **[🏗️ Architecture Guide](ARCHITECTURE.md)**: System design, components, and architecture patterns
- **[👨‍💻 Developer Guide](DEVELOPER_GUIDE.md)**: Development patterns, best practices, and tutorials

### Project Documentation
- **[📋 CHANGELOG](../CHANGELOG.md)**: Version history and release notes
- **[🤝 Contributing Guide](../CONTRIBUTING.md)**: How to contribute to the project
- **[📄 License](../LICENSE)**: MIT License details

## 🚀 Quick Navigation

### Getting Started
1. **[Quick Start](../README.md#quick-start)**: Get running in 5 minutes
2. **[Installation](DEVELOPER_GUIDE.md#installation)**: Detailed setup instructions
3. **[First API Call](API_REFERENCE.md#system-status)**: Test your installation
4. **[Examples](../examples/)**: Working code samples

### Specialized Guides
- [Quick Reference](QUICK_REFERENCE.md) - Common tasks and commands
- [Deployment Guide](guides/DEPLOYMENT.md) - Production deployment
- [Docker Deployment](guides/DOCKER_DEPLOYMENT_GUIDE.md) - Container deployment
- [MCP Integration](MCP_SETUP_GUIDE.md) - Model Context Protocol setup
- [MCP API Reference](MCP_API_REFERENCE.md) - MCP-specific API documentation
- [MCP Development](MCP_DEVELOPMENT_GUIDE.md) - MCP development patterns
- [Neon Eye Tracker](guides/NEON_EYE_TRACKER_INTEGRATION.md) - Eye tracking integration
- [Tobii 5 Integration](tobii5/) - Tobii eye tracker support

### Architecture Documentation
- [Pipeline Architecture](architecture/PIPELINE_ARCHITECTURE.md) - Core processing pipelines
- [Distribution Architecture](architecture/MULTI_DISTRIBUTION_ARCHITECTURE.md) - Data distribution system
- [Architecture Decisions](architecture/decisions/) - ADRs and design decisions

## Features

### Core Capabilities
- **Real-time Face Detection** - MediaPipe and custom models
- **Eye Tracking Integration** - Pupil Labs Neon, Tobii 5 support
- **Speech Analysis** - Real-time transcription and analysis
- **Emotion Detection** - ONNX-based emotion recognition
- **Multi-modal Data Fusion** - Synchronized processing streams

### Distribution & Streaming
- **Multi-protocol Support** - WebSocket, UDP, MQTT, SSE
- **Real-time Streaming** - Low-latency WebRTC integration
- **Cross-platform** - Browser and Node.js compatibility
- **Scalable Architecture** - Microservice-ready design

### Cognitive Analysis
- **Performance Monitoring** - Real-time performance metrics
- **Situational Awareness** - Multi-modal context analysis
- **Advisory Generation** - AI-powered recommendations
- **Predictive Analytics** - Trend analysis and forecasting

## Project Structure

```
synopticon-api/
├── src/                    # Source code
│   ├── core/              # Core system components
│   ├── features/          # Feature-specific modules
│   └── integrations/      # External integrations
├── docs/                  # Documentation
├── examples/              # Example implementations
├── tests/                 # Test suites
└── config/               # Configuration files
```

## Quick Start

1. **Install Dependencies**
   ```bash
   bun install
   ```

2. **Start Development Server**
   ```bash
   bun run dev
   ```

3. **Run Tests**
   ```bash
   bun test
   ```

For detailed setup instructions, see the [Deployment Guide](guides/DEPLOYMENT.md).

## Support & Contributing

- **Issues**: Report bugs and feature requests on GitHub
- **Contributing**: See our contribution guidelines
- **Documentation**: Help improve our docs

## License

This project is licensed under the terms specified in the [LICENSE](../LICENSE) file.