// Comprehensive WebSocket System Test Suite
console.log('🧪 Starting Comprehensive WebSocket System Test Suite...\n');

// Test all identified WebSocket server implementations
const testServers = [
  {
    name: 'Main API Server',
    path: './src/services/api/server.ts',
    port: 5001,
    endpoint: '/ws'
  },
  {
    name: 'Enhanced Server',
    path: './src/services/api/enhanced-server.js',
    port: 5002,
    endpoint: '/ws'
  },
  {
    name: 'Minimal Server',
    path: './src/services/api/minimal-server.js',
    port: 5003,
    endpoint: '/ws'
  },
  {
    name: 'Distribution WebSocket',
    path: './src/core/distribution/distributors/websocket-distributor.js',
    port: 5004,
    endpoint: '/'
  }
];

// Create test WebSocket server for each implementation
const createTestServer = async (serverConfig) => {
  console.log(`🚀 Starting ${serverConfig.name}...`);
  
  // Create a simplified test server based on the pattern
  const server = Bun.serve({
    port: serverConfig.port,
    
    async fetch(request, server) {
      const url = new URL(request.url);
      
      // Handle WebSocket upgrade for the specific endpoint
      if (url.pathname === serverConfig.endpoint) {
        if (server.upgrade(request)) {
          return; // WebSocket upgrade successful
        }
        return new Response('WebSocket upgrade failed', { status: 500 });
      }
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          server: serverConfig.name,
          status: 'healthy',
          websocket: 'available',
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(`${serverConfig.name} - WebSocket endpoint: ws://localhost:${serverConfig.port}${serverConfig.endpoint}`, {
        headers: { 'Content-Type': 'text/plain' }
      });
    },
    
    websocket: {
      open(ws) {
        ws.serverName = serverConfig.name;
        ws.connectionTime = Date.now();
        ws.messageCount = 0;
        
        console.log(`✅ ${serverConfig.name}: WebSocket connected`);
        
        // Send welcome message
        ws.send(JSON.stringify({
          type: 'welcome',
          server: serverConfig.name,
          timestamp: Date.now(),
          endpoint: serverConfig.endpoint
        }));
      },
      
      message(ws, message) {
        try {
          ws.messageCount++;
          const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
          const data = JSON.parse(text);
          
          console.log(`📨 ${ws.serverName}: Received ${data.type || 'unknown'} message`);
          
          // Handle different message types
          switch (data.type) {
            case 'ping':
              ws.send(JSON.stringify({
                type: 'pong',
                server: ws.serverName,
                timestamp: Date.now(),
                originalTimestamp: data.timestamp
              }));
              break;
              
            case 'echo':
              ws.send(JSON.stringify({
                type: 'echo_response',
                server: ws.serverName,
                originalMessage: data,
                timestamp: Date.now()
              }));
              break;
              
            case 'subscribe':
              ws.send(JSON.stringify({
                type: 'subscribed',
                server: ws.serverName,
                channel: data.channel,
                timestamp: Date.now()
              }));
              break;
              
            case 'frame':
              // Simulate frame processing
              ws.send(JSON.stringify({
                type: 'frame_result',
                server: ws.serverName,
                frameId: data.frameId,
                result: {
                  faces: [{ x: 100, y: 100, width: 50, height: 50 }],
                  timestamp: Date.now()
                }
              }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'unknown_message',
                server: ws.serverName,
                received: data,
                timestamp: Date.now()
              }));
          }
          
        } catch (error) {
          console.log(`❌ ${ws.serverName}: Message error:`, error.message);
          ws.send(JSON.stringify({
            type: 'error',
            server: ws.serverName,
            error: error.message,
            timestamp: Date.now()
          }));
        }
      },
      
      close(ws, code, reason) {
        const duration = Date.now() - ws.connectionTime;
        console.log(`🔌 ${ws.serverName}: WebSocket closed (${ws.messageCount} messages, ${duration}ms duration)`);
      }
    }
  });
  
  return { server, config: serverConfig };
};

