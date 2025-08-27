# Synopticon MCP Development Guide

## Overview

This guide explains how to extend the Synopticon MCP server with new tools, customize existing functionality, and contribute to the MCP integration.

## Architecture Overview

The MCP server follows a modular architecture:

```
src/services/mcp/
├── server.ts                 # Main MCP server
├── config/                   # Configuration and registry
│   ├── mcp-config.ts         # Server configuration types
│   └── tool-registry.ts      # Central tool registry
├── client/                   # API client layer
│   └── http-client.ts        # HTTP client for Synopticon API
├── tools/                    # Tool implementations
│   ├── base-tool.ts          # Base tool interface
│   ├── system-tools.ts       # System tools
│   ├── face-tools.ts         # Face analysis tools
│   └── emotion-tools.ts      # Emotion analysis tools
└── utils/                    # Utilities
    ├── logger.ts             # Logging utilities
    ├── error-handler.ts      # Error handling
    └── validation.ts         # Parameter validation
```

## Adding New Tools

### Method 1: Using the Helper Script (Recommended)

The easiest way to add new tools is using the interactive helper script:

```bash
bun scripts/add-mcp-tools.js
```

This script will:
1. Prompt for tool details (name, description, parameters)
2. Generate the tool code automatically
3. Update the tool registry
4. Add the tool to the appropriate category file

### Method 2: Manual Implementation

#### Step 1: Define Tool in Category File

Add your tool to the appropriate category file (e.g., `src/services/mcp/tools/face-tools.ts`):

```typescript
import type { MCPTool } from './base-tool.ts';
import { createBaseToolFactory } from './base-tool.ts';
import { CommonSchemas } from '../utils/validation.ts';

const toolFactory = createBaseToolFactory('Face');

export const myNewTool: MCPTool = toolFactory.createActionTool(
  'my_new_tool',
  'Description of what this tool does',
  {
    // Parameter validation schema
    parameter1: {
      type: 'string',
      required: true
    },
    parameter2: {
      ...CommonSchemas.quality,
      required: false
    }
  },
  {
    // Input schema for MCP
    parameter1: {
      type: 'string',
      description: 'Description of parameter1'
    },
    parameter2: {
      type: 'string',
      description: 'Quality level',
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  async (client, params) => {
    // Tool implementation
    const result = await client.someAPICall(params);
    
    return {
      action: 'my_new_tool_completed',
      result,
      message: 'Tool executed successfully',
      timestamp: new Date().toISOString()
    };
  }
);

// Add to exports array
export const faceTools: MCPTool[] = [
  // ... existing tools
  myNewTool
];
```

#### Step 2: Update Tool Registry

Add your tool to the registry in `src/services/mcp/config/tool-registry.ts`:

```typescript
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  face: {
    name: 'Face Analysis',
    description: 'Face detection, landmark analysis, and recognition tools',
    enabled: true,
    tools: [
      'synopticon_start_face_analysis',
      'synopticon_get_face_results',
      'synopticon_stop_face_analysis',
      'synopticon_configure_face_detection',
      'synopticon_my_new_tool'  // Add your tool here
    ]
  },
  // ... other categories
};
```

#### Step 3: Implement API Client Method (if needed)

If your tool requires a new API endpoint, add the method to `src/services/mcp/client/http-client.ts`:

```typescript
/**
 * My new API method
 */
async myNewAPICall(params: { param1: string; param2?: string }): Promise<MyResult> {
  return withErrorHandling(async () => {
    const response = await this.request<MyResult>(
      '/api/my-new-endpoint',
      'POST',
      params
    );
    return response.data!;
  }, { operation: 'myNewAPICall', params });
}
```

## Creating New Tool Categories

### Step 1: Add Category to Registry

```typescript
// In src/services/mcp/config/tool-registry.ts
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // ... existing categories
  my_category: {
    name: 'My New Category',
    description: 'Description of the new category',
    enabled: true, // or false by default
    tools: [
      'synopticon_my_category_tool1',
      'synopticon_my_category_tool2'
    ]
  }
};
```

