// Test WebSocket error conditions and edge cases
console.log('🧪 Testing WebSocket Error Conditions...\n');

const testInvalidUpgrade = () => {
  console.log('1. Testing invalid WebSocket upgrade request...');
  
  const server = Bun.serve({
    port: 4005,
    
    async fetch(request, server) {
      console.log(`Request: ${request.method} ${request.url}`);
      console.log('Headers:', Object.fromEntries(request.headers));
      
      // Try to upgrade without proper WebSocket headers
      const upgraded = server.upgrade(request);
      
      if (upgraded) {
        console.log('❌ Unexpected: Invalid request was upgraded');
        return;
      } else {
        console.log('✅ Correctly rejected invalid upgrade request');
        return new Response('Invalid WebSocket request', { 
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    },
    
    websocket: {
      open(ws) {
        console.log('❌ WebSocket opened - this should not happen for invalid requests');
      },
      message(ws, message) {
        console.log('❌ Message received - this should not happen for invalid requests');
      },
      close(ws) {
        console.log('❌ WebSocket closed - this should not happen for invalid requests');
      }
    }
  });
  
  return server;
};

const testMalformedMessage = () => {
  console.log('\n2. Testing malformed WebSocket messages...');
  
  const server = Bun.serve({
    port: 4006,
    
    async fetch(request, server) {
      if (server.upgrade(request)) {
        return;
      }
      return new Response('Not a WebSocket endpoint', { status: 400 });
    },
    
    websocket: {
      open(ws) {
        console.log('✅ WebSocket connected for malformed message test');
        
        // Test sending various message types
        setTimeout(() => {
          console.log('📤 Sending valid JSON...');
          ws.send(JSON.stringify({ type: 'test', data: 'valid' }));
        }, 100);
        
        setTimeout(() => {
          console.log('📤 Sending invalid JSON...');
          ws.send('{ invalid json }');
        }, 200);
        
        setTimeout(() => {
          console.log('📤 Sending binary data...');
          ws.send(new Uint8Array([1, 2, 3, 4]));
        }, 300);
        
        setTimeout(() => {
          console.log('📤 Sending empty message...');
          ws.send('');
        }, 400);
      },
      
      message(ws, message) {
        try {
          const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
          console.log(`📨 Received message: ${text.substring(0, 50)}...`);
          
          // Try to parse as JSON
          const parsed = JSON.parse(text);
          console.log('✅ Successfully parsed JSON:', parsed.type);
          
          ws.send(JSON.stringify({ 
            type: 'response',
            originalType: parsed.type,
            status: 'success'
          }));
          
        } catch (error) {
          console.log('⚠️ JSON parse error:', error.message);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid JSON format',
            received: typeof message === 'string' ? message.substring(0, 100) : '[binary data]'
          }));
        }
      },
      
      close(ws, code, reason) {
        console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
      }
    }
  });
  
  return server;
};

const testConnectionLimits = () => {
  console.log('\n3. Testing connection limits and rapid connections...');
  
  const connections = new Set();
  const MAX_CONNECTIONS = 5;
  
  const server = Bun.serve({
    port: 4007,
    
    async fetch(request, server) {
      if (connections.size >= MAX_CONNECTIONS) {
        console.log(`❌ Connection limit reached (${connections.size}/${MAX_CONNECTIONS})`);
        return new Response('Connection limit reached', { 
          status: 429,
          headers: { 'Retry-After': '10' }
        });
      }
      
      if (server.upgrade(request)) {
        return;
      }
      
      return new Response('WebSocket upgrade failed', { status: 400 });
    },
    
    websocket: {
      open(ws) {
        connections.add(ws);
        console.log(`✅ New connection (${connections.size}/${MAX_CONNECTIONS})`);
        
        ws.send(JSON.stringify({
          type: 'connected',
          connectionId: connections.size,
          maxConnections: MAX_CONNECTIONS
        }));
      },
      
      message(ws, message) {
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        console.log(`📨 Message from connection: ${text}`);
        
        // Echo back with connection info
        ws.send(JSON.stringify({
          type: 'echo',
          message: text,
          activeConnections: connections.size
        }));
      },
      
      close(ws) {
        connections.delete(ws);
        console.log(`🔌 Connection closed (${connections.size}/${MAX_CONNECTIONS} remaining)`);
      }
    }
  });
  
  return server;
};

// Test with actual WebSocket client
const runClientTests = async () => {
  console.log('\n4. Running client-side error condition tests...');
  
  // Test 1: Invalid upgrade
  try {
    console.log('Testing HTTP request to WebSocket endpoint...');
    const response = await fetch('http://localhost:4005/');
    console.log(`Response status: ${response.status}`);
    console.log(`Response text: ${await response.text()}`);
  } catch (error) {
    console.log('❌ Fetch error:', error.message);
  }
  
  // Test 2: Malformed message handling
  try {
    console.log('\nTesting malformed message handling...');
    const ws = new WebSocket('ws://localhost:4006');
    
    ws.onopen = () => {
      console.log('✅ Connected to malformed message test server');
      ws.send('This is a plain text message');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Server response:', data);
      ws.close();
    };
    
    ws.onerror = (error) => {
      console.log('❌ WebSocket error:', error);
    };
    
  } catch (error) {
    console.log('❌ Client test error:', error.message);
  }
  
  // Test 3: Connection limit test
  setTimeout(async () => {
    console.log('\nTesting connection limits...');
    const connections = [];
    
    // Try to create more connections than allowed
    for (let i = 0; i < 7; i++) {
      try {
        const ws = new WebSocket('ws://localhost:4007');
        connections.push(ws);
        
        ws.onopen = () => {
          console.log(`✅ Connection ${i + 1} opened`);
          ws.send(`Hello from connection ${i + 1}`);
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log(`📨 Connection ${i + 1} received:`, data.type);
        };
        
        ws.onerror = () => {
          console.log(`❌ Connection ${i + 1} failed`);
        };
        
      } catch (error) {
        console.log(`❌ Failed to create connection ${i + 1}:`, error.message);
      }
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Clean up after test
    setTimeout(() => {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      
      console.log('\n🧪 Error condition tests completed');
      process.exit(0);
    }, 3000);
    
  }, 2000);
};

// Start all test servers
const server1 = testInvalidUpgrade();
const server2 = testMalformedMessage();  
const server3 = testConnectionLimits();

console.log('🚀 Error condition test servers started:');
console.log('  - Invalid upgrade test: http://localhost:4005');
console.log('  - Malformed message test: ws://localhost:4006');
console.log('  - Connection limits test: ws://localhost:4007');

// Run client tests after servers are ready
setTimeout(runClientTests, 500);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test servers...');
  server1.stop();
  server2.stop();
  server3.stop();
  process.exit(0);
});