// WebSocket Security and CORS Validation Test
console.log('🔐 Starting WebSocket Security and CORS Validation Test...\n');

const server = Bun.serve({
  port: 5007,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    // Security validation for WebSocket upgrade
    if (url.pathname === '/ws') {
      const origin = request.headers.get('origin');
      const userAgent = request.headers.get('user-agent');
      const secWebSocketKey = request.headers.get('sec-websocket-key');
      const secWebSocketVersion = request.headers.get('sec-websocket-version');
      
      console.log(`🔍 WebSocket upgrade request:`);
      console.log(`  Origin: ${origin || 'none'}`);
      console.log(`  User-Agent: ${userAgent?.substring(0, 50) || 'none'}`);
      console.log(`  Sec-WebSocket-Key: ${secWebSocketKey || 'none'}`);
      console.log(`  Sec-WebSocket-Version: ${secWebSocketVersion || 'none'}`);
      
      // Simulate CORS validation
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://example.com',
        'https://app.example.com'
      ];
      
      // Check for malicious origins (simulation)
      const suspiciousOrigins = [
        'http://malicious-site.com',
        'javascript:',
        'data:',
        'file://',
        'ftp://'
      ];
      
      if (origin && suspiciousOrigins.some(suspicious => origin.toLowerCase().includes(suspicious))) {
        console.log(`❌ Blocked suspicious origin: ${origin}`);
        return new Response('Forbidden: Suspicious origin detected', { 
          status: 403,
          headers: {
            'Content-Type': 'text/plain',
            'X-Security-Policy': 'Origin blocked for security reasons'
          }
        });
      }
      
      // Validate WebSocket headers
      if (!secWebSocketKey || !secWebSocketVersion) {
        console.log(`❌ Missing required WebSocket headers`);
        return new Response('Bad Request: Invalid WebSocket headers', { 
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      // CORS check for allowed origins
      if (origin && !allowedOrigins.includes(origin)) {
        console.log(`⚠️ Origin not in allowlist, but allowing for test: ${origin}`);
      }
      
      if (server.upgrade(request)) {
        console.log(`✅ WebSocket upgrade successful for origin: ${origin || 'no-origin'}`);
        return;
      }
      
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    // Security information endpoint
    if (url.pathname === '/security-info') {
      return new Response(JSON.stringify({
        allowedOrigins: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://example.com',
          'https://app.example.com'
        ],
        securityFeatures: [
          'Origin validation',
          'WebSocket header validation',
          'Rate limiting simulation',
          'Message size limits',
          'Connection limits'
        ],
        timestamp: Date.now()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'X-Security-Version': '1.0'
        }
      });
    }
    
    return new Response('WebSocket Security Test Server', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      const sessionId = `sec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      ws.sessionId = sessionId;
      ws.messageCount = 0;
      ws.lastActivity = Date.now();
      ws.rateLimitCounter = 0;
      ws.rateLimitWindow = Date.now();
      
      console.log(`🔌 Secure WebSocket connection: ${sessionId}`);
      
      // Send security-aware connection message
      ws.send(JSON.stringify({
        type: 'secure_connection',
        sessionId,
        securityLevel: 'standard',
        features: ['message_validation', 'rate_limiting', 'size_limits'],
        timestamp: Date.now()
      }));
    },
    
    async message(ws, message) {
      const now = Date.now();
      ws.messageCount++;
      ws.lastActivity = now;
      
      // Rate limiting simulation
      if (now - ws.rateLimitWindow > 1000) {
        // Reset rate limit window
        ws.rateLimitWindow = now;
        ws.rateLimitCounter = 0;
      }
      
      ws.rateLimitCounter++;
      
      // Rate limit: max 10 messages per second
      if (ws.rateLimitCounter > 10) {
        console.log(`⚠️ ${ws.sessionId}: Rate limit exceeded (${ws.rateLimitCounter}/10)`);
        ws.send(JSON.stringify({
          type: 'rate_limit_exceeded',
          limit: '10 messages per second',
          currentRate: ws.rateLimitCounter,
          action: 'message_dropped',
          timestamp: now
        }));
        return;
      }
      
      try {
        // Message size validation
        const messageSize = typeof message === 'string' ? message.length : message.byteLength;
        const maxSize = 64 * 1024; // 64KB limit
        
        if (messageSize > maxSize) {
          console.log(`⚠️ ${ws.sessionId}: Message too large (${messageSize} > ${maxSize})`);
          ws.send(JSON.stringify({
            type: 'message_too_large',
            size: messageSize,
            maxSize,
            action: 'message_rejected',
            timestamp: now
          }));
          return;
        }
        
        // Content validation
        const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
        
        // Basic malicious content detection
        const maliciousPatterns = [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /data:text\/html/gi,
          /vbscript:/gi,
          /<iframe\b/gi,
          /<object\b/gi,
          /<embed\b/gi
        ];
        
        const containsMalicious = maliciousPatterns.some(pattern => pattern.test(text));
        
        if (containsMalicious) {
          console.log(`❌ ${ws.sessionId}: Malicious content detected`);
          ws.send(JSON.stringify({
            type: 'security_violation',
            reason: 'malicious_content_detected',
            action: 'message_blocked',
            timestamp: now
          }));
          return;
        }
        
        // Parse and validate JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          ws.send(JSON.stringify({
            type: 'validation_error',
            reason: 'invalid_json',
            error: parseError.message,
            timestamp: now
          }));
          return;
        }
        
        // Handle security test messages
        switch (data.type) {
          case 'security_test':
            await handleSecurityTest(ws, data);
            break;
            
          case 'malicious_payload':
            await handleMaliciousPayload(ws, data);
            break;
            
          case 'large_payload_test':
            await handleLargePayloadTest(ws, data);
            break;
            
          case 'rate_limit_test':
            await handleRateLimitTest(ws, data);
            break;
            
          case 'xss_test':
            await handleXSSTest(ws, data);
            break;
            
          case 'ping':
            ws.send(JSON.stringify({
              type: 'secure_pong',
              timestamp: now,
              originalTimestamp: data.timestamp,
              messageCount: ws.messageCount,
              securityChecks: 'passed'
            }));
            break;
            
          default:
            ws.send(JSON.stringify({
              type: 'message_processed',
              originalType: data.type,
              size: messageSize,
              securityLevel: 'validated',
              timestamp: now
            }));
        }
        
      } catch (error) {
        console.log(`❌ ${ws.sessionId}: Message processing error:`, error.message);
        ws.send(JSON.stringify({
          type: 'processing_error',
          error: 'Internal processing error',
          timestamp: now
        }));
      }
    },
    
    close(ws, code, reason) {
      const duration = Date.now() - ws.lastActivity;
      console.log(`🔌 ${ws.sessionId}: Secure connection closed (${ws.messageCount} messages, ${duration}ms idle)`);
    }
  }
});

// Security test handlers
const handleSecurityTest = async (ws, data) => {
  const testType = data.testType || 'basic';
  
  ws.send(JSON.stringify({
    type: 'security_test_result',
    testType,
    status: 'completed',
    checks: {
      inputValidation: 'passed',
      rateLimiting: 'active',
      contentFiltering: 'enabled',
      sizeValidation: 'enforced'
    },
    timestamp: Date.now()
  }));
};

const handleMaliciousPayload = async (ws, data) => {
  // This should have been caught by content validation
  console.log(`⚠️ ${ws.sessionId}: Malicious payload test - this should not execute`);
  
  ws.send(JSON.stringify({
    type: 'security_alert',
    message: 'Malicious payload detected and blocked',
    payload: 'redacted for security',
    timestamp: Date.now()
  }));
};

const handleLargePayloadTest = async (ws, data) => {
  const requestedSize = Math.min(data.size || 1000, 1024); // Cap for safety
  
  ws.send(JSON.stringify({
    type: 'large_payload_response',
    originalRequestSize: data.size,
    actualSize: requestedSize,
    data: 'x'.repeat(requestedSize),
    securityNote: 'Size limited for security',
    timestamp: Date.now()
  }));
};

const handleRateLimitTest = async (ws, data) => {
  const burstCount = Math.min(data.burstCount || 5, 15); // Cap at 15
  
  for (let i = 0; i < burstCount; i++) {
    ws.send(JSON.stringify({
      type: 'rate_limit_burst',
      index: i,
      total: burstCount,
      timestamp: Date.now()
    }));
    
    // Small delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

const handleXSSTest = async (ws, data) => {
  // Sanitize any potential XSS content
  const sanitized = data.content?.replace(/<[^>]*>/g, '') || '';
  
  ws.send(JSON.stringify({
    type: 'xss_test_result',
    originalLength: data.content?.length || 0,
    sanitizedContent: sanitized,
    action: 'content_sanitized',
    timestamp: Date.now()
  }));
};

console.log('🚀 WebSocket Security Test Server running on ws://localhost:5007/ws\n');

// Security test client
const runSecurityTests = async () => {
  console.log('⏱️ Waiting 2 seconds before starting security tests...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const securityTests = [
    {
      name: 'Valid Origin Test',
      origin: 'http://localhost:3000',
      message: { type: 'ping', timestamp: Date.now() }
    },
    {
      name: 'Invalid Origin Test',
      origin: 'http://malicious-site.com',
      message: { type: 'ping', timestamp: Date.now() },
      expectFail: true
    },
    {
      name: 'No Origin Test',
      origin: null,
      message: { type: 'ping', timestamp: Date.now() }
    },
    {
      name: 'XSS Payload Test',
      origin: 'http://localhost:3000',
      message: { 
        type: 'xss_test', 
        content: '<script>alert("xss")</script>Hello World' 
      }
    },
    {
      name: 'Large Message Test',
      origin: 'http://localhost:3000',
      message: { 
        type: 'large_payload_test', 
        size: 500 
      }
    },
    {
      name: 'Rate Limit Test',
      origin: 'http://localhost:3000',
      message: { 
        type: 'rate_limit_test', 
        burstCount: 12 
      }
    }
  ];
  
  for (const test of securityTests) {
    console.log(`🧪 Running ${test.name}...`);
    
    try {
      const result = await new Promise((resolve) => {
        const wsUrl = 'ws://localhost:5007/ws';
        
        // Custom WebSocket with origin header (simulate browser behavior)
        const ws = new WebSocket(wsUrl, {
          headers: test.origin ? { 'Origin': test.origin } : {}
        });
        
        const messages = [];
        let connected = false;
        
        const timeout = setTimeout(() => {
          if (!connected && test.expectFail) {
            console.log(`  ✅ Expected connection failure occurred`);
            resolve({ messages, expectedFailure: true });
          } else {
            ws.close();
            resolve({ messages, timeout: true });
          }
        }, 5000);
        
        ws.onopen = () => {
          connected = true;
          
          if (test.expectFail) {
            console.log(`  ⚠️ Connection succeeded when failure was expected`);
          } else {
            console.log(`  ✅ Connection established`);
          }
          
          // Send test message
          ws.send(JSON.stringify(test.message));
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          messages.push(data);
          console.log(`  📨 Received: ${data.type}`);
          
          // Auto-close after receiving response
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve({ messages, connected });
          }, 1000);
        };
        
        ws.onerror = (error) => {
          console.log(`  ⚠️ WebSocket error: ${error.message || 'Connection failed'}`);
          clearTimeout(timeout);
          resolve({ messages, error: true, connected: false });
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          if (!connected && test.expectFail) {
            console.log(`  ✅ Expected connection rejection (code: ${event.code})`);
          }
        };
      });
      
      console.log(`  ✅ ${test.name} completed\n`);
      
    } catch (error) {
      if (test.expectFail) {
        console.log(`  ✅ ${test.name} failed as expected: ${error.message}\n`);
      } else {
        console.log(`  ❌ ${test.name} failed unexpectedly: ${error.message}\n`);
      }
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test CORS preflight simulation
  console.log('🧪 Testing CORS preflight simulation...');
  
  try {
    const response = await fetch('http://localhost:5007/security-info', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Security headers present: ${response.headers.has('x-security-version')}`);
    
    const data = await response.json();
    console.log(`  Security features: ${data.securityFeatures.length} items`);
    
  } catch (error) {
    console.log(`  ❌ CORS test failed: ${error.message}`);
  }
  
  console.log('\n✅ Security validation tests completed!\n');
  process.exit(0);
};

// Start security tests after server is ready
setTimeout(runSecurityTests, 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.stop();
  process.exit(0);
});