### Step 2: Create Tool File

Create `src/services/mcp/tools/my-category-tools.ts`:

```typescript
/**
 * My Category MCP Tools
 * Tools for my new category functionality
 */

import type { MCPTool } from './base-tool.ts';
import { createBaseToolFactory } from './base-tool.ts';

const toolFactory = createBaseToolFactory('MyCategory');

export const myCategoryTool1: MCPTool = toolFactory.createStatusTool(
  'my_category_tool1',
  'Description of tool1',
  async (client) => {
    // Implementation
    return { result: 'success' };
  }
);

export const myCategoryTool2: MCPTool = toolFactory.createActionTool(
  'my_category_tool2',
  'Description of tool2',
  {}, // validation schema
  {}, // input schema
  async (client, params) => {
    // Implementation
    return { result: 'success' };
  }
);

export const myCategoryTools: MCPTool[] = [
  myCategoryTool1,
  myCategoryTool2
];
```

### Step 3: Update Server Loading

Add lazy loading for your category in `src/services/mcp/server.ts`:

```typescript
// At the top with other imports
const loadMyCategoryTools = () => import('./tools/my-category-tools.ts');

// In the loadAllTools method
private async loadAllTools(): Promise<Array<{ definition: MCPTool; handler: Function }>> {
  // ... existing code

  // Load my category tools
  if (TOOL_CATEGORIES.my_category.enabled) {
    if (!this.toolsCache.has('my_category')) {
      const { myCategoryTools } = await loadMyCategoryTools();
      this.toolsCache.set('my_category', myCategoryTools);
    }
    allTools.push(...this.toolsCache.get('my_category'));
  }

  return allTools;
}
```

## Tool Development Best Practices

### 1. Parameter Validation

Always validate parameters using the validation system:

```typescript
import { CommonSchemas } from '../utils/validation.ts';

const validationSchema = {
  device: {
    ...CommonSchemas.deviceId,
    required: false
  },
  threshold: {
    type: 'number',
    min: 0.0,
    max: 1.0,
    required: true
  },
  custom_param: {
    type: 'string',
    enum: ['option1', 'option2', 'option3'],
    required: true,
    custom: (value) => {
      // Custom validation logic
      if (typeof value === 'string' && value.startsWith('invalid_')) {
        return 'Parameter cannot start with "invalid_"';
      }
      return true;
    }
  }
};
```

### 2. Error Handling

Use the standardized error handling:

```typescript
import { withErrorHandling, MCPError, MCPErrorCode } from '../utils/error-handler.ts';

export const myTool: MCPTool = toolFactory.createActionTool(
  'my_tool',
  'Description',
  validationSchema,
  inputSchema,
  async (client, params) => {
    return withErrorHandling(async () => {
      // Your logic here
      if (someCondition) {
        throw new MCPError(
          MCPErrorCode.INVALID_TOOL_CALL,
          'Specific error message',
          { context: 'additional info' }
        );
      }
      
      return await client.someAPICall(params);
    }, { operation: 'my_tool', params });
  }
);
```

### 3. Logging

Use structured logging:

```typescript
import { createLogger } from '../utils/logger.ts';

const logger = createLogger('MyTool');

// In your tool implementation
logger.info('Starting tool execution', { params });
logger.debug('Intermediate result', { data });
logger.error('Tool failed', error, { context });
```

### 4. Return Value Structure

Follow consistent return value structure:

```typescript
// For action tools
return {
  action: 'tool_name_completed',
  result: actualResult,
  parameters: usedParameters,
  message: 'Human-readable success message',
  timestamp: new Date().toISOString()
};

// For status tools
return {
  status: 'current_status',
  data: statusData,
  message: 'Human-readable status message',
  timestamp: new Date().toISOString()
};
```

## Testing Tools

### Unit Testing

Create tests for your tools in `tests/unit/mcp-tools.test.js`:

