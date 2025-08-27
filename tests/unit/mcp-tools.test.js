/**
 * MCP Tools Unit Tests
 * Tests for individual MCP tools and their functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('MCP Tools', () => {
  // Mock HTTP client for testing
  const createMockClient = (responses = {}) => ({
    isHealthy: async () => responses.isHealthy ?? true,
    getHealth: async () => responses.getHealth ?? {
      face_detection: true,
      emotion_analysis: true,
      media_streaming: true,
      version: '0.5.6'
    },
    getStatus: async () => responses.getStatus ?? {
      pipelines: [{ pipeline: 'test', status: 'idle' }]
    },
    startFaceAnalysis: async (params) => responses.startFaceAnalysis ?? {
      sessionId: 'test_session_123'
    },
    getFaceResults: async () => responses.getFaceResults ?? {
      faces: [
        {
          id: 'face_1',
          confidence: 0.95,
          boundingBox: { x: 100, y: 50, width: 200, height: 250 },
          landmarks: [[150, 75], [175, 80]]
        }
      ],
      timestamp: '2025-08-27T10:30:00.000Z'
    },
    stopFaceAnalysis: async () => responses.stopFaceAnalysis ?? { success: true },
    startEmotionAnalysis: async (params) => responses.startEmotionAnalysis ?? {
      sessionId: 'emotion_session_123'
    },
    getEmotionResults: async () => responses.getEmotionResults ?? {
      emotions: [
        { emotion: 'happiness', confidence: 0.87, valence: 0.65, arousal: 0.42 }
      ],
      timestamp: '2025-08-27T10:30:00.000Z'
    },
    stopEmotionAnalysis: async () => responses.stopEmotionAnalysis ?? { success: true },
    startMediaStream: async (params) => responses.startMediaStream ?? {
      streamId: 'stream_123',
      endpoints: ['ws://localhost:3000/stream/video']
    },
    getStreamStatus: async () => responses.getStreamStatus ?? {
      active: true,
      streams: [{ id: 'stream_1', type: 'video', status: 'running', device: 'camera_0' }]
    },
    stopMediaStream: async () => responses.stopMediaStream ?? { success: true },
    listDevices: async () => responses.listDevices ?? {
      cameras: [{ id: 'camera_0', label: 'Built-in Camera', type: 'webcam' }],
      microphones: [{ id: 'mic_0', label: 'Built-in Mic', type: 'internal' }]
    }
  });

  describe('Base Tool Functionality', () => {
    test('should create success result', async () => {
      const { createSuccessResult } = await import('../../src/services/mcp/tools/base-tool.ts');
      
      const result = createSuccessResult('Operation completed', { data: 'test' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Operation completed');
      expect(result.content[0].text).toContain('"data": "test"');
      expect(result.isError).toBeUndefined();
    });

    test('should create error result', async () => {
      const { createErrorResult } = await import('../../src/services/mcp/tools/base-tool.ts');
      
      const result = createErrorResult('Operation failed', { code: 'TEST_ERROR' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error: Operation failed');
      expect(result.content[0].text).toContain('"code": "TEST_ERROR"');
      expect(result.isError).toBe(true);
    });

    test('should create MCP tool with validation', async () => {
      const { createMCPTool } = await import('../../src/services/mcp/tools/base-tool.ts');
      
      const tool = createMCPTool(
        {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: { param1: { type: 'string' } }
          }
        },
        { param1: { type: 'string', required: true } },
        async (params, client) => ({ result: 'success', params })
      );
      
      expect(tool.definition.name).toBe('test_tool');
      expect(typeof tool.handler).toBe('function');
      
      // Test successful execution
      const mockClient = createMockClient();
      const result = await tool.handler({ param1: 'value' }, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('test_tool completed successfully');
    });

    test('should validate parameters in MCP tool', async () => {
      const { createMCPTool } = await import('../../src/services/mcp/tools/base-tool.ts');
      
      const tool = createMCPTool(
        {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} }
        },
        { required_param: { type: 'string', required: true } },
        async (params) => ({ result: 'success' })
      );
      
      const mockClient = createMockClient();
      const result = await tool.handler({}, mockClient);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Parameter validation failed');
    });
  });

  describe('System Tools', () => {
    test('health check tool should work correctly', async () => {
      const { healthCheckTool } = await import('../../src/services/mcp/tools/system-tools.ts');
      
      const mockClient = createMockClient();
      const result = await healthCheckTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('health_check completed successfully');
      expect(result.content[0].text).toContain('"status": "healthy"');
    });

    test('health check tool should handle API unavailable', async () => {
      const { healthCheckTool } = await import('../../src/services/mcp/tools/system-tools.ts');
      
      const mockClient = createMockClient({ isHealthy: false });
      const result = await healthCheckTool.handler({}, mockClient);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Synopticon API is not responding');
    });

    test('get status tool should return system information', async () => {
      const { getStatusTool } = await import('../../src/services/mcp/tools/system-tools.ts');
      
      const mockClient = createMockClient();
      const result = await getStatusTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('get_status completed successfully');
      expect(result.content[0].text).toContain('"faceDetection": true');
    });

    test('get capabilities tool should return capability information', async () => {
      const { getCapabilitiesTool } = await import('../../src/services/mcp/tools/system-tools.ts');
      
      const mockClient = createMockClient();
      const result = await getCapabilitiesTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('get_capabilities completed successfully');
      expect(result.content[0].text).toContain('"face_landmarks"');
    });
  });

  describe('Face Analysis Tools', () => {
    test('start face analysis tool should validate parameters', async () => {
      const { startFaceAnalysisTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      // Test with valid parameters
      const mockClient = createMockClient();
      const result = await startFaceAnalysisTool.handler(
        { device: 'camera_1', quality: 'high' },
        mockClient
      );
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('start_face_analysis completed successfully');
    });

    test('start face analysis tool should use defaults', async () => {
      const { startFaceAnalysisTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient();
      const result = await startFaceAnalysisTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"device": "default"');
      expect(result.content[0].text).toContain('"quality": "medium"');
    });

    test('get face results tool should handle no faces', async () => {
      const { getFaceResultsTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient({
        getFaceResults: async () => ({
          faces: [],
          timestamp: '2025-08-27T10:30:00.000Z'
        })
      });
      
      const result = await getFaceResultsTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No faces detected');
    });

    test('get face results tool should handle detected faces', async () => {
      const { getFaceResultsTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient(); // Uses default mock response
      const result = await getFaceResultsTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Detected 1 face');
      expect(result.content[0].text).toContain('"confidence": 0.95');
    });

    test('stop face analysis tool should work', async () => {
      const { stopFaceAnalysisTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient();
      const result = await stopFaceAnalysisTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('stop_face_analysis completed successfully');
    });

    test('configure face detection should handle parameters', async () => {
      const { configureFaceDetectionTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient();
      const result = await configureFaceDetectionTool.handler(
        { confidence_threshold: 0.8, max_faces: 5 },
        mockClient
      );
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('"confidence_threshold": 0.8');
      expect(result.content[0].text).toContain('"max_faces": 5');
    });

    test('configure face detection should validate threshold range', async () => {
      const { configureFaceDetectionTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient();
      const result = await configureFaceDetectionTool.handler(
        { confidence_threshold: 1.5 }, // Invalid range
        mockClient
      );
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Parameter validation failed');
    });
  });

  describe('Emotion Analysis Tools', () => {
    beforeEach(() => {
      // Set up mock client responses for emotion tools
    });

    test('start emotion analysis should work with defaults', async () => {
      const { startEmotionAnalysisTool } = await import('../../src/services/mcp/tools/emotion-tools.ts');
      
      const mockClient = createMockClient({
        startEmotionAnalysis: async () => ({ sessionId: 'emotion_session_123' })
      });
      
      const result = await startEmotionAnalysisTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('start_emotion_analysis completed successfully');
      expect(result.content[0].text).toContain('supportedEmotions');
    });

    test('get emotion results should handle no emotions', async () => {
      const { getEmotionResultsTool } = await import('../../src/services/mcp/tools/emotion-tools.ts');
      
      const mockClient = createMockClient({
        getEmotionResults: async () => ({
          emotions: [],
          timestamp: '2025-08-27T10:30:00.000Z'
        })
      });
      
      const result = await getEmotionResultsTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No emotions detected');
    });

    test('get emotion results should process detected emotions', async () => {
      const { getEmotionResultsTool } = await import('../../src/services/mcp/tools/emotion-tools.ts');
      
      const mockClient = createMockClient({
        getEmotionResults: async () => ({
          emotions: [
            { emotion: 'happiness', confidence: 0.87, valence: 0.65, arousal: 0.42 },
            { emotion: 'neutral', confidence: 0.13, valence: 0.02, arousal: 0.05 }
          ],
          timestamp: '2025-08-27T10:30:00.000Z'
        })
      });
      
      const result = await getEmotionResultsTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Detected happiness (87% confidence)');
      expect(result.content[0].text).toContain('"dominantEmotion"');
      expect(result.content[0].text).toContain('"emotionalState"');
    });

    test('set emotion thresholds should validate parameters', async () => {
      const { setEmotionThresholdsTool } = await import('../../src/services/mcp/tools/emotion-tools.ts');
      
      const mockClient = createMockClient();
      
      // Test valid parameters
      const validResult = await setEmotionThresholdsTool.handler(
        { confidence_threshold: 0.7, valence_sensitivity: 0.6 },
        mockClient
      );
      
      expect(validResult.isError).toBeUndefined();
      expect(validResult.content[0].text).toContain('"confidence_threshold": 0.7');
      
      // Test invalid parameters
      const invalidResult = await setEmotionThresholdsTool.handler(
        { confidence_threshold: 1.5 },
        mockClient
      );
      
      expect(invalidResult.isError).toBe(true);
    });
  });

  describe('Media Tools', () => {
    test('list devices should return device information', async () => {
      const { listDevicesTool } = await import('../../src/services/mcp/tools/media-tools.ts');
      
      const mockClient = createMockClient();
      const result = await listDevicesTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('list_devices completed successfully');
      expect(result.content[0].text).toContain('camera_0');
      expect(result.content[0].text).toContain('mic_0');
      expect(result.content[0].text).toContain('"deviceSummary"');
    });

    test('list devices should handle no devices', async () => {
      const { listDevicesTool } = await import('../../src/services/mcp/tools/media-tools.ts');
      
      const mockClient = createMockClient({
        listDevices: async () => ({
          cameras: [],
          microphones: []
        })
      });
      
      const result = await listDevicesTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No media devices available');
    });

    test('start media stream should validate parameters', async () => {
      const { startMediaStreamTool } = await import('../../src/services/mcp/tools/media-tools.ts');
      
      const mockClient = createMockClient({
        startMediaStream: async (params) => ({
          streamId: 'stream_123',
          endpoints: ['ws://localhost:3000/stream/video']
        })
      });
      
      const result = await startMediaStreamTool.handler(
        { devices: ['camera_0'], quality: 'high' },
        mockClient
      );
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('stream_123');
      expect(result.content[0].text).toContain('accessInfo');
    });

    test('get stream status should handle inactive streams', async () => {
      const { getStreamStatusTool } = await import('../../src/services/mcp/tools/media-tools.ts');
      
      const mockClient = createMockClient({
        getStreamStatus: async () => ({
          active: false,
          streams: []
        })
      });
      
      const result = await getStreamStatusTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No media streams are currently active');
    });

    test('get stream status should handle active streams', async () => {
      const { getStreamStatusTool } = await import('../../src/services/mcp/tools/media-tools.ts');
      
      const mockClient = createMockClient({
        getStreamStatus: async () => ({
          active: true,
          streams: [
            { id: 'video_1', type: 'video', status: 'running', device: 'camera_0' },
            { id: 'audio_1', type: 'audio', status: 'running', device: 'mic_0' }
          ]
        })
      });
      
      const result = await getStreamStatusTool.handler({}, mockClient);
      
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('2 streams active');
      expect(result.content[0].text).toContain('"streamsByType"');
    });
  });

  describe('Tool Error Handling', () => {
    test('should handle API client errors gracefully', async () => {
      const { healthCheckTool } = await import('../../src/services/mcp/tools/system-tools.ts');
      
      const failingClient = {
        isHealthy: async () => {
          throw new Error('Network connection failed');
        }
      };
      
      const result = await healthCheckTool.handler({}, failingClient);
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network connection failed');
    });

    test('should handle validation errors in tools', async () => {
      const { startFaceAnalysisTool } = await import('../../src/services/mcp/tools/face-tools.ts');
      
      const mockClient = createMockClient();
      const result = await startFaceAnalysisTool.handler(
        { quality: 'invalid_quality' },
        mockClient
      );
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Parameter validation failed');
    });
  });
});