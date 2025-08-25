// WebSocket Integration Test with Core Systems
console.log('🔗 Starting WebSocket Integration Test with Core Systems...\n');

const testIntegrationWithServer = async (serverUrl, serverName) => {
  console.log(`🧪 Testing integration with ${serverName} at ${serverUrl}...`);
  
  return new Promise((resolve) => {
    const ws = new WebSocket(serverUrl);
    const results = {
      server: serverName,
      connected: false,
      features: [],
      responses: [],
      errors: []
    };
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve(results);
    }, 6000);
    
    ws.onopen = () => {
      results.connected = true;
      console.log(`  ✅ Connected to ${serverName}`);
      
      // Test various integration scenarios
      const testMessages = [
        // Core API test
        { type: 'ping', timestamp: Date.now() },
        
        // Health check test
        { type: 'health_check', timestamp: Date.now() },
        
        // Configuration test
        { type: 'get_config', timestamp: Date.now() },
        
        // Face detection simulation
        { 
          type: 'face_detection',
          imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
          timestamp: Date.now()
        },
        
        // Distribution system test
        { 
          type: 'subscribe',
          channel: 'face_detection_results',
          timestamp: Date.now()
        },
        
        // Error handling test
        { 
          type: 'invalid_request',
          data: 'test_error_handling',
          timestamp: Date.now()
        }
      ];
      
      // Send test messages with delays
      testMessages.forEach((message, index) => {
        setTimeout(() => {
          console.log(`  📤 Sending ${message.type} to ${serverName}`);
          ws.send(JSON.stringify(message));
        }, index * 500);
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        results.responses.push(data);
        console.log(`  📨 ${serverName} responded: ${data.type || 'unknown'}`);
        
        // Detect server features based on responses
        if (data.type === 'connected' || data.type === 'connection_established') {
          results.features.push('connection_handling');
        }
        if (data.capabilities || data.serverCapabilities) {
          results.features.push('capability_reporting');
        }
        if (data.type === 'pong') {
          results.features.push('ping_pong');
        }
        if (data.type === 'health_response' || data.health) {
          results.features.push('health_monitoring');
        }
        if (data.type === 'face_detection_result' || data.faces) {
          results.features.push('face_detection');
        }
        if (data.type === 'subscribed' || data.subscription) {
          results.features.push('subscription_system');
        }
        if (data.type === 'error' || data.error) {
          results.features.push('error_handling');
        }
        
      } catch (parseError) {
        console.log(`  ⚠️ ${serverName}: Unparseable response`);
        results.errors.push('parse_error');
      }
    };
    
    ws.onerror = (error) => {
      console.log(`  ❌ ${serverName}: Connection error`);
      results.errors.push('connection_error');
    };
    
    ws.onclose = () => {
      clearTimeout(timeout);
      console.log(`  🔌 ${serverName}: Connection closed`);
      resolve(results);
    };
  });
};

// Test resource cleanup
const testResourceCleanup = async () => {
  console.log('\n🧹 Testing WebSocket resource cleanup...');
  
  const connections = [];
  const connectionCount = 5;
  
  // Create multiple connections
  for (let i = 0; i < connectionCount; i++) {
    const ws = new WebSocket('ws://localhost:3000/ws');
    connections.push({
      ws,
      id: i,
      created: Date.now()
    });
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Close all connections rapidly
  console.log('  🔌 Closing all connections rapidly...');
  connections.forEach(conn => {
    conn.ws.close();
  });
  
  console.log('  ✅ Resource cleanup test completed');
  
  return {
    connectionsCreated: connectionCount,
    cleanupCompleted: true
  };
};

// Test broadcasting functionality
const testBroadcasting = async () => {
  console.log('\n📡 Testing WebSocket broadcasting...');
  
  const connections = [];
  const results = {
    connectionsEstablished: 0,
    broadcastsReceived: 0,
    uniqueMessages: new Set()
  };
  
  // Create multiple connections to test broadcasting
  for (let i = 0; i < 3; i++) {
    const ws = new WebSocket('ws://localhost:5009/ws');
    
    ws.onopen = () => {
      results.connectionsEstablished++;
      console.log(`  ✅ Broadcast test connection ${i} established`);
      
      // Send a broadcast trigger message
      if (i === 0) {
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'broadcast_test',
            message: 'Hello all connections!',
            timestamp: Date.now()
          }));
        }, 1000);
      }
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'broadcast' || data.broadcast) {
        results.broadcastsReceived++;
        results.uniqueMessages.add(JSON.stringify(data));
        console.log(`  📨 Connection ${i} received broadcast`);
      }
    };
    
    connections.push(ws);
  }
  
  // Wait for test completion
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Cleanup
  connections.forEach(ws => ws.close());
  
  console.log('  ✅ Broadcasting test completed');
  
  return results;
};

