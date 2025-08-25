// WebSocket Stress Test - Multiple concurrent clients with high message throughput
console.log('🚀 Starting WebSocket Stress Test...\n');

const server = Bun.serve({
  port: 4008,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      if (server.upgrade(request)) {
        return;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    if (url.pathname === '/stats') {
      return new Response(JSON.stringify({
        activeConnections: stats.activeConnections,
        totalMessages: stats.totalMessages,
        messagesPerSecond: stats.messagesPerSecond,
        avgLatency: stats.avgLatency,
        errors: stats.errors
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('WebSocket Stress Test Server', { 
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      stats.activeConnections++;
      ws.connectionTime = Date.now();
      ws.messageCount = 0;
      console.log(`✅ New connection (${stats.activeConnections} active)`);
    },
    
    message(ws, message) {
      stats.totalMessages++;
      ws.messageCount++;
      
      const now = Date.now();
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      
      try {
        const data = JSON.parse(text);
        
        // Calculate latency if timestamp provided
        if (data.timestamp) {
          const latency = now - data.timestamp;
          stats.latencies.push(latency);
          stats.avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
          
          // Keep only last 1000 latencies
          if (stats.latencies.length > 1000) {
            stats.latencies = stats.latencies.slice(-1000);
          }
        }
        
        // Echo back with server timestamp
        ws.send(JSON.stringify({
          type: 'echo',
          originalMessage: data,
          serverTimestamp: now,
          messageNumber: ws.messageCount,
          totalServerMessages: stats.totalMessages
        }));
        
      } catch (error) {
        stats.errors++;
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message,
          received: text.substring(0, 100)
        }));
      }
    },
    
    close(ws) {
      stats.activeConnections--;
      console.log(`🔌 Connection closed (${stats.activeConnections} remaining, handled ${ws.messageCount} messages)`);
    }
  }
});

// Server statistics
const stats = {
  activeConnections: 0,
  totalMessages: 0,
  messagesPerSecond: 0,
  avgLatency: 0,
  latencies: [],
  errors: 0,
  startTime: Date.now()
};

// Calculate messages per second
setInterval(() => {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  stats.messagesPerSecond = Math.round(stats.totalMessages / elapsed);
}, 1000);

console.log('🚀 WebSocket stress test server running on ws://localhost:4008/ws');
console.log('📊 Stats endpoint: http://localhost:4008/stats\n');

// Stress test client factory
const createStressClient = (clientId, config = {}) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:4008/ws');
    const clientStats = {
      id: clientId,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      latencies: [],
      startTime: 0
    };
    
    let messageInterval;
    
    ws.onopen = () => {
      clientStats.startTime = Date.now();
      console.log(`🔗 Client ${clientId} connected`);
      
      // Start sending messages at configured rate
      const messageRate = config.messageRate || 10; // messages per second
      const testDuration = config.duration || 30000; // 30 seconds
      
      messageInterval = setInterval(() => {
        const timestamp = Date.now();
        ws.send(JSON.stringify({
          type: 'test',
          clientId,
          timestamp,
          messageNumber: clientStats.messagesSent + 1,
          data: 'x'.repeat(config.messageSize || 100) // Variable message size
        }));
        clientStats.messagesSent++;
      }, 1000 / messageRate);
      
      // Stop test after duration
      setTimeout(() => {
        clearInterval(messageInterval);
        ws.close();
        
        const avgLatency = clientStats.latencies.length > 0 
          ? clientStats.latencies.reduce((a, b) => a + b, 0) / clientStats.latencies.length 
          : 0;
          
        console.log(`📊 Client ${clientId} completed:`);
        console.log(`   Messages sent: ${clientStats.messagesSent}`);
        console.log(`   Messages received: ${clientStats.messagesReceived}`);
        console.log(`   Errors: ${clientStats.errors}`);
        console.log(`   Avg latency: ${avgLatency.toFixed(2)}ms`);
        
        resolve(clientStats);
      }, testDuration);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clientStats.messagesReceived++;
        
        if (data.type === 'echo' && data.originalMessage.timestamp) {
          const latency = Date.now() - data.originalMessage.timestamp;
          clientStats.latencies.push(latency);
        }
        
      } catch (error) {
        clientStats.errors++;
      }
    };
    
    ws.onerror = (error) => {
      clientStats.errors++;
      console.log(`❌ Client ${clientId} error:`, error);
    };
    
    ws.onclose = () => {
      clearInterval(messageInterval);
    };
  });
};

// Run stress test
const runStressTest = async () => {
  console.log('⏱️  Waiting 2 seconds before starting client connections...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const testConfigs = [
    // Low-rate clients
    { clients: 10, messageRate: 1, duration: 20000, messageSize: 50 },
    // Medium-rate clients  
    { clients: 5, messageRate: 5, duration: 20000, messageSize: 200 },
    // High-rate clients
    { clients: 2, messageRate: 20, duration: 15000, messageSize: 500 }
  ];
  
  const allClients = [];
  let clientCounter = 0;
  
  // Start clients in waves
  for (const config of testConfigs) {
    console.log(`🌊 Starting ${config.clients} clients (${config.messageRate} msg/s, ${config.messageSize}B messages)...`);
    
    const clientPromises = [];
    for (let i = 0; i < config.clients; i++) {
      clientCounter++;
      clientPromises.push(createStressClient(clientCounter, config));
      
      // Small delay between client connections
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    allClients.push(...clientPromises);
    
    // Wait between waves
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n🎯 All ${clientCounter} clients started. Waiting for completion...\n`);
  
  // Wait for all clients to complete
  const results = await Promise.all(allClients);
  
  // Calculate aggregate statistics
  const totalSent = results.reduce((sum, r) => sum + r.messagesSent, 0);
  const totalReceived = results.reduce((sum, r) => sum + r.messagesReceived, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const allLatencies = results.flatMap(r => r.latencies);
  const avgLatency = allLatencies.length > 0 
    ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length 
    : 0;
  
  console.log('\n📊 STRESS TEST RESULTS:');
  console.log('========================');
  console.log(`Total clients: ${results.length}`);
  console.log(`Messages sent: ${totalSent}`);
  console.log(`Messages received: ${totalReceived}`);
  console.log(`Message loss rate: ${((totalSent - totalReceived) / totalSent * 100).toFixed(2)}%`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  
  if (allLatencies.length > 0) {
    allLatencies.sort((a, b) => a - b);
    const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)];
    const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)];
    const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)];
    
    console.log(`Latency P50: ${p50}ms`);
    console.log(`Latency P95: ${p95}ms`);
    console.log(`Latency P99: ${p99}ms`);
  }
  
  // Get final server stats
  try {
    const response = await fetch('http://localhost:4008/stats');
    const serverStats = await response.json();
    
    console.log('\nServer Statistics:');
    console.log(`Total messages processed: ${serverStats.totalMessages}`);
    console.log(`Messages per second: ${serverStats.messagesPerSecond}`);
    console.log(`Server average latency: ${serverStats.avgLatency.toFixed(2)}ms`);
    console.log(`Server errors: ${serverStats.errors}`);
    
  } catch (error) {
    console.log('❌ Failed to get server stats:', error.message);
  }
  
  console.log('\n✅ Stress test completed successfully!');
  process.exit(0);
};

// Start stress test after server is ready
setTimeout(runStressTest, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down stress test...');
  server.stop();
  process.exit(0);
});