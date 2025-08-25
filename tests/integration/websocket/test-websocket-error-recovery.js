// WebSocket Error Handling and Recovery Test
console.log('🔧 Starting WebSocket Error Handling and Recovery Test...\n');

const server = Bun.serve({
  port: 5006,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      // Simulate connection failures
      const shouldFail = url.searchParams.get('fail');
      if (shouldFail === 'upgrade') {
        return new Response('Simulated upgrade failure', { status: 500 });
      }
      
      if (server.upgrade(request)) {
        return;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    return new Response('WebSocket Error Recovery Test Server', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      ws.connectionId = connectionId;
      ws.messageCount = 0;
      ws.errorCount = 0;
      ws.connectedAt = Date.now();
      
      console.log(`🔌 Connection opened: ${connectionId}`);
      
      // Send connection info
      ws.send(JSON.stringify({
        type: 'connection_established',
        connectionId,
        timestamp: Date.now(),
        serverCapabilities: ['error_simulation', 'recovery_testing', 'graceful_degradation']
      }));
    },
    
    async message(ws, message) {
      ws.messageCount++;
      
      try {
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        let data;
        
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          // Handle malformed JSON gracefully
          console.log(`⚠️ ${ws.connectionId}: Malformed JSON received`);
          ws.send(JSON.stringify({
            type: 'parse_error',
            error: 'Invalid JSON format',
            received: text.substring(0, 100),
            suggestion: 'Please send valid JSON messages',
            timestamp: Date.now()
          }));
          return;
        }
        
        console.log(`📨 ${ws.connectionId}: Processing ${data.type} message`);
        
        // Handle different error scenarios
        switch (data.type) {
          case 'trigger_error':
            await handleErrorTrigger(ws, data);
            break;
            
          case 'memory_stress':
            await handleMemoryStress(ws, data);
            break;
            
          case 'connection_flood':
            await handleConnectionFlood(ws, data);
            break;
            
          case 'invalid_operation':
            await handleInvalidOperation(ws, data);
            break;
            
          case 'recovery_test':
            await handleRecoveryTest(ws, data);
            break;
            
          case 'graceful_close':
            await handleGracefulClose(ws, data);
            break;
            
          case 'ping':
            // Standard ping/pong for connectivity testing
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now(),
              originalTimestamp: data.timestamp,
              messageCount: ws.messageCount
            }));
            break;
            
          default:
            // Unknown message type
            ws.send(JSON.stringify({
              type: 'unknown_message_type',
              receivedType: data.type,
              suggestion: 'Supported types: trigger_error, memory_stress, connection_flood, invalid_operation, recovery_test, graceful_close, ping',
              timestamp: Date.now()
            }));
        }
        
      } catch (error) {
        ws.errorCount++;
        console.log(`❌ ${ws.connectionId}: Message processing error:`, error.message);
        
        // Send error response
        try {
          ws.send(JSON.stringify({
            type: 'processing_error',
            error: error.message,
            errorCount: ws.errorCount,
            messageCount: ws.messageCount,
            timestamp: Date.now()
          }));
        } catch (sendError) {
          console.log(`❌ ${ws.connectionId}: Failed to send error response:`, sendError.message);
        }
      }
    },
    
    close(ws, code, reason) {
      const duration = Date.now() - ws.connectedAt;
      console.log(`🔌 ${ws.connectionId}: Connection closed (code: ${code}, reason: ${reason}, duration: ${duration}ms)`);
      console.log(`   Stats: ${ws.messageCount} messages, ${ws.errorCount} errors`);
    }
  }
});

// Error handling functions
const handleErrorTrigger = async (ws, data) => {
  const errorType = data.errorType || 'generic';
  
  switch (errorType) {
    case 'throw_exception':
      throw new Error('Simulated server exception');
      
    case 'json_error':
      // Send invalid JSON (this will be handled by client)
      ws.send('{ "invalid": json }');
      break;
      
    case 'large_payload':
      // Send extremely large payload
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
      ws.send(JSON.stringify({
        type: 'large_response',
        data: largeData,
        size: largeData.length,
        timestamp: Date.now()
      }));
      break;
      
    case 'rapid_messages':
      // Send many messages rapidly
      for (let i = 0; i < 1000; i++) {
        ws.send(JSON.stringify({
          type: 'rapid_message',
          index: i,
          timestamp: Date.now()
        }));
      }
      break;
      
    case 'close_connection':
      ws.close(1011, 'Simulated server error');
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error_triggered',
        errorType,
        message: 'Simulated error completed',
        timestamp: Date.now()
      }));
  }
};

