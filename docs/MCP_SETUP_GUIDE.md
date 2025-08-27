# Synopticon MCP Setup Guide

## Overview

The Synopticon MCP (Model Context Protocol) server enables LLM clients like Claude Desktop to directly control and query Synopticon's behavioral analysis capabilities. This guide walks you through setting up the MCP connection for different deployment scenarios.

## Quick Start (5 minutes)

For the fastest setup with Claude Desktop on the same computer as Synopticon:

1. **Start Synopticon**:
   ```bash
   cd synopticon-api
   bun start
   ```

2. **Run the setup wizard**:
   ```bash
   bun setup-mcp
   ```

3. **Follow the wizard prompts** - it will automatically:
   - Detect your Synopticon installation
   - Test the connection
   - Generate the correct configuration
   - Install it to the right location

4. **Restart Claude Desktop** and look for "Synopticon" in available tools

5. **Test the connection**:
   Try asking Claude: "Check Synopticon system health"

## Deployment Scenarios

### Scenario 1: Same Computer (Recommended)

Both Synopticon and Claude Desktop run on the same computer.

**Requirements**:
- Synopticon API running on `http://localhost:3000`
- Claude Desktop installed
- Bun runtime available

**Setup**:
1. Use the setup wizard: `bun setup-mcp`
2. Select "Claude Desktop" as your client
3. The wizard detects localhost automatically

**Configuration** (auto-generated):
```json
{
  "mcpServers": {
    "synopticon": {
      "command": "bun",
      "args": ["src/services/mcp/server.ts"],
      "env": {
        "SYNOPTICON_API_URL": "http://localhost:3000",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### Scenario 2: Different Computers

Synopticon runs on a server, Claude Desktop on your local computer.

**Requirements**:
- Synopticon API accessible over network
- Network connectivity between computers
- Synopticon MCP server can be run locally or remotely

**Setup Option A: Local MCP Server**
1. Install Synopticon package on your local computer
2. Run setup wizard: `bun setup-mcp`
3. Select "Another computer on network"
4. Enter the server's IP address (e.g., 192.168.1.100)

**Setup Option B: Remote MCP Server**
1. SSH to the Synopticon server
2. Run the MCP server: `bun src/services/mcp/server.ts`
3. Configure Claude Desktop to connect remotely

### Scenario 3: Docker Container

Synopticon runs in a Docker container.

**Requirements**:
- Docker container with port 3000 exposed
- Synopticon MCP server in same container or locally

**Setup**:
1. Ensure Docker container exposes port 3000:
   ```bash
   docker run -p 3000:3000 synopticon/api:latest
   ```

2. Run setup wizard: `bun setup-mcp`
3. Select "Docker container"
4. Wizard uses `http://localhost:3000` automatically

## Supported LLM Clients

### Claude Desktop

**Status**: ✅ Fully Supported  
**Transport**: stdio  
**Config Location**: `~/.config/claude/claude_desktop_config.json`

