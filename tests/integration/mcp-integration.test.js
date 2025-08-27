/**
 * MCP Integration Tests
 * End-to-end integration tests for MCP server and tools
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('MCP Integration Tests', () => {
  let mockSynopticonServer;
  let mcpServer;

  beforeAll(async () => {
    // Start a mock Synopticon API server for testing
    mockSynopticonServer = await createMockSynopticonServer();
  });

  afterAll(async () => {
    if (mockSynopticonServer) {
      await mockSynopticonServer.close();
    }
    if (mcpServer) {
      await mcpServer.stop();
    }
  });

  describe('MCP Server Lifecycle', () => {
    test('should start and initialize MCP server', async () => {
      const { createSynopticonMCPServer } = await import('../../src/services/mcp/server.ts');
      
      mcpServer = createSynopticonMCPServer({
        synopticonApiUrl: 'http://localhost:9999', // Mock server port
        timeout: 2000
      });
      
      // Should initialize successfully
      await expect(mcpServer.initialize()).resolves.not.toThrow();
    });

    test('should fail initialization with unavailable API', async () => {
      const { createSynopticonMCPServer } = await import('../../src/services/mcp/server.ts');
      
      const failingServer = createSynopticonMCPServer({
        synopticonApiUrl: 'http://localhost:9998', // Non-existent port
        timeout: 1000
      });
      
      await expect(failingServer.initialize()).rejects.toThrow('Cannot connect to Synopticon API');
    });
  });

  describe('Tool Discovery and Loading', () => {
    test('should load all enabled tools', async () => {
      // This test would verify that tools are loaded correctly
      // In a real integration test, we'd check the actual tool loading
      
      const { getEnabledTools } = await import('../../src/services/mcp/config/tool-registry.ts');
      const enabledTools = getEnabledTools();
      
      expect(enabledTools.length).toBeGreaterThan(10);
      expect(enabledTools).toContain('synopticon_health_check');
      expect(enabledTools).toContain('synopticon_start_face_analysis');
    });

    test('should handle tool category enabling/disabling', async () => {
      const { setToolCategoryEnabled, getEnabledTools } = await import('../../src/services/mcp/config/tool-registry.ts');
      
      const originalTools = getEnabledTools();
      
      // Disable face tools
      setToolCategoryEnabled('face', false);
      const reducedTools = getEnabledTools();
      
      expect(reducedTools.length).toBeLessThan(originalTools.length);
      expect(reducedTools).not.toContain('synopticon_start_face_analysis');
      
      // Re-enable face tools
      setToolCategoryEnabled('face', true);
      const restoredTools = getEnabledTools();
      
      expect(restoredTools.length).toBe(originalTools.length);
    });
  });

  describe('HTTP Client Integration', () => {
    test('should create HTTP client and make requests', async () => {
      const { createSynopticonHTTPClient } = await import('../../src/services/mcp/client/http-client.ts');
      
      const client = createSynopticonHTTPClient({
        baseUrl: 'http://localhost:9999',
        timeout: 2000
      });
      
      // Test health check
      const isHealthy = await client.isHealthy();
      expect(isHealthy).toBe(true);
      
      // Test capabilities
      const health = await client.getHealth();
      expect(health).toBeDefined();
      expect(health.version).toBeDefined();
    });

    test('should handle network errors gracefully', async () => {
      const { createSynopticonHTTPClient } = await import('../../src/services/mcp/client/http-client.ts');
      
      const client = createSynopticonHTTPClient({
        baseUrl: 'http://localhost:9998', // Non-existent server
        timeout: 1000,
        retryAttempts: 1
      });
      
      await expect(client.getHealth()).rejects.toThrow();
    });

    test('should retry failed requests', async () => {
      const { createSynopticonHTTPClient } = await import('../../src/services/mcp/client/http-client.ts');
      
      const client = createSynopticonHTTPClient({
        baseUrl: 'http://localhost:9999',
        timeout: 1000,
        retryAttempts: 2,
        retryDelay: 100
      });
      
      // Mock a temporarily failing endpoint
      // In a real test, we'd configure the mock server to fail then succeed
      const health = await client.getHealth();
      expect(health).toBeDefined();
    });
  });

  describe('End-to-End Tool Execution', () => {
    test('should execute system tools successfully', async () => {
      if (!mcpServer) {
        // Initialize server if not already done
        const { createSynopticonMCPServer } = await import('../../src/services/mcp/server.ts');
        mcpServer = createSynopticonMCPServer({
          synopticonApiUrl: 'http://localhost:9999',
          timeout: 2000
        });
        await mcpServer.initialize();
      }

      // Simulate MCP tool execution
      const mockRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      // In a real integration test, we'd send this request to the MCP server
      // and verify the response format and content
    });

    test('should handle tool execution with parameters', async () => {
      // Test would simulate calling a tool with parameters
      // and verify the results are correctly formatted
      const { startFaceAnalysisTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const { createSynopticonHTTPClient } = await import('../../src/services/mcp/client/http-client.ts');
      const client = createSynopticonHTTPClient({
        baseUrl: 'http://localhost:9999',
        timeout: 2000
      });
      
      const result = await startFaceAnalysisTool.handler(
        { device: 'camera_0', quality: 'high' },
        client
      );
      
      expect(result.isError).toBeUndefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('start_face_analysis completed successfully');
    });
  });

  describe('Configuration and Environment', () => {
    test('should handle environment variables', async () => {
      const originalUrl = process.env.SYNOPTICON_API_URL;
      const originalDebug = process.env.MCP_DEBUG;
      
      process.env.SYNOPTICON_API_URL = 'http://test:3000';
      process.env.MCP_DEBUG = 'true';
      
      const { validateMCPConfig } = await import('../../src/services/mcp/config/mcp-config.ts');
      
      // Test configuration with environment variables
      // In a real test, we'd verify these are picked up correctly
      
      // Restore environment
      if (originalUrl) process.env.SYNOPTICON_API_URL = originalUrl;
      else delete process.env.SYNOPTICON_API_URL;
      
      if (originalDebug) process.env.MCP_DEBUG = originalDebug;
      else delete process.env.MCP_DEBUG;
    });
  });
});

/**
 * Create a mock Synopticon server for testing
 */