const handleMemoryStress = async (ws, data) => {
  const iterations = Math.min(data.iterations || 10, 100); // Cap at 100 for safety
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Create temporary large objects
    const tempData = new Array(10000).fill(`iteration_${i}_data`);
    results.push({
      iteration: i,
      memoryUsed: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    });
    
    // Send progress
    ws.send(JSON.stringify({
      type: 'memory_stress_progress',
      iteration: i,
      totalIterations: iterations,
      memoryUsed: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    }));
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  ws.send(JSON.stringify({
    type: 'memory_stress_complete',
    results: results.slice(-5), // Send last 5 results only
    finalMemory: process.memoryUsage(),
    timestamp: Date.now()
  }));
};

const handleConnectionFlood = async (ws, data) => {
  const messageCount = Math.min(data.count || 50, 500); // Cap at 500
  
  ws.send(JSON.stringify({
    type: 'flood_start',
    messageCount,
    timestamp: Date.now()
  }));
  
  // Send messages in batches to avoid overwhelming
  const batchSize = 10;
  for (let i = 0; i < messageCount; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && (i + j) < messageCount; j++) {
      batch.push({
        index: i + j,
        data: `flood_message_${i + j}`,
        timestamp: Date.now()
      });
    }
    
    ws.send(JSON.stringify({
      type: 'flood_batch',
      batch,
      batchIndex: Math.floor(i / batchSize),
      timestamp: Date.now()
    }));
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  
  ws.send(JSON.stringify({
    type: 'flood_complete',
    totalMessages: messageCount,
    timestamp: Date.now()
  }));
};

const handleInvalidOperation = async (ws, data) => {
  const operation = data.operation || 'undefined_method';
  
  try {
    switch (operation) {
      case 'undefined_method':
        // Call undefined method
        nonExistentFunction();
        break;
        
      case 'null_reference':
        // Null reference error
        const nullObj = null;
        nullObj.someProperty.value;
        break;
        
      case 'type_error':
        // Type error
        const number = 42;
        number.split(',');
        break;
        
      case 'infinite_loop':
        // Controlled infinite loop (with timeout)
        const startTime = Date.now();
        while (Date.now() - startTime < 100) {
          // Short loop to simulate but not hang
        }
        throw new Error('Simulated infinite loop (controlled)');
        
      default:
        throw new Error(`Unknown invalid operation: ${operation}`);
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'invalid_operation_result',
      operation,
      error: error.message,
      handled: true,
      timestamp: Date.now()
    }));
  }
};

const handleRecoveryTest = async (ws, data) => {
  const scenario = data.scenario || 'reconnect';
  
  switch (scenario) {
    case 'reconnect':
      ws.send(JSON.stringify({
        type: 'recovery_instruction',
        scenario,
        instruction: 'Connection will close in 2 seconds. Please reconnect.',
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        ws.close(1012, 'Recovery test - please reconnect');
      }, 2000);
      break;
      
    case 'partial_failure':
      ws.send(JSON.stringify({
        type: 'recovery_instruction',
        scenario,
        instruction: 'Simulating partial service failure.',
        timestamp: Date.now()
      }));
      
      // Simulate intermittent failures
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (Math.random() > 0.5) {
            ws.send(JSON.stringify({
              type: 'partial_failure_message',
              index: i,
              success: true,
              timestamp: Date.now()
            }));
          } else {
            // Simulate failure by not sending anything
            console.log(`${ws.connectionId}: Simulated partial failure at index ${i}`);
          }
        }, i * 1000);
      }
      break;
      
    case 'slow_response':
      ws.send(JSON.stringify({
        type: 'recovery_instruction',
        scenario,
        instruction: 'Simulating slow responses.',
        timestamp: Date.now()
      }));
      
      // Send delayed responses
      const delays = [500, 1000, 2000, 5000];
      delays.forEach((delay, index) => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'slow_response_message',
            index,
            delay,
            timestamp: Date.now()
          }));
        }, delay);
      });
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'recovery_test_error',
        error: `Unknown recovery scenario: ${scenario}`,
        availableScenarios: ['reconnect', 'partial_failure', 'slow_response'],
        timestamp: Date.now()
      }));
  }
};