**Manual Configuration**:
```json
{
  "mcpServers": {
    "synopticon": {
      "command": "bun",
      "args": ["src/services/mcp/server.ts"],
      "env": {
        "SYNOPTICON_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Cursor

**Status**: ✅ Supported  
**Transport**: stdio  
**Config Location**: `~/.cursor/mcp_config.json`

**Manual Configuration**:
```json
{
  "mcp": {
    "servers": {
      "synopticon": {
        "command": "bun",
        "args": ["src/services/mcp/server.ts"],
        "env": {
          "SYNOPTICON_API_URL": "http://localhost:3000"
        }
      }
    }
  }
}
```

### Continue

**Status**: ✅ Supported  
**Transport**: stdio  
**Config Location**: `~/.continue/config.json`

**Manual Configuration**:
```json
{
  "mcp": {
    "servers": [
      {
        "name": "synopticon",
        "command": "bun",
        "args": ["src/services/mcp/server.ts"],
        "env": {
          "SYNOPTICON_API_URL": "http://localhost:3000"
        }
      }
    ]
  }
}
```

## Available MCP Tools

Once connected, you'll have access to these Synopticon tools:

### System Tools
- `synopticon_health_check` - Verify API connectivity and system health
- `synopticon_get_status` - Get detailed system status and active pipelines
- `synopticon_get_capabilities` - List all available analysis capabilities

### Face Analysis Tools
- `synopticon_start_face_analysis` - Start real-time face detection
- `synopticon_get_face_results` - Get current face detection results
- `synopticon_stop_face_analysis` - Stop face analysis
- `synopticon_configure_face_detection` - Configure detection parameters

### Emotion Analysis Tools
- `synopticon_start_emotion_analysis` - Start emotion detection
- `synopticon_get_emotion_results` - Get current emotion analysis results
- `synopticon_stop_emotion_analysis` - Stop emotion analysis
- `synopticon_set_emotion_thresholds` - Configure emotion detection settings

### Media Streaming Tools
- `synopticon_start_media_stream` - Start media capture and streaming
- `synopticon_get_stream_status` - Get streaming status
- `synopticon_stop_media_stream` - Stop media streaming
- `synopticon_list_devices` - List available cameras and microphones

## Example Usage

Once set up, you can interact with Synopticon through natural language:

**System Status**:
- "Check if Synopticon is running"
- "What capabilities are available?"
- "Show me the system status"

**Face Analysis**:
- "Start face detection on my webcam"
- "How many faces are currently detected?"
- "Stop face analysis"

**Emotion Analysis**:
- "Start emotion analysis"
- "What emotions are currently detected?"
- "Set emotion detection threshold to 0.8"

**Media Streaming**:
- "List available cameras"
- "Start streaming from camera 0 with high quality"
- "What's the status of media streams?"

## Configuration Options

### Environment Variables

You can customize MCP server behavior with environment variables:

```bash
export SYNOPTICON_API_URL="http://localhost:3000"  # Synopticon API URL
export MCP_TRANSPORT="stdio"                       # Transport method
export MCP_DEBUG="true"                           # Enable debug logging
export MCP_TIMEOUT="5000"                         # Request timeout (ms)
export MCP_LOG_LEVEL="INFO"                       # Log level (ERROR, WARN, INFO, DEBUG)
```

### Advanced Configuration

**Custom API Client Settings**:
```json
{
  "mcpServers": {
    "synopticon": {
      "command": "bun",
      "args": ["src/services/mcp/server.ts"],
      "env": {
        "SYNOPTICON_API_URL": "http://localhost:3000",
        "MCP_TIMEOUT": "10000",
        "MCP_DEBUG": "true",
        "MCP_LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

## Troubleshooting

### Connection Issues

**Problem**: "Connection refused" or "Synopticon API unavailable"
**Solutions**:
1. Check Synopticon is running: `curl http://localhost:3000/api/health`
2. Verify the API URL in configuration
3. Check firewall settings
4. For remote connections, ensure port 3000 is accessible

**Problem**: "Tools not appearing in LLM client"
**Solutions**:
1. Restart your LLM client after adding the configuration
2. Check MCP server logs: Set `MCP_DEBUG=true` in configuration
3. Verify configuration syntax is valid JSON
4. Check the configuration file location is correct

### Performance Issues

**Problem**: Slow response times
**Solutions**:
1. Increase timeout: Set `MCP_TIMEOUT=10000` (10 seconds)
2. Check network latency to Synopticon server
3. Reduce log level: Set `MCP_LOG_LEVEL=ERROR`

**Problem**: Memory usage
**Solutions**:
1. Restart MCP server periodically for long-running sessions
2. Monitor system resources
3. Close unused analysis sessions

### Debug Mode

Enable debug logging to troubleshoot issues:

1. Set `MCP_DEBUG=true` in your configuration
2. Set `MCP_LOG_LEVEL=DEBUG`
3. Restart your LLM client
4. Check the MCP server logs for detailed information

### Common Error Messages

**"Tool execution failed"**:
- Synopticon API endpoint returned an error
- Check Synopticon server logs
- Verify the specific tool parameters

**"Parameter validation failed"**:
- Invalid parameters passed to MCP tool
- Check tool documentation for correct parameter format
- Use `synopticon_get_capabilities` to see available options

**"Timeout error"**:
- Request took longer than configured timeout
- Increase `MCP_TIMEOUT` value
- Check network connectivity and server performance

## Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review the [MCP API Reference](MCP_API_REFERENCE.md)
3. Enable debug logging for detailed error information
4. Check Synopticon server logs for API-level issues

## Next Steps

After successful setup:

1. Explore available tools with natural language queries
2. Try different analysis workflows
3. Experiment with multi-modal analysis (face + emotion + media)
4. Check the [MCP Development Guide](MCP_DEVELOPMENT_GUIDE.md) if you want to add custom tools