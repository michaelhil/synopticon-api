/**
 * MCP Server Unit Tests
 * Tests for the core MCP server functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('MCP Server Core', () => {
  describe('Configuration Validation', () => {
    test('should validate default configuration', async () => {
      const { validateMCPConfig } = await import('../../src/services/mcp/config/mcp-config.ts');
      
      const config = validateMCPConfig({});
      
      expect(config.synopticonApiUrl).toBe('http://localhost:3000');
      expect(config.transport).toBe('stdio');
      expect(config.timeout).toBe(5000);
    });

    test('should validate custom configuration', async () => {
      const { validateMCPConfig } = await import('../../src/services/mcp/config/mcp-config.ts');
      
      const config = validateMCPConfig({
        synopticonApiUrl: 'http://example.com:8080',
        transport: 'sse',
        timeout: 10000,
        port: 3002
      });
      
      expect(config.synopticonApiUrl).toBe('http://example.com:8080');
      expect(config.transport).toBe('sse');
      expect(config.timeout).toBe(10000);
      expect(config.port).toBe(3002);
    });

    test('should reject invalid transport', async () => {
      const { validateMCPConfig } = await import('../../src/services/mcp/config/mcp-config.ts');
      
      expect(() => {
        validateMCPConfig({ transport: 'invalid' });
      }).toThrow('transport must be "stdio" or "sse"');
    });

    test('should require API URL', async () => {
      const { validateMCPConfig } = await import('../../src/services/mcp/config/mcp-config.ts');
      
      expect(() => {
        validateMCPConfig({ synopticonApiUrl: '' });
      }).toThrow('synopticonApiUrl is required');
    });
  });

  describe('Tool Registry', () => {
    test('should return enabled categories', async () => {
      const { getEnabledCategories } = await import('../../src/services/mcp/config/tool-registry.ts');
      
      const enabled = getEnabledCategories();
      
      expect(enabled.system).toBeDefined();
      expect(enabled.system.enabled).toBe(true);
      expect(enabled.face).toBeDefined();
      expect(enabled.face.enabled).toBe(true);
    });

    test('should return enabled tools', async () => {
      const { getEnabledTools } = await import('../../src/services/mcp/config/tool-registry.ts');
      
      const tools = getEnabledTools();
      
      expect(tools).toContain('synopticon_health_check');
      expect(tools).toContain('synopticon_start_face_analysis');
      expect(tools.length).toBeGreaterThan(10);
    });

    test('should check tool enabled status', async () => {
      const { isToolEnabled } = await import('../../src/services/mcp/config/tool-registry.ts');
      
      expect(isToolEnabled('synopticon_health_check')).toBe(true);
      expect(isToolEnabled('nonexistent_tool')).toBe(false);
    });

    test('should enable/disable categories', async () => {
      const { setToolCategoryEnabled, getEnabledCategories } = await import('../../src/services/mcp/config/tool-registry.ts');
      
      // Disable eye tracking (should be disabled by default)
      setToolCategoryEnabled('eye_tracking', false);
      
      const enabled = getEnabledCategories();
      expect(enabled.eye_tracking).toBeUndefined();
      
      // Enable eye tracking
      setToolCategoryEnabled('eye_tracking', true);
      
      const enabledAfter = getEnabledCategories();
      expect(enabledAfter.eye_tracking).toBeDefined();
      expect(enabledAfter.eye_tracking.enabled).toBe(true);
    });
  });

  describe('MCP Server Creation', () => {
    test('should create server with default config', async () => {
      const { createSynopticonMCPServer } = await import('../../src/services/mcp/server.ts');
      
      const server = createSynopticonMCPServer();
      
      expect(server).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.initialize).toBe('function');
    });

    test('should create server with custom config', async () => {
      const { createSynopticonMCPServer } = await import('../../src/services/mcp/server.ts');
      
      const server = createSynopticonMCPServer({
        synopticonApiUrl: 'http://test:3000',
        timeout: 8000
      });
      
      expect(server).toBeDefined();
    });
  });
});

describe('Error Handling', () => {
  test('should create MCP errors correctly', async () => {
    const { MCPError, MCPErrorCode } = await import('../../src/services/mcp/utils/error-handler.ts');
    
    const error = new MCPError(
      MCPErrorCode.INVALID_TOOL_CALL,
      'Test error message',
      { context: 'test' }
    );
    
    expect(error.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    expect(error.message).toBe('Test error message');
    expect(error.context).toEqual({ context: 'test' });
  });

  test('should create error responses', async () => {
    const { MCPError, MCPErrorCode, createErrorResponse } = await import('../../src/services/mcp/utils/error-handler.ts');
    
    const error = new MCPError(
      MCPErrorCode.NETWORK_ERROR,
      'Network failed'
    );
    
    const response = createErrorResponse(error);
    
    expect(response.error.code).toBe(MCPErrorCode.NETWORK_ERROR);
    expect(response.error.message).toBe('Network failed');
  });

  test('should validate required parameters', async () => {
    const { validateRequired } = await import('../../src/services/mcp/utils/error-handler.ts');
    
    // Should not throw for valid parameters
    expect(() => {
      validateRequired({ param1: 'value1', param2: 'value2' }, ['param1']);
    }).not.toThrow();
    
    // Should throw for missing required parameters
    expect(() => {
      validateRequired({ param2: 'value2' }, ['param1']);
    }).toThrow('Missing required parameters: param1');
  });
});

describe('Logging', () => {
  test('should create logger with component name', async () => {
    const { createLogger, LogLevel } = await import('../../src/services/mcp/utils/logger.ts');
    
    const logger = createLogger('TestComponent');
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('should respect log levels', async () => {
    const { createLogger, LogLevel } = await import('../../src/services/mcp/utils/logger.ts');
    
    const logger = createLogger('TestComponent', LogLevel.ERROR);
    
    // Should not throw - we can't easily test console output
    logger.error('Error message');
    logger.warn('Warning message'); // Should be filtered out
    logger.info('Info message'); // Should be filtered out
  });

  test('should get log level from environment', async () => {
    const { getLogLevelFromEnv, LogLevel } = await import('../../src/services/mcp/utils/logger.ts');
    
    const originalLevel = process.env.MCP_LOG_LEVEL;
    
    process.env.MCP_LOG_LEVEL = 'DEBUG';
    expect(getLogLevelFromEnv()).toBe(LogLevel.DEBUG);
    
    process.env.MCP_LOG_LEVEL = 'ERROR';
    expect(getLogLevelFromEnv()).toBe(LogLevel.ERROR);
    
    delete process.env.MCP_LOG_LEVEL;
    expect(getLogLevelFromEnv()).toBe(LogLevel.INFO);
    
    // Restore original value
    if (originalLevel !== undefined) {
      process.env.MCP_LOG_LEVEL = originalLevel;
    }
  });
});

describe('Parameter Validation', () => {
  test('should validate parameters successfully', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0, max: 150 }
    };
    
    const result = validateParameters(
      { name: 'John', age: 30 },
      schema
    );
    
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.sanitized).toEqual({ name: 'John', age: 30 });
  });

  test('should validate required fields', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      name: { type: 'string', required: true }
    };
    
    const result = validateParameters({}, schema);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required parameter: name');
  });

  test('should validate types', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      name: { type: 'string' },
      age: { type: 'number' }
    };
    
    const result = validateParameters(
      { name: 123, age: 'not a number' },
      schema
    );
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("'name' must be of type string"))).toBe(true);
    expect(result.errors.some(e => e.includes("'age' must be of type number"))).toBe(true);
  });

  test('should validate enums', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      quality: { type: 'string', enum: ['low', 'medium', 'high'] }
    };
    
    const validResult = validateParameters({ quality: 'medium' }, schema);
    expect(validResult.valid).toBe(true);
    
    const invalidResult = validateParameters({ quality: 'invalid' }, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.some(e => e.includes('must be one of: low, medium, high'))).toBe(true);
  });

  test('should validate number ranges', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      threshold: { type: 'number', min: 0, max: 1 }
    };
    
    const validResult = validateParameters({ threshold: 0.5 }, schema);
    expect(validResult.valid).toBe(true);
    
    const tooLowResult = validateParameters({ threshold: -0.1 }, schema);
    expect(tooLowResult.valid).toBe(false);
    
    const tooHighResult = validateParameters({ threshold: 1.1 }, schema);
    expect(tooHighResult.valid).toBe(false);
  });

  test('should validate string patterns', async () => {
    const { validateParameters } = await import('../../src/services/mcp/utils/validation.ts');
    
    const schema = {
      device: { type: 'string', pattern: /^[a-zA-Z0-9_-]+$/ }
    };
    
    const validResult = validateParameters({ device: 'camera_0' }, schema);
    expect(validResult.valid).toBe(true);
    
    const invalidResult = validateParameters({ device: 'invalid device!' }, schema);
    expect(invalidResult.valid).toBe(false);
  });
});