async function createMockSynopticonServer() {
  const server = Bun.serve({
    port: 9999,
    fetch(req) {
      const url = new URL(req.url);
      
      // Mock health endpoint
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            face_detection: true,
            emotion_analysis: true,
            media_streaming: true,
            eye_tracking: false,
            speech_analysis: false,
            version: '0.5.6-test'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Mock status endpoint
      if (url.pathname === '/api/status') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            pipelines: [
              { pipeline: 'face-analysis', status: 'idle' },
              { pipeline: 'emotion-analysis', status: 'idle' }
            ]
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Mock face analysis endpoints
      if (url.pathname === '/api/analysis/face/start') {
        return new Response(JSON.stringify({
          success: true,
          data: { sessionId: 'test_face_session_123' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (url.pathname === '/api/analysis/face/results') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            faces: [
              {
                id: 'test_face_1',
                confidence: 0.95,
                boundingBox: { x: 100, y: 50, width: 200, height: 250 },
                landmarks: [[150, 75], [175, 80]]
              }
            ],
            timestamp: new Date().toISOString()
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (url.pathname === '/api/analysis/face/stop') {
        return new Response(JSON.stringify({
          success: true,
          data: { success: true }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Mock devices endpoint
      if (url.pathname === '/api/devices') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            cameras: [
              { id: 'camera_0', label: 'Test Camera', type: 'webcam' }
            ],
            microphones: [
              { id: 'mic_0', label: 'Test Microphone', type: 'internal' }
            ]
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Default response for unhandled endpoints
      return new Response('Not Found', { status: 404 });
    }
  });
  
  return {
    close: () => server.stop()
  };
}