const handleGracefulClose = async (ws, data) => {
  const delay = Math.min(data.delay || 1000, 10000); // Max 10 seconds
  
  ws.send(JSON.stringify({
    type: 'graceful_close_initiated',
    delay,
    message: `Connection will close gracefully in ${delay}ms`,
    timestamp: Date.now()
  }));
  
  // Send countdown messages
  const countdownInterval = Math.max(delay / 10, 100);
  let remaining = delay;
  
  const countdown = setInterval(() => {
    remaining -= countdownInterval;
    
    if (remaining > 0) {
      ws.send(JSON.stringify({
        type: 'graceful_close_countdown',
        remaining,
        timestamp: Date.now()
      }));
    } else {
      clearInterval(countdown);
      ws.send(JSON.stringify({
        type: 'graceful_close_final',
        message: 'Goodbye!',
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        ws.close(1000, 'Graceful close completed');
      }, 100);
    }
  }, countdownInterval);
};

console.log('🚀 WebSocket Error Recovery Test Server running on ws://localhost:5006/ws\n');

// Test client for error scenarios
const runErrorRecoveryTests = async () => {
  console.log('⏱️ Waiting 2 seconds before starting tests...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const errorTests = [
    {
      name: 'Malformed JSON Test',
      message: '{ invalid json structure }'
    },
    {
      name: 'Exception Trigger Test',
      message: { type: 'trigger_error', errorType: 'throw_exception' }
    },
    {
      name: 'Invalid Operation Test',
      message: { type: 'invalid_operation', operation: 'undefined_method' }
    },
    {
      name: 'Connection Recovery Test',
      message: { type: 'recovery_test', scenario: 'reconnect' }
    },
    {
      name: 'Graceful Close Test',
      message: { type: 'graceful_close', delay: 2000 }
    }
  ];
  
  for (const test of errorTests) {
    console.log(`🧪 Running ${test.name}...`);
    
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:5006/ws');
        const messages = [];
        let connected = false;
        
        const timeout = setTimeout(() => {
          if (connected) {
            console.log(`  ⏱️ ${test.name} timed out (this may be expected)`);
            ws.close();
          }
          resolve({ messages, timedOut: true });
        }, 8000);
        
        ws.onopen = () => {
          connected = true;
          console.log(`  ✅ Connected for ${test.name}`);
          
          // Send test message
          if (typeof test.message === 'string') {
            ws.send(test.message);
          } else {
            ws.send(JSON.stringify(test.message));
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            messages.push(data);
            console.log(`  📨 Received: ${data.type}`);
            
            // Auto-close for certain message types
            if (['processing_error', 'invalid_operation_result', 'graceful_close_final'].includes(data.type)) {
              setTimeout(() => {
                clearTimeout(timeout);
                ws.close();
                resolve({ messages });
              }, 1000);
            }
          } catch (parseError) {
            console.log(`  ⚠️ Received unparseable message (expected for some tests)`);
            messages.push({ type: 'unparseable', raw: event.data });
          }
        };
        
        ws.onerror = (error) => {
          console.log(`  ⚠️ WebSocket error (may be expected): ${error.message || 'Unknown error'}`);
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`  🔌 ${test.name} connection closed (code: ${event.code})`);
          resolve({ messages, closeCode: event.code, closeReason: event.reason });
        };
      });
      
      console.log(`  ✅ ${test.name} completed\n`);
      
    } catch (error) {
      console.log(`  ❌ ${test.name} failed:`, error.message, '\n');
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Error recovery tests completed!\n');
  process.exit(0);
};

// Start tests after server is ready
setTimeout(runErrorRecoveryTests, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.stop();
  process.exit(0);
});