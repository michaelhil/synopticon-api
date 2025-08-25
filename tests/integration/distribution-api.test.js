/**
 * Comprehensive Distribution API Test Suite
 * Tests all phases and integration with existing architecture
 */

import { createEnhancedAPIServer } from '../../src/services/api/enhanced-server.js';

// Use global WebSocket in Bun environment (no import needed)

// Test configuration
const TEST_CONFIG = {
  port: 3999, // Use different port for testing
  distribution: {
    autoStart: false // Don't start distributions automatically in tests
  }
};

describe('Distribution API Integration Tests', () => {
  let server;
  let baseUrl;
  
  beforeAll(async () => {
    server = createEnhancedAPIServer(TEST_CONFIG);
    await server.start();
    baseUrl = `http://localhost:${TEST_CONFIG.port}`;
    console.log(`🧪 Test server started on ${baseUrl}`);
  });
  
  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });
  
  // Helper function to make HTTP requests
  const makeRequest = async (method, path, body = null) => {
    const url = `${baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-key-synopticon-2024'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    return {
      status: response.status,
      data,
      response
    };
  };
  
  describe('Phase 1: Core Distribution API', () => {
    
    test('GET /api/distribution/status - Overall system status', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/status');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('timestamp');
      expect(data.data).toHaveProperty('streams');
      expect(data.data).toHaveProperty('clients');
      expect(data.data).toHaveProperty('data_sources');
      
      // Validate structure
      expect(data.data.streams).toHaveProperty('total');
      expect(data.data.streams).toHaveProperty('active');
      expect(data.data.clients).toHaveProperty('total');
      expect(data.data.data_sources).toHaveProperty('eye_tracking');
    });
    
    test('POST /api/distribution/streams - Create UDP stream', async () => {
      const streamConfig = {
        type: 'udp',
        source: 'eye_tracking',
        destination: {
          host: '127.0.0.1',
          port: 9999
        },
        client_id: 'test-client-udp'
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/streams', streamConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('stream_id');
      expect(data).toHaveProperty('websocket_status_url');
      expect(data.data).toHaveProperty('type', 'udp');
      expect(data.data).toHaveProperty('status', 'active');
      
      // Store stream ID for later tests
      global.testStreamId = data.stream_id;
    });
    
    test('POST /api/distribution/streams - Create MQTT stream', async () => {
      const streamConfig = {
        type: 'mqtt',
        source: 'eye_tracking',
        destination: {
          broker: 'mqtt://localhost:1883',
          topics: {
            gaze: 'test/gaze',
            events: 'test/events'
          }
        },
        client_id: 'test-client-mqtt'
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/streams', streamConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('mqtt');
      
      global.testMqttStreamId = data.stream_id;
    });
    
    test('GET /api/distribution/streams - List all streams', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/streams');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(2); // UDP + MQTT streams
      expect(data).toHaveProperty('count');
    });
    
    test('GET /api/distribution/streams/:id - Get specific stream', async () => {
      const streamId = global.testStreamId;
      const { status, data } = await makeRequest('GET', `/api/distribution/streams/${streamId}`);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id', streamId);
      expect(data.data).toHaveProperty('type');
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('session_status');
    });
    
    test('PUT /api/distribution/streams/:id - Modify stream', async () => {
      const streamId = global.testStreamId;
      const modifications = {
        filter: {
          sample_rate: 60,
          confidence_threshold: 0.8
        }
      };
      
      const { status, data } = await makeRequest('PUT', `/api/distribution/streams/${streamId}`, modifications);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('filter');
      expect(data.data.filter).toHaveProperty('sample_rate', 60);
    });
    
    test('DELETE /api/distribution/streams/:id - Stop stream', async () => {
      const streamId = global.testMqttStreamId;
      const { status, data } = await makeRequest('DELETE', `/api/distribution/streams/${streamId}`);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('stream_id', streamId);
    });
    
  });
  
  describe('Phase 2: Enhanced Features', () => {
    
    test('GET /api/distribution/discovery - Service discovery', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/discovery');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('service', 'synopticon');
      expect(data.data).toHaveProperty('capabilities');
      expect(data.data).toHaveProperty('available_streams');
      expect(data.data).toHaveProperty('available_distributors');
      expect(data.data).toHaveProperty('api_endpoints');
      
      // Validate capabilities array
      expect(Array.isArray(data.data.capabilities)).toBe(true);
      expect(data.data.capabilities).toContain('eye_tracking');
      
      // Validate available distributors
      expect(data.data.available_distributors).toContain('mqtt');
      expect(data.data.available_distributors).toContain('udp');
      expect(data.data.available_distributors).toContain('websocket');
    });
    
    test('POST /api/distribution/clients - Client registration', async () => {
      const clientInfo = {
        name: '3D Visualization App',
        type: 'visualization',
        capabilities: ['real_time_display', 'data_recording'],
        metadata: {
          version: '1.0.0',
          platform: 'test'
        }
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/clients', clientInfo);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('client_id');
      expect(data.data).toHaveProperty('name', clientInfo.name);
      expect(data.data).toHaveProperty('type', clientInfo.type);
      
      global.testClientId = data.client_id;
    });
    
    test('GET /api/distribution/clients - List clients', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/clients');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(1);
    });
    
    test('GET /api/distribution/clients/:id - Get client info', async () => {
      const clientId = global.testClientId;
      const { status, data } = await makeRequest('GET', `/api/distribution/clients/${clientId}`);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id', clientId);
      expect(data.data).toHaveProperty('streams');
      expect(Array.isArray(data.data.streams)).toBe(true);
    });
    
    test('Create stream linked to client', async () => {
      const streamConfig = {
        type: 'websocket',
        source: 'face_analysis',
        destination: {
          port: 8080
        },
        client_id: global.testClientId
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/streams', streamConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('client_id', global.testClientId);
      
      global.testClientStreamId = data.stream_id;
    });
    
  });
  
  describe('Phase 3: Advanced Capabilities', () => {
    
    test('GET /api/distribution/templates - List templates', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/templates');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(3);
      
      // Check for default templates
      const templateNames = data.data.map(t => t.id);
      expect(templateNames).toContain('research_study');
      expect(templateNames).toContain('real_time_viz');
      expect(templateNames).toContain('data_logging');
    });
    
    test('POST /api/distribution/templates/:id/instantiate - Use template', async () => {
      const overrides = {
        destination: {
          host: '127.0.0.1',
          port: 9998
        },
        client_id: global.testClientId
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/templates/real_time_viz/instantiate', overrides);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('template_used', 'real_time_viz');
      expect(data.data).toHaveProperty('client_id', global.testClientId);
      
      global.testTemplateStreamId = data.stream_id;
    });
    
    test('POST /api/distribution/streams/:id/record - Start recording', async () => {
      const streamId = global.testStreamId;
      const recordingConfig = {
        format: 'json',
        file_path: `/tmp/test_recording_${Date.now()}.json`
      };
      
      const { status, data } = await makeRequest('POST', `/api/distribution/streams/${streamId}/record`, recordingConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('recording_id');
      expect(data.data).toHaveProperty('status', 'recording');
      
      global.testRecordingId = data.recording_id;
    });
    
    test('POST /api/distribution/recordings/:id/stop - Stop recording', async () => {
      const recordingId = global.testRecordingId;
      const { status, data } = await makeRequest('POST', `/api/distribution/recordings/${recordingId}/stop`);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('status', 'stopped');
    });
    
    test('POST /api/distribution/streams/:id/share - Share stream', async () => {
      const streamId = global.testStreamId;
      const shareConfig = {
        destination: {
          host: '192.168.1.200',
          port: 9997
        },
        client_id: 'shared-client'
      };
      
      const { status, data } = await makeRequest('POST', `/api/distribution/streams/${streamId}/share`, shareConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('shared_stream_id');
      expect(data).toHaveProperty('original_stream_id', streamId);
    });
    
  });
  
  describe('WebSocket Status Updates', () => {
    
    test('WebSocket connection and status updates', (done) => {
      const wsUrl = `ws://localhost:${TEST_CONFIG.port}/api/distribution/events`;
      const ws = new WebSocket(wsUrl);
      
      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'connected') {
            expect(message).toHaveProperty('timestamp');
            expect(message).toHaveProperty('overall_status');
            
            // Test ping-pong
            ws.send(JSON.stringify({ type: 'ping' }));
          }
          
          if (message.type === 'pong') {
            expect(message).toHaveProperty('timestamp');
            ws.close();
            done();
          }
          
        } catch (error) {
          done(error);
        }
      };
      
      ws.on('message', messageHandler);
      ws.on('error', done);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        ws.close();
        done(new Error('WebSocket test timeout'));
      }, 5000);
    });
    
  });
  
  describe('Core API Compatibility', () => {
    
    test('GET /api/health - Health check includes distribution status', async () => {
      const { status, data } = await makeRequest('GET', '/api/health');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('status', 'healthy');
      expect(data.data).toHaveProperty('distribution');
      expect(data.data.distribution).toHaveProperty('streams');
    });
    
    test('GET /api/config - Config includes distribution endpoints', async () => {
      const { status, data } = await makeRequest('GET', '/api/config');
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('endpoints');
      expect(data.data.endpoints).toHaveProperty('distribution');
      expect(Array.isArray(data.data.endpoints.distribution)).toBe(true);
    });
    
    test('POST /api/detect - Face detection still works', async () => {
      const detectConfig = {
        image: 'base64_mock_data',
        format: 'base64'
      };
      
      const { status, data } = await makeRequest('POST', '/api/detect', detectConfig);
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('faces');
      expect(data.data).toHaveProperty('processing_time');
    });
    
  });
  
  describe('Error Handling', () => {
    
    test('404 for unknown endpoints', async () => {
      const { status, data } = await makeRequest('GET', '/api/nonexistent');
      
      expect(status).toBe(404);
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('available_endpoints');
    });
    
    test('400 for invalid stream configuration', async () => {
      const invalidConfig = {
        type: 'udp'
        // Missing required destination
      };
      
      const { status, data } = await makeRequest('POST', '/api/distribution/streams', invalidConfig);
      
      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('require');
    });
    
    test('404 for nonexistent stream', async () => {
      const { status, data } = await makeRequest('GET', '/api/distribution/streams/nonexistent');
      
      expect(status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
    
  });
  
  describe('Cleanup', () => {
    
    test('Delete remaining test streams', async () => {
      const streamsToClean = [
        global.testStreamId,
        global.testClientStreamId,
        global.testTemplateStreamId
      ].filter(Boolean);
      
      for (const streamId of streamsToClean) {
        const { status, data } = await makeRequest('DELETE', `/api/distribution/streams/${streamId}`);
        expect(status).toBe(200);
        expect(data.success).toBe(true);
      }
    });
    
    test('Unregister test client', async () => {
      if (global.testClientId) {
        const { status, data } = await makeRequest('DELETE', `/api/distribution/clients/${global.testClientId}`);
        expect(status).toBe(200);
        expect(data.success).toBe(true);
      }
    });
    
  });
  
});

/**
 * Performance and Load Tests
 */
describe('Distribution API Performance Tests', () => {
  let server;
  let baseUrl;
  
  beforeAll(async () => {
    server = createEnhancedAPIServer({ port: 3998 });
    await server.start();
    baseUrl = 'http://localhost:3998';
  });
  
  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });
  
  const makeRequest = async (method, path, body = null) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    return await response.json();
  };
  
  test('Create multiple streams simultaneously', async () => {
    const streamConfigs = Array.from({ length: 10 }, (_, i) => ({
      type: 'udp',
      source: 'eye_tracking',
      destination: {
        host: '127.0.0.1',
        port: 10000 + i
      },
      client_id: `perf-test-${i}`
    }));
    
    const startTime = performance.now();
    
    const promises = streamConfigs.map(config => 
      makeRequest('POST', '/api/distribution/streams', config)
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
    
    console.log(`Created 10 streams in ${endTime - startTime}ms`);
    expect(endTime - startTime).toBeLessThan(5000); // Should be under 5 seconds
    
    // Cleanup
    const streamIds = results.map(r => r.stream_id);
    await Promise.all(streamIds.map(id => 
      makeRequest('DELETE', `/api/distribution/streams/${id}`)
    ));
  });
  
  test('Status endpoint performance', async () => {
    const iterations = 100;
    const startTime = performance.now();
    
    const promises = Array.from({ length: iterations }, () => 
      makeRequest('GET', '/api/distribution/status')
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
    
    const avgTime = (endTime - startTime) / iterations;
    console.log(`Average status request time: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(100); // Should be under 100ms per request
  });
  
});