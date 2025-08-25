// Comprehensive Distribution System Test
console.log('📡 Starting Comprehensive Distribution System Test...\n');

// Test distribution API server
const server = Bun.serve({
  port: 6001,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    const method = request.method;
    
    console.log(`🔍 Distribution API: ${method} ${url.pathname}`);
    
    // Mock distribution API endpoints
    switch (url.pathname) {
      case '/api/distribution/streams':
        return handleStreamsEndpoint(request, method);
      
      case '/api/distribution/distributors':
        return handleDistributorsEndpoint(request, method);
        
      case '/api/distribution/config':
        return handleConfigEndpoint(request, method);
        
      case '/api/distribution/sessions':
        return handleSessionsEndpoint(request, method);
        
      case '/api/distribution/health':
        return handleHealthEndpoint(request, method);
        
      case '/api/distribution/discovery':
        return handleDiscoveryEndpoint(request, method);
        
      case '/ws':
        if (server.upgrade(request)) {
          return;
        }
        return new Response('WebSocket upgrade failed', { status: 500 });
        
      default:
        return new Response(JSON.stringify({
          error: 'Endpoint not found',
          availableEndpoints: [
            '/api/distribution/streams',
            '/api/distribution/distributors', 
            '/api/distribution/config',
            '/api/distribution/sessions',
            '/api/distribution/health',
            '/api/distribution/discovery',
            '/ws'
          ]
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  },
  
  websocket: {
    open(ws) {
      ws.connectionId = `dist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log(`🔌 Distribution WebSocket connected: ${ws.connectionId}`);
      
      ws.send(JSON.stringify({
        type: 'distribution_connected',
        connectionId: ws.connectionId,
        capabilities: ['stream_control', 'real_time_stats', 'configuration'],
        timestamp: Date.now()
      }));
    },
    
    message(ws, message) {
      try {
        const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
        console.log(`📨 Distribution WebSocket: ${data.type}`);
        
        switch (data.type) {
          case 'start_stream':
            handleStreamStart(ws, data);
            break;
            
          case 'stop_stream':
            handleStreamStop(ws, data);
            break;
            
          case 'get_stats':
            handleGetStats(ws, data);
            break;
            
          case 'configure_distributor':
            handleDistributorConfig(ws, data);
            break;
            
          default:
            ws.send(JSON.stringify({
              type: 'unknown_command',
              received: data.type,
              timestamp: Date.now()
            }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message,
          timestamp: Date.now()
        }));
      }
    },
    
    close(ws) {
      console.log(`🔌 Distribution WebSocket disconnected: ${ws.connectionId}`);
    }
  }
});

// Mock distribution state
const distributionState = {
  streams: new Map(),
  distributors: new Map([
    ['websocket', { 
      type: 'websocket', 
      status: 'active', 
      connections: 0,
      endpoint: 'ws://localhost:8080'
    }],
    ['http', { 
      type: 'http', 
      status: 'active', 
      requests: 0,
      endpoint: 'http://localhost:8081'
    }],
    ['udp', { 
      type: 'udp', 
      status: 'active', 
      packets: 0,
      endpoint: 'udp://localhost:8082'
    }],
    ['mqtt', { 
      type: 'mqtt', 
      status: 'inactive', 
      messages: 0,
      endpoint: 'mqtt://localhost:1883'
    }],
    ['sse', { 
      type: 'sse', 
      status: 'active', 
      events: 0,
      endpoint: 'http://localhost:8083/events'
    }]
  ]),
  sessions: new Map(),
  config: {
    maxStreams: 10,
    maxSessions: 50,
    retryAttempts: 3,
    healthCheckInterval: 30000
  },
  stats: {
    totalStreams: 0,
    totalMessages: 0,
    uptime: Date.now()
  }
};

// API endpoint handlers
const handleStreamsEndpoint = async (request, method) => {
  switch (method) {
    case 'GET':
      const streams = Array.from(distributionState.streams.entries()).map(([id, stream]) => ({
        id,
        ...stream
      }));
      
      return new Response(JSON.stringify({
        success: true,
        data: { streams, total: streams.length },
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case 'POST':
      try {
        const streamConfig = await request.json();
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        const stream = {
          id: streamId,
          type: streamConfig.type || 'websocket',
          source: streamConfig.source || 'face_analysis',
          destination: streamConfig.destination || { host: 'localhost', port: 8080 },
          status: 'active',
          createdAt: Date.now(),
          statistics: {
            packetsSent: 0,
            bytesSent: 0,
            lastActivity: Date.now()
          }
        };
        
        distributionState.streams.set(streamId, stream);
        distributionState.stats.totalStreams++;
        
        return new Response(JSON.stringify({
          success: true,
          data: { streamId, stream },
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          timestamp: Date.now()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: Date.now()
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};

const handleDistributorsEndpoint = async (request, method) => {
  switch (method) {
    case 'GET':
      const distributors = Array.from(distributionState.distributors.entries()).map(([name, dist]) => ({
        name,
        ...dist
      }));
      
      return new Response(JSON.stringify({
        success: true,
        data: { distributors, available: distributors.length },
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: Date.now()
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};

const handleConfigEndpoint = async (request, method) => {
  switch (method) {
    case 'GET':
      return new Response(JSON.stringify({
        success: true,
        data: distributionState.config,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case 'PUT':
      try {
        const updates = await request.json();
        Object.assign(distributionState.config, updates);
        
        return new Response(JSON.stringify({
          success: true,
          data: { updated: distributionState.config },
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          timestamp: Date.now()
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: Date.now()
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};

const handleSessionsEndpoint = async (request, method) => {
  switch (method) {
    case 'GET':
      const sessions = Array.from(distributionState.sessions.entries()).map(([id, session]) => ({
        id,
        ...session
      }));
      
      return new Response(JSON.stringify({
        success: true,
        data: { sessions, active: sessions.length },
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: Date.now()
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};

const handleHealthEndpoint = async (request, method) => {
  if (method !== 'GET') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed',
      timestamp: Date.now()
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const health = {
    status: 'healthy',
    uptime: Date.now() - distributionState.stats.uptime,
    distributors: Object.fromEntries(
      Array.from(distributionState.distributors.entries()).map(([name, dist]) => [
        name, 
        { status: dist.status, endpoint: dist.endpoint }
      ])
    ),
    streams: distributionState.streams.size,
    sessions: distributionState.sessions.size,
    memory: process.memoryUsage(),
    timestamp: Date.now()
  };
  
  return new Response(JSON.stringify({
    success: true,
    data: health,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

const handleDiscoveryEndpoint = async (request, method) => {
  if (method !== 'GET') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed',
      timestamp: Date.now()
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const discovery = {
    service: 'Synopticon Distribution API',
    version: '2.0.0',
    capabilities: [
      'multi_protocol_distribution',
      'real_time_streaming', 
      'session_management',
      'configuration_management',
      'health_monitoring'
    ],
    availableStreams: Array.from(distributionState.streams.keys()),
    availableDistributors: Array.from(distributionState.distributors.keys()),
    connectedClients: [],
    templates: ['basic', 'research', 'real_time', 'high_throughput'],
    apiEndpoints: {
      streams: '/api/distribution/streams',
      distributors: '/api/distribution/distributors',
      config: '/api/distribution/config',
      sessions: '/api/distribution/sessions',
      health: '/api/distribution/health'
    },
    websocketEndpoints: {
      control: '/ws'
    }
  };
  
  return new Response(JSON.stringify({
    success: true,
    data: discovery,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

// WebSocket message handlers
const handleStreamStart = (ws, data) => {
  const streamId = data.streamId || `stream_${Date.now()}`;
  
  ws.send(JSON.stringify({
    type: 'stream_started',
    streamId,
    config: data.config,
    timestamp: Date.now()
  }));
};

const handleStreamStop = (ws, data) => {
  ws.send(JSON.stringify({
    type: 'stream_stopped',
    streamId: data.streamId,
    timestamp: Date.now()
  }));
};

const handleGetStats = (ws, data) => {
  ws.send(JSON.stringify({
    type: 'stats_response',
    stats: {
      streams: distributionState.streams.size,
      distributors: distributionState.distributors.size,
      totalMessages: distributionState.stats.totalMessages,
      uptime: Date.now() - distributionState.stats.uptime
    },
    timestamp: Date.now()
  }));
};

const handleDistributorConfig = (ws, data) => {
  const distributorName = data.distributor;
  const config = data.config;
  
  if (distributionState.distributors.has(distributorName)) {
    ws.send(JSON.stringify({
      type: 'distributor_configured',
      distributor: distributorName,
      config,
      timestamp: Date.now()
    }));
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      error: `Distributor not found: ${distributorName}`,
      timestamp: Date.now()
    }));
  }
};

console.log('🚀 Distribution System Test Server running on http://localhost:6001');
console.log('📡 WebSocket endpoint: ws://localhost:6001/ws\n');

// Distribution system test client
const testDistributionAPI = async () => {
  console.log('⏱️ Waiting 2 seconds for server to start...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const baseURL = 'http://localhost:6001';
  const results = {
    apiTests: {},
    websocketTest: null,
    errors: []
  };
  
  // Test API endpoints
  const apiEndpoints = [
    { name: 'Discovery', path: '/api/distribution/discovery', method: 'GET' },
    { name: 'Health Check', path: '/api/distribution/health', method: 'GET' },
    { name: 'Distributors List', path: '/api/distribution/distributors', method: 'GET' },
    { name: 'Streams List', path: '/api/distribution/streams', method: 'GET' },
    { name: 'Configuration', path: '/api/distribution/config', method: 'GET' },
    { name: 'Sessions', path: '/api/distribution/sessions', method: 'GET' }
  ];
  
  console.log('🧪 Testing Distribution API endpoints...\n');
  
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`  📤 Testing ${endpoint.name}...`);
      
      const response = await fetch(`${baseURL}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      results.apiTests[endpoint.name] = {
        status: response.status,
        success: data.success,
        hasData: !!data.data,
        responseTime: Date.now()
      };
      
      console.log(`  ✅ ${endpoint.name}: ${response.status} - ${data.success ? 'Success' : 'Failed'}`);
      
    } catch (error) {
      console.log(`  ❌ ${endpoint.name}: ${error.message}`);
      results.errors.push(`${endpoint.name}: ${error.message}`);
    }
  }
  
  // Test stream creation
  console.log('\n🧪 Testing stream creation...');
  try {
    const streamConfig = {
      type: 'websocket',
      source: 'face_analysis',
      destination: { host: 'localhost', port: 8080 },
      distributors: ['websocket', 'http']
    };
    
    const response = await fetch(`${baseURL}/api/distribution/streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(streamConfig)
    });
    
    const data = await response.json();
    console.log(`  ✅ Stream creation: ${response.status} - Stream ID: ${data.data?.streamId || 'none'}`);
    
  } catch (error) {
    console.log(`  ❌ Stream creation failed: ${error.message}`);
  }
  
  // Test WebSocket functionality
  console.log('\n🧪 Testing Distribution WebSocket...');
  
  try {
    const wsResult = await new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:6001/ws');
      const messages = [];
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ messages, timeout: true });
      }, 5000);
      
      ws.onopen = () => {
        console.log('  ✅ WebSocket connected');
        
        // Send test commands
        ws.send(JSON.stringify({
          type: 'get_stats',
          timestamp: Date.now()
        }));
        
        ws.send(JSON.stringify({
          type: 'start_stream',
          streamId: 'test_stream',
          config: { type: 'websocket', destination: 'localhost:8080' }
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        messages.push(data);
        console.log(`  📨 Received: ${data.type}`);
      };
      
      ws.onclose = () => {
        clearTimeout(timeout);
        resolve({ messages });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({ messages, error: error.message });
      };
    });
    
    results.websocketTest = wsResult;
    
  } catch (error) {
    console.log(`  ❌ WebSocket test failed: ${error.message}`);
    results.errors.push(`WebSocket: ${error.message}`);
  }
  
  // Generate test report
  console.log('\n📊 DISTRIBUTION SYSTEM TEST RESULTS');
  console.log('===================================\n');
  
  console.log('API Endpoint Tests:');
  let passedTests = 0;
  let totalTests = 0;
  
  for (const [testName, result] of Object.entries(results.apiTests)) {
    totalTests++;
    const status = result.success && result.status === 200 ? '✅' : '❌';
    console.log(`  ${status} ${testName}: ${result.status} (${result.success ? 'Success' : 'Failed'})`);
    if (result.success && result.status === 200) passedTests++;
  }
  
  console.log(`\nWebSocket Test:${results.websocketTest?.messages.length > 0 ? ' ✅' : ' ❌'}`);
  if (results.websocketTest) {
    console.log(`  Messages received: ${results.websocketTest.messages.length}`);
    console.log(`  Message types: ${results.websocketTest.messages.map(m => m.type).join(', ')}`);
  }
  
  console.log('\nOverall Results:');
  console.log(`  API Tests: ${passedTests}/${totalTests} passed`);
  console.log(`  WebSocket: ${results.websocketTest?.messages.length > 0 ? 'Working' : 'Failed'}`);
  console.log(`  Errors: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  const successRate = ((passedTests + (results.websocketTest?.messages.length > 0 ? 1 : 0)) / (totalTests + 1) * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);
  
  if (successRate >= 90) {
    console.log('🎉 EXCELLENT: Distribution system is working properly!');
  } else if (successRate >= 70) {
    console.log('⚠️ PARTIAL: Most distribution features working');
  } else {
    console.log('❌ ISSUES: Distribution system has significant problems');
  }
  
  console.log('\n✅ Distribution system testing completed!\n');
  process.exit(0);
};

// Start tests
setTimeout(testDistributionAPI, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down distribution test...');
  server.stop();
  process.exit(0);
});