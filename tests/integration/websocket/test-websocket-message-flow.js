// WebSocket Message Flow and Data Handling Test
console.log('📨 Starting WebSocket Message Flow Test...\n');

const server = Bun.serve({
  port: 5005,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      if (server.upgrade(request)) {
        return;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    return new Response('WebSocket Message Flow Test Server', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      ws.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      ws.messageQueue = [];
      ws.processingQueue = false;
      
      console.log(`🔌 New WebSocket connection: ${ws.sessionId}`);
      
      // Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId: ws.sessionId,
        timestamp: Date.now(),
        capabilities: ['echo', 'batch', 'stream', 'binary', 'json']
      }));
    },
    
    async message(ws, message) {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      try {
        // Handle different message formats
        let data;
        let messageType = 'unknown';
        
        if (typeof message === 'string') {
          messageType = 'text';
          try {
            data = JSON.parse(message);
            messageType = 'json';
          } catch {
            data = { content: message };
            messageType = 'text';
          }
        } else {
          messageType = 'binary';
          const decoder = new TextDecoder();
          try {
            const text = decoder.decode(message);
            data = JSON.parse(text);
            messageType = 'binary_json';
          } catch {
            data = { 
              content: message,
              size: message.byteLength,
              preview: Array.from(message.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')
            };
          }
        }
        
        console.log(`📨 ${ws.sessionId}: Received ${messageType} message (ID: ${messageId})`);
        
        // Process different message types
        switch (data.type) {
          case 'echo':
            await handleEchoMessage(ws, data, messageId);
            break;
            
          case 'batch':
            await handleBatchMessage(ws, data, messageId);
            break;
            
          case 'stream_start':
            await handleStreamStart(ws, data, messageId);
            break;
            
          case 'stream_data':
            await handleStreamData(ws, data, messageId);
            break;
            
          case 'stream_end':
            await handleStreamEnd(ws, data, messageId);
            break;
            
          case 'large_data':
            await handleLargeData(ws, data, messageId);
            break;
            
          case 'queue_test':
            await handleQueueTest(ws, data, messageId);
            break;
            
          case 'error_test':
            await handleErrorTest(ws, data, messageId);
            break;
            
          default:
            // Generic message handling
            ws.send(JSON.stringify({
              type: 'message_received',
              messageId,
              originalType: data.type || 'unknown',
              messageType,
              size: typeof message === 'string' ? message.length : message.byteLength,
              timestamp: Date.now()
            }));
        }
        
      } catch (error) {
        console.log(`❌ ${ws.sessionId}: Message processing error:`, error.message);
        ws.send(JSON.stringify({
          type: 'error',
          messageId,
          error: error.message,
          timestamp: Date.now()
        }));
      }
    },
    
    close(ws, code, reason) {
      console.log(`🔌 ${ws.sessionId}: Connection closed (code: ${code}, reason: ${reason})`);
    }
  }
});

// Message handlers
const handleEchoMessage = async (ws, data, messageId) => {
  const delay = data.delay || 0;
  
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  ws.send(JSON.stringify({
    type: 'echo_response',
    messageId,
    echo: data.content,
    delay,
    timestamp: Date.now()
  }));
};

const handleBatchMessage = async (ws, data, messageId) => {
  const items = data.items || [];
  const batchId = `batch_${Date.now()}`;
  
  // Send batch start
  ws.send(JSON.stringify({
    type: 'batch_start',
    messageId,
    batchId,
    itemCount: items.length,
    timestamp: Date.now()
  }));
  
  // Process each item with small delay
  for (let i = 0; i < items.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    ws.send(JSON.stringify({
      type: 'batch_item',
      messageId,
      batchId,
      itemIndex: i,
      item: items[i],
      processed: `${items[i]}_processed`,
      timestamp: Date.now()
    }));
  }
  
  // Send batch complete
  ws.send(JSON.stringify({
    type: 'batch_complete',
    messageId,
    batchId,
    totalItems: items.length,
    timestamp: Date.now()
  }));
};

const handleStreamStart = async (ws, data, messageId) => {
  ws.streamId = data.streamId || `stream_${Date.now()}`;
  ws.streamData = [];
  
  ws.send(JSON.stringify({
    type: 'stream_started',
    messageId,
    streamId: ws.streamId,
    timestamp: Date.now()
  }));
};

const handleStreamData = async (ws, data, messageId) => {
  if (!ws.streamId) {
    ws.send(JSON.stringify({
      type: 'error',
      messageId,
      error: 'No active stream. Call stream_start first.',
      timestamp: Date.now()
    }));
    return;
  }
  
  ws.streamData = ws.streamData || [];
  ws.streamData.push(data.chunk);
  
  ws.send(JSON.stringify({
    type: 'stream_chunk_received',
    messageId,
    streamId: ws.streamId,
    chunkIndex: ws.streamData.length - 1,
    totalChunks: ws.streamData.length,
    timestamp: Date.now()
  }));
};

const handleStreamEnd = async (ws, data, messageId) => {
  if (!ws.streamId) {
    ws.send(JSON.stringify({
      type: 'error',
      messageId,
      error: 'No active stream to end.',
      timestamp: Date.now()
    }));
    return;
  }
  
  const streamData = ws.streamData || [];
  const combinedData = streamData.join('');
  
  ws.send(JSON.stringify({
    type: 'stream_complete',
    messageId,
    streamId: ws.streamId,
    totalChunks: streamData.length,
    combinedSize: combinedData.length,
    result: `Processed: ${combinedData}`,
    timestamp: Date.now()
  }));
  
  // Clean up
  delete ws.streamId;
  delete ws.streamData;
};