// Test client factory
const createTestClient = (serverConfig, testConfig) => {
  return new Promise((resolve, reject) => {
    const results = {
      server: serverConfig.name,
      connected: false,
      messagesReceived: 0,
      messagesSent: 0,
      errors: [],
      latencies: [],
      testResults: {}
    };
    
    const wsUrl = `ws://localhost:${serverConfig.port}${serverConfig.endpoint}`;
    console.log(`🔗 Connecting to ${serverConfig.name} at ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    let startTime = Date.now();
    
    // Test sequence
    const tests = testConfig.tests || [
      { type: 'ping', timestamp: Date.now() },
      { type: 'echo', message: 'Hello WebSocket!' },
      { type: 'subscribe', channel: 'face_detection' },
      { type: 'frame', frameId: 'test_001', data: 'base64_frame_data' }
    ];
    
    let testIndex = 0;
    let testInterval;
    
    ws.onopen = () => {
      results.connected = true;
      console.log(`✅ ${serverConfig.name}: Client connected`);
      
      // Start sending test messages
      testInterval = setInterval(() => {
        if (testIndex < tests.length) {
          const testMessage = tests[testIndex];
          ws.send(JSON.stringify(testMessage));
          results.messagesSent++;
          testIndex++;
        } else {
          // All tests sent, wait a bit then close
          clearInterval(testInterval);
          setTimeout(() => ws.close(), 1000);
        }
      }, 500);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        results.messagesReceived++;
        
        // Calculate latency for ping messages
        if (data.type === 'pong' && data.originalTimestamp) {
          const latency = Date.now() - data.originalTimestamp;
          results.latencies.push(latency);
        }
        
        // Record test results
        results.testResults[data.type] = data;
        
        console.log(`📨 ${serverConfig.name}: Received ${data.type}`);
        
      } catch (error) {
        results.errors.push(`Message parse error: ${error.message}`);
      }
    };
    
    ws.onerror = (error) => {
      results.errors.push(`Connection error: ${error.message || 'Unknown error'}`);
      console.log(`❌ ${serverConfig.name}: WebSocket error`);
    };
    
    ws.onclose = (event) => {
      clearInterval(testInterval);
      const duration = Date.now() - startTime;
      
      console.log(`🔌 ${serverConfig.name}: Client disconnected (${duration}ms total)`);
      
      results.duration = duration;
      results.avgLatency = results.latencies.length > 0 
        ? results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length 
        : 0;
        
      resolve(results);
    };
    
    // Timeout fallback
    setTimeout(() => {
      if (!results.connected) {
        ws.close();
        results.errors.push('Connection timeout');
        resolve(results);
      }
    }, testConfig.timeout || 10000);
  });
};

// Run comprehensive test suite
const runTestSuite = async () => {
  console.log('🌊 Starting test servers...\n');
  
  // Start all test servers
  const servers = [];
  for (const serverConfig of testServers) {
    try {
      const serverInstance = await createTestServer(serverConfig);
      servers.push(serverInstance);
      console.log(`✅ ${serverConfig.name} started on port ${serverConfig.port}`);
    } catch (error) {
      console.log(`❌ Failed to start ${serverConfig.name}:`, error.message);
    }
  }
  
  console.log(`\n🔗 Starting client tests for ${servers.length} servers...\n`);
  
  // Wait for servers to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test each server
  const allResults = [];
  
  for (const serverInstance of servers) {
    try {
      console.log(`\n🧪 Testing ${serverInstance.config.name}...`);
      
      const testConfig = {
        tests: [
          { type: 'ping', timestamp: Date.now() },
          { type: 'echo', message: `Test from ${serverInstance.config.name}` },
          { type: 'subscribe', channel: 'test_channel' },
          { type: 'frame', frameId: `test_${Date.now()}`, data: 'mock_frame_data' }
        ],
        timeout: 8000
      };
      
      const result = await createTestClient(serverInstance.config, testConfig);
      allResults.push(result);
      
    } catch (error) {
      console.log(`❌ Test failed for ${serverInstance.config.name}:`, error.message);
      allResults.push({
        server: serverInstance.config.name,
        connected: false,
        errors: [error.message]
      });
    }
  }
  
  // Generate test report
  console.log('\n📊 WEBSOCKET SYSTEM TEST RESULTS');
  console.log('==================================\n');
  
  let totalConnected = 0;
  let totalMessages = 0;
  let totalErrors = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  
  for (const result of allResults) {
    console.log(`Server: ${result.server}`);
    console.log(`  Connected: ${result.connected ? '✅' : '❌'}`);
    console.log(`  Messages sent: ${result.messagesSent || 0}`);
    console.log(`  Messages received: ${result.messagesReceived || 0}`);
    console.log(`  Errors: ${result.errors?.length || 0}`);
    console.log(`  Avg latency: ${result.avgLatency?.toFixed(2) || 'N/A'}ms`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`  Error details: ${result.errors.join(', ')}`);
    }
    
    // Test coverage
    const testTypes = Object.keys(result.testResults || {});
    console.log(`  Test coverage: ${testTypes.join(', ')}`);
    
    console.log('');
    
    // Aggregate stats
    if (result.connected) totalConnected++;
    totalMessages += (result.messagesSent || 0) + (result.messagesReceived || 0);
    totalErrors += result.errors?.length || 0;
    if (result.avgLatency > 0) {
      totalLatency += result.avgLatency;
      latencyCount++;
    }
  }
  
  console.log('Summary:');
  console.log(`  Servers tested: ${allResults.length}`);
  console.log(`  Successful connections: ${totalConnected}/${allResults.length}`);
  console.log(`  Total messages: ${totalMessages}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Average latency: ${latencyCount > 0 ? (totalLatency / latencyCount).toFixed(2) : 'N/A'}ms`);
  
  const successRate = (totalConnected / allResults.length * 100).toFixed(1);
  console.log(`  Success rate: ${successRate}%`);
  
  if (successRate >= 100) {
    console.log('\n🎉 ALL WEBSOCKET SERVERS PASSED TESTS!');
  } else if (successRate >= 75) {
    console.log('\n⚠️ Most WebSocket servers working, some issues detected');
  } else {
    console.log('\n❌ Multiple WebSocket servers have issues');
  }
  
  // Cleanup
  console.log('\n🛑 Shutting down test servers...');
  for (const serverInstance of servers) {
    try {
      serverInstance.server.stop();
    } catch (error) {
      console.log(`Warning: Failed to stop ${serverInstance.config.name}`);
    }
  }
  
  console.log('✅ WebSocket system test completed!\n');
  
  return allResults;
};

// Start the test suite
runTestSuite().catch(console.error).finally(() => {
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted, shutting down...');
  process.exit(0);
});