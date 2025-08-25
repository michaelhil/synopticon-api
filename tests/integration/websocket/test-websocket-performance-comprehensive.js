// Comprehensive WebSocket Performance Test
console.log('⚡ Starting Comprehensive WebSocket Performance Test...\n');

const server = Bun.serve({
  port: 5008,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      if (server.upgrade(request)) {
        return;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    if (url.pathname === '/metrics') {
      return new Response(JSON.stringify({
        activeConnections: serverMetrics.activeConnections,
        totalMessages: serverMetrics.totalMessages,
        avgProcessingTime: serverMetrics.avgProcessingTime,
        peakConnections: serverMetrics.peakConnections,
        memoryUsage: process.memoryUsage(),
        uptime: Date.now() - serverMetrics.startTime,
        messagesPerSecond: serverMetrics.messagesPerSecond
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('WebSocket Performance Test Server', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      const connectionId = `perf_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      ws.connectionId = connectionId;
      ws.messageCount = 0;
      ws.totalProcessingTime = 0;
      ws.connectedAt = Date.now();
      
      serverMetrics.activeConnections++;
      serverMetrics.totalConnections++;
      serverMetrics.peakConnections = Math.max(serverMetrics.peakConnections, serverMetrics.activeConnections);
      
      console.log(`🔌 Performance connection: ${connectionId} (${serverMetrics.activeConnections} active)`);
      
      // Send performance-oriented welcome message
      ws.send(JSON.stringify({
        type: 'performance_ready',
        connectionId,
        serverTime: Date.now(),
        connectionIndex: serverMetrics.totalConnections,
        capabilities: ['high_throughput', 'latency_measurement', 'batch_processing']
      }));
    },
    
    async message(ws, message) {
      const startTime = process.hrtime.bigint();
      
      try {
        ws.messageCount++;
        serverMetrics.totalMessages++;
        
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        const data = JSON.parse(text);
        
        // Handle performance test messages
        switch (data.type) {
          case 'latency_ping':
            await handleLatencyPing(ws, data, startTime);
            break;
            
          case 'throughput_test':
            await handleThroughputTest(ws, data, startTime);
            break;
            
          case 'batch_process':
            await handleBatchProcess(ws, data, startTime);
            break;
            
          case 'memory_test':
            await handleMemoryTest(ws, data, startTime);
            break;
            
          case 'concurrent_test':
            await handleConcurrentTest(ws, data, startTime);
            break;
            
          case 'binary_performance':
            await handleBinaryPerformance(ws, data, startTime);
            break;
            
          default:
            // Standard echo with timing
            const endTime = process.hrtime.bigint();
            const processingTimeNs = endTime - startTime;
            const processingTimeMs = Number(processingTimeNs) / 1000000;
            
            ws.totalProcessingTime += processingTimeMs;
            
            ws.send(JSON.stringify({
              type: 'echo_response',
              originalMessage: data,
              processingTime: processingTimeMs,
              messageIndex: ws.messageCount,
              timestamp: Date.now()
            }));
        }
        
        // Update server metrics
        const endTime = process.hrtime.bigint();
        const processingTimeMs = Number(endTime - startTime) / 1000000;
        updateServerMetrics(processingTimeMs);
        
      } catch (error) {
        console.log(`❌ ${ws.connectionId}: Performance test error:`, error.message);
        ws.send(JSON.stringify({
          type: 'performance_error',
          error: error.message,
          timestamp: Date.now()
        }));
      }
    },
    
    close(ws) {
      serverMetrics.activeConnections--;
      const duration = Date.now() - ws.connectedAt;
      const avgProcessingTime = ws.messageCount > 0 ? ws.totalProcessingTime / ws.messageCount : 0;
      
      console.log(`🔌 ${ws.connectionId}: Performance connection closed`);
      console.log(`   Duration: ${duration}ms, Messages: ${ws.messageCount}, Avg processing: ${avgProcessingTime.toFixed(2)}ms`);
    }
  }
});

// Server metrics
const serverMetrics = {
  startTime: Date.now(),
  activeConnections: 0,
  totalConnections: 0,
  peakConnections: 0,
  totalMessages: 0,
  totalProcessingTime: 0,
  messagesPerSecond: 0,
  avgProcessingTime: 0
};

const updateServerMetrics = (processingTimeMs) => {
  serverMetrics.totalProcessingTime += processingTimeMs;
  serverMetrics.avgProcessingTime = serverMetrics.totalProcessingTime / serverMetrics.totalMessages;
  
  // Calculate messages per second
  const elapsed = (Date.now() - serverMetrics.startTime) / 1000;
  serverMetrics.messagesPerSecond = Math.round(serverMetrics.totalMessages / elapsed);
};

// Performance test handlers
const handleLatencyPing = async (ws, data, startTime) => {
  // Minimal processing for accurate latency measurement
  const serverTime = Date.now();
  const endTime = process.hrtime.bigint();
  const processingTimeNs = Number(endTime - startTime);
  
  ws.send(JSON.stringify({
    type: 'latency_pong',
    clientTimestamp: data.timestamp,
    serverTimestamp: serverTime,
    processingTimeNs,
    roundTripId: data.roundTripId
  }));
};

const handleThroughputTest = async (ws, data, startTime) => {
  const messageCount = Math.min(data.count || 100, 1000); // Cap at 1000
  const batchSize = Math.min(data.batchSize || 10, 50);
  
  ws.send(JSON.stringify({
    type: 'throughput_start',
    messageCount,
    batchSize,
    timestamp: Date.now()
  }));
  
  // Send messages in batches
  for (let i = 0; i < messageCount; i += batchSize) {
    const batch = [];
    const batchEnd = Math.min(i + batchSize, messageCount);
    
    for (let j = i; j < batchEnd; j++) {
      batch.push({
        index: j,
        data: `throughput_message_${j}`,
        timestamp: Date.now()
      });
    }
    
    ws.send(JSON.stringify({
      type: 'throughput_batch',
      batch,
      batchIndex: Math.floor(i / batchSize),
      progress: (batchEnd / messageCount * 100).toFixed(1)
    }));
    
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1000000;
  
  ws.send(JSON.stringify({
    type: 'throughput_complete',
    messageCount,
    totalTimeMs,
    messagesPerSecond: Math.round(messageCount / (totalTimeMs / 1000)),
    timestamp: Date.now()
  }));
};

const handleBatchProcess = async (ws, data, startTime) => {
  const items = data.items || [];
  const processingDelay = Math.min(data.processingDelay || 1, 10); // Max 10ms delay
  
  const results = [];
  
  for (const item of items) {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, processingDelay));
    
    results.push({
      original: item,
      processed: `processed_${item}`,
      timestamp: Date.now()
    });
  }
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1000000;
  
  ws.send(JSON.stringify({
    type: 'batch_complete',
    itemCount: items.length,
    results: results.slice(0, 5), // Send first 5 results only
    totalTimeMs,
    avgTimePerItem: totalTimeMs / items.length,
    timestamp: Date.now()
  }));
};

const handleMemoryTest = async (ws, data, startTime) => {
  const iterations = Math.min(data.iterations || 10, 50);
  const memorySnapshots = [];
  
  for (let i = 0; i < iterations; i++) {
    // Create temporary data structures
    const tempArray = new Array(1000).fill(`memory_test_${i}`);
    const tempObject = {
      iteration: i,
      data: tempArray,
      timestamp: Date.now()
    };
    
    memorySnapshots.push({
      iteration: i,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    });
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1000000;
  
  ws.send(JSON.stringify({
    type: 'memory_test_complete',
    iterations,
    totalTimeMs,
    memorySnapshots: memorySnapshots.slice(-3), // Last 3 snapshots
    finalMemory: process.memoryUsage(),
    timestamp: Date.now()
  }));
};

const handleConcurrentTest = async (ws, data, startTime) => {
  const taskCount = Math.min(data.taskCount || 5, 20);
  const tasks = [];
  
  // Create concurrent tasks
  for (let i = 0; i < taskCount; i++) {
    tasks.push(new Promise(async (resolve) => {
      const taskStartTime = Date.now();
      
      // Simulate concurrent work
      await new Promise(taskResolve => setTimeout(taskResolve, Math.random() * 100));
      
      resolve({
        taskId: i,
        duration: Date.now() - taskStartTime,
        completed: Date.now()
      });
    }));
  }
  
  // Wait for all tasks
  const results = await Promise.all(tasks);
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1000000;
  
  ws.send(JSON.stringify({
    type: 'concurrent_test_complete',
    taskCount,
    totalTimeMs,
    results,
    avgTaskDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    timestamp: Date.now()
  }));
};

const handleBinaryPerformance = async (ws, data, startTime) => {
  const size = Math.min(data.size || 1024, 10240); // Max 10KB
  
  // Create binary data
  const binaryData = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    binaryData[i] = i % 256;
  }
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1000000;
  
  // Send binary data back as base64 in JSON
  ws.send(JSON.stringify({
    type: 'binary_performance_complete',
    originalSize: size,
    processingTime: totalTimeMs,
    dataPreview: Array.from(binaryData.slice(0, 10)),
    timestamp: Date.now()
  }));
};

console.log('🚀 WebSocket Performance Test Server running on ws://localhost:5008/ws');
console.log('📊 Metrics endpoint: http://localhost:5008/metrics\n');

// Performance test client
const runPerformanceTests = async () => {
  console.log('⏱️ Waiting 2 seconds before starting performance tests...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const performanceTests = [
    {
      name: 'Latency Measurement Test',
      type: 'latency',
      config: { pings: 10, interval: 100 }
    },
    {
      name: 'Throughput Test',
      type: 'throughput',
      config: { messageCount: 100, batchSize: 10 }
    },
    {
      name: 'Batch Processing Test',
      type: 'batch',
      config: { items: ['item1', 'item2', 'item3', 'item4', 'item5'], processingDelay: 2 }
    },
    {
      name: 'Memory Performance Test',
      type: 'memory',
      config: { iterations: 20 }
    },
    {
      name: 'Concurrent Operations Test',
      type: 'concurrent',
      config: { taskCount: 10 }
    },
    {
      name: 'Binary Data Performance Test',
      type: 'binary',
      config: { size: 2048 }
    }
  ];
  
  const allResults = [];
  
  for (const test of performanceTests) {
    console.log(`⚡ Running ${test.name}...`);
    
    try {
      const result = await new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:5008/ws');
        const startTime = Date.now();
        const results = [];
        let latencies = [];
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ results, timeout: true, duration: Date.now() - startTime });
        }, 15000);
        
        ws.onopen = () => {
          console.log(`  ✅ Connected for ${test.name}`);
          
          switch (test.type) {
            case 'latency':
              // Send multiple pings for latency testing
              for (let i = 0; i < test.config.pings; i++) {
                setTimeout(() => {
                  const pingTime = Date.now();
                  ws.send(JSON.stringify({
                    type: 'latency_ping',
                    timestamp: pingTime,
                    roundTripId: i
                  }));
                }, i * test.config.interval);
              }
              break;
              
            default:
              ws.send(JSON.stringify({
                type: test.type === 'throughput' ? 'throughput_test' :
                      test.type === 'batch' ? 'batch_process' :
                      test.type === 'memory' ? 'memory_test' :
                      test.type === 'concurrent' ? 'concurrent_test' :
                      test.type === 'binary' ? 'binary_performance' : 'unknown',
                ...test.config
              }));
          }
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          results.push(data);
          
          if (data.type === 'latency_pong') {
            const latency = Date.now() - data.clientTimestamp;
            latencies.push(latency);
            console.log(`  📊 Ping ${data.roundTripId}: ${latency}ms`);
            
            if (latencies.length >= test.config.pings) {
              clearTimeout(timeout);
              ws.close();
              
              const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
              const minLatency = Math.min(...latencies);
              const maxLatency = Math.max(...latencies);
              
              resolve({
                results,
                latencies: { avg: avgLatency, min: minLatency, max: maxLatency },
                duration: Date.now() - startTime
              });
            }
          }
          
          if (data.type.includes('_complete')) {
            console.log(`  📊 ${test.name} completed`);
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve({ results, duration: Date.now() - startTime });
            }, 500);
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        ws.onclose = () => {
          console.log(`  🔌 ${test.name} connection closed\n`);
        };
      });
      
      allResults.push({ test: test.name, ...result });
      
    } catch (error) {
      console.log(`  ❌ ${test.name} failed:`, error.message, '\n');
      allResults.push({ test: test.name, error: error.message });
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Get server metrics
  console.log('📊 Fetching server metrics...');
  try {
    const response = await fetch('http://localhost:5008/metrics');
    const metrics = await response.json();
    
    console.log('\n📊 SERVER PERFORMANCE METRICS');
    console.log('==============================');
    console.log(`Active connections: ${metrics.activeConnections}`);
    console.log(`Peak connections: ${metrics.peakConnections}`);
    console.log(`Total messages: ${metrics.totalMessages}`);
    console.log(`Messages per second: ${metrics.messagesPerSecond}`);
    console.log(`Average processing time: ${metrics.avgProcessingTime.toFixed(2)}ms`);
    console.log(`Memory usage: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`Server uptime: ${Math.round(metrics.uptime / 1000)}s`);
  } catch (error) {
    console.log('❌ Failed to fetch server metrics:', error.message);
  }
  
  // Performance summary
  console.log('\n⚡ PERFORMANCE TEST SUMMARY');
  console.log('============================');
  
  for (const result of allResults) {
    if (result.error) {
      console.log(`❌ ${result.test}: FAILED - ${result.error}`);
      continue;
    }
    
    console.log(`✅ ${result.test}:`);
    console.log(`   Duration: ${result.duration}ms`);
    
    if (result.latencies) {
      console.log(`   Avg Latency: ${result.latencies.avg.toFixed(2)}ms`);
      console.log(`   Min/Max Latency: ${result.latencies.min}ms/${result.latencies.max}ms`);
    }
    
    const completionMessage = result.results.find(r => r.type.includes('_complete'));
    if (completionMessage) {
      if (completionMessage.messagesPerSecond) {
        console.log(`   Throughput: ${completionMessage.messagesPerSecond} msg/s`);
      }
      if (completionMessage.avgTimePerItem) {
        console.log(`   Avg processing time: ${completionMessage.avgTimePerItem.toFixed(2)}ms/item`);
      }
    }
  }
  
  console.log('\n✅ Performance testing completed!\n');
  process.exit(0);
};

// Start performance tests
setTimeout(runPerformanceTests, 1000);

// Server metrics logging
setInterval(() => {
  if (serverMetrics.activeConnections > 0) {
    console.log(`📊 Active: ${serverMetrics.activeConnections} connections, ${serverMetrics.messagesPerSecond} msg/s`);
  }
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down performance test...');
  server.stop();
  process.exit(0);
});