const handleLargeData = async (ws, data, messageId) => {
  const size = data.size || 1000;
  const largeString = 'x'.repeat(size);
  
  ws.send(JSON.stringify({
    type: 'large_data_response',
    messageId,
    originalSize: size,
    response: largeString,
    timestamp: Date.now()
  }));
};

const handleQueueTest = async (ws, data, messageId) => {
  const count = data.count || 5;
  
  // Add to message queue
  ws.messageQueue.push({ messageId, count, startTime: Date.now() });
  
  // Process queue if not already processing
  if (!ws.processingQueue) {
    await processMessageQueue(ws);
  }
};

const processMessageQueue = async (ws) => {
  ws.processingQueue = true;
  
  while (ws.messageQueue.length > 0) {
    const queueItem = ws.messageQueue.shift();
    
    ws.send(JSON.stringify({
      type: 'queue_processing',
      messageId: queueItem.messageId,
      queueLength: ws.messageQueue.length + 1,
      timestamp: Date.now()
    }));
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (let i = 0; i < queueItem.count; i++) {
      ws.send(JSON.stringify({
        type: 'queue_item',
        messageId: queueItem.messageId,
        itemIndex: i,
        totalItems: queueItem.count,
        timestamp: Date.now()
      }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    ws.send(JSON.stringify({
      type: 'queue_complete',
      messageId: queueItem.messageId,
      processingTime: Date.now() - queueItem.startTime,
      timestamp: Date.now()
    }));
  }
  
  ws.processingQueue = false;
};

const handleErrorTest = async (ws, data, messageId) => {
  const errorType = data.errorType || 'generic';
  
  switch (errorType) {
    case 'json_error':
      // Send invalid JSON
      ws.send('{ invalid json }');
      break;
      
    case 'large_error':
      // Send very large message
      const largeData = 'x'.repeat(1000000);
      ws.send(JSON.stringify({
        type: 'large_message',
        messageId,
        data: largeData,
        timestamp: Date.now()
      }));
      break;
      
    case 'rapid_fire':
      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        ws.send(JSON.stringify({
          type: 'rapid_message',
          messageId,
          index: i,
          timestamp: Date.now()
        }));
      }
      break;
      
    default:
      throw new Error(`Simulated error: ${errorType}`);
  }
};

console.log('🚀 WebSocket Message Flow Test Server running on ws://localhost:5005/ws\n');

// Test client for message flow
const runMessageFlowTests = async () => {
  console.log('⏱️ Waiting 2 seconds before starting tests...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const tests = [
    {
      name: 'Echo Test',
      message: { type: 'echo', content: 'Hello WebSocket!', delay: 100 }
    },
    {
      name: 'Batch Processing Test',
      message: { type: 'batch', items: ['item1', 'item2', 'item3', 'item4'] }
    },
    {
      name: 'Streaming Test',
      messages: [
        { type: 'stream_start', streamId: 'test_stream_1' },
        { type: 'stream_data', chunk: 'chunk1' },
        { type: 'stream_data', chunk: 'chunk2' },
        { type: 'stream_data', chunk: 'chunk3' },
        { type: 'stream_end' }
      ]
    },
    {
      name: 'Large Data Test',
      message: { type: 'large_data', size: 5000 }
    },
    {
      name: 'Queue Test',
      message: { type: 'queue_test', count: 3 }
    },
    {
      name: 'Binary Message Test',
      binary: true,
      message: { type: 'echo', content: 'Binary message test' }
    }
  ];
  
  for (const test of tests) {
    console.log(`🧪 Running ${test.name}...`);
    
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:5005/ws');
        const results = [];
        let testStartTime = Date.now();
        
        ws.onopen = () => {
          console.log(`  ✅ Connected for ${test.name}`);
          
          if (test.messages) {
            // Send multiple messages
            test.messages.forEach((msg, index) => {
              setTimeout(() => {
                ws.send(JSON.stringify(msg));
              }, index * 200);
            });
          } else {
            // Send single message
            const message = JSON.stringify(test.message);
            if (test.binary) {
              const encoder = new TextEncoder();
              ws.send(encoder.encode(message));
            } else {
              ws.send(message);
            }
          }
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          results.push(data);
          console.log(`  📨 Received: ${data.type}`);
          
          // Check if test is complete
          const completionTypes = ['echo_response', 'batch_complete', 'stream_complete', 
                                 'large_data_response', 'queue_complete'];
          if (completionTypes.includes(data.type)) {
            setTimeout(() => {
              ws.close();
              resolve({ results, duration: Date.now() - testStartTime });
            }, 500);
          }
        };
        
        ws.onerror = (error) => {
          console.log(`  ❌ Error in ${test.name}`);
          reject(error);
        };
        
        ws.onclose = () => {
          console.log(`  🔌 ${test.name} completed\n`);
        };
        
        // Timeout
        setTimeout(() => {
          ws.close();
          resolve({ results, duration: Date.now() - testStartTime, timeout: true });
        }, 10000);
      });
      
    } catch (error) {
      console.log(`  ❌ ${test.name} failed:`, error.message, '\n');
    }
  }
  
  console.log('✅ Message flow tests completed!\n');
  
  // Test error conditions
  console.log('🧪 Testing error conditions...\n');
  
  try {
    await new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:5005/ws');
      
      ws.onopen = () => {
        console.log('  📤 Sending malformed JSON...');
        ws.send('{ malformed json }');
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 1000);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`  📨 Error handling response: ${data.type}`);
      };
      
      ws.onclose = () => {
        console.log('  ✅ Error handling test completed\n');
      };
    });
  } catch (error) {
    console.log('  ❌ Error handling test failed\n');
  }
  
  process.exit(0);
};

// Start tests after server is ready
setTimeout(runMessageFlowTests, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.stop();
  process.exit(0);
});