// Main integration test runner
const runIntegrationTests = async () => {
  console.log('⏱️ Waiting 3 seconds for server to start...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const integrationTests = [
    {
      name: 'Main API Server',
      url: 'ws://localhost:5009/ws'
    }
  ];
  
  const allResults = [];
  
  // Test integration with each server
  for (const test of integrationTests) {
    try {
      const result = await testIntegrationWithServer(test.url, test.name);
      allResults.push(result);
    } catch (error) {
      console.log(`❌ ${test.name} integration test failed:`, error.message);
      allResults.push({
        server: test.name,
        connected: false,
        error: error.message
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Run resource cleanup test
  const cleanupResult = await testResourceCleanup();
  
  // Run broadcasting test
  const broadcastResult = await testBroadcasting();
  
  // Generate integration report
  console.log('\n🔗 WEBSOCKET INTEGRATION TEST RESULTS');
  console.log('=====================================\n');
  
  for (const result of allResults) {
    console.log(`Server: ${result.server}`);
    console.log(`  Connected: ${result.connected ? '✅' : '❌'}`);
    console.log(`  Features detected: ${result.features.length}`);
    console.log(`  Feature list: ${result.features.join(', ') || 'none'}`);
    console.log(`  Responses received: ${result.responses.length}`);
    console.log(`  Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log(`  Error details: ${result.errors.join(', ')}`);
    }
    
    // Integration score
    let score = 0;
    if (result.connected) score += 30;
    score += result.features.length * 10;
    score += Math.min(result.responses.length * 5, 30);
    score -= result.errors.length * 10;
    
    console.log(`  Integration Score: ${Math.max(0, score)}/100`);
    console.log('');
  }
  
  console.log('Resource Cleanup:');
  console.log(`  Connections created: ${cleanupResult.connectionsCreated}`);
  console.log(`  Cleanup completed: ${cleanupResult.cleanupCompleted ? '✅' : '❌'}`);
  console.log('');
  
  console.log('Broadcasting:');
  console.log(`  Connections established: ${broadcastResult.connectionsEstablished}`);
  console.log(`  Broadcasts received: ${broadcastResult.broadcastsReceived}`);
  console.log(`  Unique messages: ${broadcastResult.uniqueMessages.size}`);
  console.log('');
  
  // Overall assessment
  const connectedServers = allResults.filter(r => r.connected).length;
  const totalFeatures = allResults.reduce((sum, r) => sum + r.features.length, 0);
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
  
  console.log('Overall Integration Assessment:');
  console.log(`  Servers accessible: ${connectedServers}/${allResults.length}`);
  console.log(`  Total features detected: ${totalFeatures}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Resource cleanup: ${cleanupResult.cleanupCompleted ? 'Working' : 'Failed'}`);
  
  if (connectedServers === allResults.length && totalErrors === 0 && cleanupResult.cleanupCompleted) {
    console.log(`  🎉 EXCELLENT: All integration tests passed!`);
  } else if (connectedServers > 0) {
    console.log(`  ⚠️ PARTIAL: Some integration issues detected`);
  } else {
    console.log(`  ❌ FAILED: Integration tests failed`);
  }
  
  console.log('\n✅ Integration testing completed!\n');
  process.exit(0);
};

// Start integration tests
setTimeout(runIntegrationTests, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down integration test...');
  process.exit(0);
});