```javascript
import { describe, test, expect } from 'bun:test';

describe('My New Tool', () => {
  test('should validate parameters correctly', async () => {
    const { myNewTool } = await import('../src/services/mcp/tools/my-tools.ts');
    
    // Mock client
    const mockClient = {
      someAPICall: async () => ({ success: true })
    };
    
    // Test valid parameters
    const result = await myNewTool.handler(
      { parameter1: 'valid_value' },
      mockClient
    );
    
    expect(result.isError).toBeFalsy();
  });
  
  test('should handle invalid parameters', async () => {
    const { myNewTool } = await import('../src/services/mcp/tools/my-tools.ts');
    
    const mockClient = {};
    
    // Test invalid parameters
    const result = await myNewTool.handler({}, mockClient);
    
    expect(result.isError).toBeTruthy();
  });
});
```

### Integration Testing

Test with actual MCP client:

```bash
# Start Synopticon
bun start

# Start MCP server in debug mode
MCP_DEBUG=true bun src/services/mcp/server.ts

# Test with Claude Desktop or other MCP client
```

## Configuration and Environment

### Environment Variables

Your tools can access environment variables:

```typescript
const customTimeout = parseInt(process.env.MY_TOOL_TIMEOUT || '5000');
const customEndpoint = process.env.MY_TOOL_ENDPOINT || '/api/default';
```

### Configuration Schema

Add configuration options to `src/services/mcp/config/mcp-config.ts`:

```typescript
export interface MCPServerConfig {
  // ... existing config
  myToolConfig?: {
    enabled: boolean;
    customOption: string;
  };
}

export const DEFAULT_MCP_CONFIG: MCPServerConfig = {
  // ... existing defaults
  myToolConfig: {
    enabled: true,
    customOption: 'default_value'
  }
};
```

## Debugging and Development

### Debug Logging

Enable debug logging for development:

```bash
export MCP_DEBUG=true
export MCP_LOG_LEVEL=DEBUG
bun src/services/mcp/server.ts
```

### Testing API Endpoints

Test your API endpoints before implementing tools:

```bash
# Test with curl
curl -X POST http://localhost:3000/api/my-endpoint \
  -H "Content-Type: application/json" \
  -d '{"param1": "value1"}'
```

### MCP Protocol Testing

Test MCP protocol directly:

```bash
# Send MCP request via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun src/services/mcp/server.ts
```

## Performance Considerations

### 1. Lazy Loading

Tools are loaded lazily by category. Keep tool files focused and avoid heavy imports at module level.

### 2. Caching

The server caches loaded tools. Design tools to be stateless for better caching.

### 3. API Client Optimization

Use the built-in HTTP client with retry logic and connection pooling:

```typescript
// Good: Use the provided client
const result = await client.existingMethod(params);

// Avoid: Creating new HTTP clients
const response = await fetch(url); // Don't do this
```

## Contributing

### Code Style

Follow the existing code style:
- Use TypeScript for all new code
- Follow functional programming patterns
- Use factory functions instead of classes
- Keep functions under 50 lines
- Keep files under 500 lines

### Documentation

Update documentation when adding tools:
1. Add tool to API reference
2. Update setup guide if needed
3. Add examples to development guide

### Testing

Ensure all new tools have:
1. Parameter validation tests
2. Success case tests  
3. Error case tests
4. Integration tests

## Future Enhancements

### Auto-Discovery (Planned)

Future versions will support automatic tool discovery:

```typescript
// Future: Auto-generate tools from OpenAPI spec
const tools = await generateToolsFromOpenAPI('/api/openapi.json');
```

### Real-time Streaming (Planned)

Future versions will support real-time data streaming:

```typescript
// Future: Streaming tool results
export const streamingTool: MCPTool = createStreamingTool(
  'streaming_face_results',
  'Stream live face detection results',
  async function* (client, params) {
    while (analysisActive) {
      yield await client.getFaceResults();
      await sleep(100);
    }
  }
);
```

### Plugin Architecture (Planned)

Future versions will support external tool plugins:

```typescript
// Future: Load external tool plugins
const externalTools = await loadToolPlugins('./plugins/');
```