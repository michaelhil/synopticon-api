/**
 * Synopticon API Server - Bun.serve Version
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * RESTful API with WebSocket streaming for real-time multi-modal behavioral analysis
 * Uses Bun.serve for optimal performance with integrated WebSocket support
 */

import { parseRequestURL } from '../../shared/utils/url-utils.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { createStrategyRegistry } from '../../core/strategies.js';
import { createAnalysisRequirements } from '../../core/types.js';

// Secure ID generation using Bun's crypto
const generateSecureId = (prefix = '') => {
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
};

// Secure CORS configuration
const getAllowedOrigins = () => {
  const origins = process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
  return origins.split(',').map(o => o.trim());
};

const createCORSHeaders = (request, origin = null) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get('origin');
  
  if (!origin && requestOrigin && allowedOrigins.includes(requestOrigin)) {
    origin = requestOrigin;
  } else if (!origin) {
    origin = allowedOrigins[0];
  }
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'false',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
};

// HTTP response utilities using Web API Response
const createJSONResponse = (data, status = 200, headers = {}) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
};

const createErrorResponse = (message, status = 400, headers = {}) => {
  return createJSONResponse({ error: message, timestamp: Date.now() }, status, headers);
};

const createSuccessResponse = (data = {}, headers = {}) => {
  return createJSONResponse({ success: true, ...data, timestamp: Date.now() }, 200, headers);
};

// Route handling with URL patterns
const createRouter = () => {
  const routes = new Map();
  
  const add = (method, pattern, handler) => {
    const key = `${method}:${pattern}`;
    routes.set(key, { pattern: new RegExp(pattern), handler });
  };
  
  const match = (method, pathname) => {
    for (const [key, route] of routes) {
      if (key.startsWith(method + ':')) {
        const match = pathname.match(route.pattern);
        if (match) {
          return { handler: route.handler, params: match.groups || {} };
        }
      }
    }
    return null;
  };
  
  return { add, match };
};

// WebSocket session management
const createWebSocketManager = (orchestrator) => {
  const sessions = new Map();
  
  const handleConnection = (ws) => {
    const sessionId = generateSecureId('session');
    const session = {
      id: sessionId,
      ws,
      requirements: {
        capabilities: ['face_detection'],
        strategy: 'performance_first',
        realtime: true
      },
      isProcessing: false,
      frameCount: 0,
      lastFrameTime: 0
    };
    
    sessions.set(sessionId, session);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      capabilities: orchestrator.getRegisteredPipelines().map(p => p.name),
      timestamp: Date.now()
    }));
    
    return session;
  };
  
  const handleMessage = async (ws, data) => {
    // Find session for this WebSocket
    let session = null;
    for (const [id, s] of sessions) {
      if (s.ws === ws) {
        session = s;
        break;
      }
    }
    
    if (!session) return;
    
    // Prevent concurrent processing
    if (session.isProcessing) return;
    session.isProcessing = true;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'configure':
          session.requirements = { ...session.requirements, ...message.requirements };
          ws.send(JSON.stringify({
            type: 'configured',
            requirements: session.requirements,
            timestamp: Date.now()
          }));
          break;
          
        case 'frame':
          await processFrame(session, message, orchestrator);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message,
        timestamp: Date.now()
      }));
    } finally {
      session.isProcessing = false;
    }
  };
  
  const handleClose = (ws) => {
    // Remove session
    for (const [id, session] of sessions) {
      if (session.ws === ws) {
        sessions.delete(id);
        break;
      }
    }
  };
  
  return { handleConnection, handleMessage, handleClose };
};

// Frame processing function
const processFrame = async (session, message, orchestrator) => {
  const currentTime = Date.now();
  
  // Basic rate limiting
  if (currentTime - session.lastFrameTime < 33) { // ~30 FPS max
    return;
  }
  
  session.lastFrameTime = currentTime;
  session.frameCount++;
  
  try {
    // Decode frame data (assumed to be base64 encoded image)
    const frameData = decodeFrame(message.frame);
    
    // Process with orchestrator
    const result = await orchestrator.analyze(frameData, session.requirements);
    
    // Send result back
    session.ws.send(JSON.stringify({
      type: 'result',
      result,
      frameId: message.frameId,
      sessionFrameCount: session.frameCount,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    session.ws.send(JSON.stringify({
      type: 'frame_error',
      error: error.message,
      frameId: message.frameId,
      timestamp: Date.now()
    }));
  }
};

// Frame decoding implementation
const decodeFrame = (frameData) => {
  try {
    // Handle different frame data formats
    if (typeof frameData === 'string') {
      // Base64 encoded image data
      const base64Clean = frameData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');
      
      return {
        data: buffer,
        format: 'base64',
        width: 640, // Default dimensions - should be extracted from image
        height: 480,
        channels: 3
      };
    } else if (frameData && typeof frameData === 'object') {
      // Already processed frame data
      return frameData;
    } else {
      throw new Error('Invalid frame data format');
    }
  } catch (error) {
    console.error('Frame decoding failed:', error);
    throw new Error(`Frame decoding failed: ${error.message}`);
  }
};

// Main server factory using Bun.serve
export const createFaceAnalysisServer = (config = {}) => {
  const port = config.port || 3000;
  const strategyRegistry = createStrategyRegistry();
  const orchestrator = createOrchestrator({
    strategies: strategyRegistry,
    ...config.orchestrator
  });
  const router = createRouter();
  const wsManager = createWebSocketManager(orchestrator);
  
  // API Routes
  
  // Get available pipelines
  router.add('GET', '^/api/pipelines$', async (request) => {
    const pipelines = orchestrator.getRegisteredPipelines().map(p => p.name);
    const corsHeaders = createCORSHeaders(request);
    return createJSONResponse({ pipelines }, 200, corsHeaders);
  });
  
  // Configure processing requirements
  router.add('POST', '^/api/configure$', async (request) => {
    try {
      const body = await request.json();
      const requirements = createAnalysisRequirements(body);
      orchestrator.configure(requirements);
      const corsHeaders = createCORSHeaders(request);
      return createSuccessResponse({ requirements }, corsHeaders);
    } catch (error) {
      const corsHeaders = createCORSHeaders(request);
      return createErrorResponse(error.message, 400, corsHeaders);
    }
  });
  
  // Get system health
  router.add('GET', '^/api/health$', async (request) => {
    const health = orchestrator.getStatus();
    const metrics = orchestrator.getMetrics();
    const corsHeaders = createCORSHeaders(request);
    return createJSONResponse({ health, metrics }, 200, corsHeaders);
  });
  
  // Get available strategies
  router.add('GET', '^/api/strategies$', async (request) => {
    const strategies = strategyRegistry.list();
    const corsHeaders = createCORSHeaders(request);
    return createJSONResponse({ strategies }, 200, corsHeaders);
  });
  
  // Single frame processing endpoint
  router.add('POST', '^/api/process$', async (request) => {
    try {
      const body = await request.json();
      
      if (!body.frame) {
        const corsHeaders = createCORSHeaders(request);
        return createErrorResponse('Frame data required', 400, corsHeaders);
      }
      
      const requirements = createAnalysisRequirements(body.requirements || {});
      const frameData = body.frame; // Would need proper decoding
      
      const result = await orchestrator.analyze(frameData, requirements);
      const corsHeaders = createCORSHeaders(request);
      return createJSONResponse({ result }, 200, corsHeaders);
      
    } catch (error) {
      const corsHeaders = createCORSHeaders(request);
      return createErrorResponse(error.message, 400, corsHeaders);
    }
  });
  
  // Pipeline management
  router.add('POST', '^/api/pipelines/register$', async (request) => {
    try {
      const body = await request.json();
      // Pipeline registration would require more complex logic
      const corsHeaders = createCORSHeaders(request);
      return createErrorResponse('Pipeline registration not yet implemented', 501, corsHeaders);
    } catch (error) {
      const corsHeaders = createCORSHeaders(request);
      return createErrorResponse(error.message, 400, corsHeaders);
    }
  });
  
  // Bun.serve configuration
  const server = Bun.serve({
    port,
    hostname: process.env.HOST || '0.0.0.0',
    
    // HTTP request handler
    async fetch(request, server) {
      const url = new URL(request.url);
      const method = request.method;
      
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        const corsHeaders = createCORSHeaders(request);
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
      
      // WebSocket upgrade
      if (url.pathname === '/ws') {
        if (server.upgrade(request)) {
          return; // WebSocket upgrade successful
        }
        return createErrorResponse('WebSocket upgrade failed', 500);
      }
      
      // Route matching
      const route = router.match(method, url.pathname);
      
      if (route) {
        return await route.handler(request, route.params);
      }
      
      // Static file serving (basic implementation)
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return new Response('<h1>Face Analysis API</h1><p>WebSocket endpoint: ws://localhost:' + port + '/ws</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      // 404 Not Found
      const corsHeaders = createCORSHeaders(request);
      return createErrorResponse('Not found', 404, corsHeaders);
    },
    
    // WebSocket handlers
    websocket: {
      open(ws) {
        wsManager.handleConnection(ws);
      },
      
      message(ws, message) {
        const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
        wsManager.handleMessage(ws, data);
      },
      
      close(ws) {
        wsManager.handleClose(ws);
      }
    }
  });
  
  // Server control
  const start = async () => {
    console.log(`Face Analysis API running on http://${server.hostname}:${server.port}`);
    console.log(`WebSocket endpoint: ws://${server.hostname}:${server.port}/ws`);
    return server;
  };
  
  const stop = async () => {
    server.stop();
    console.log('Face Analysis API stopped');
  };
  
  return {
    start,
    stop,
    server,
    orchestrator,
    strategyRegistry
  };
};

// Client SDK factory for easy integration (same as original)
export const createFaceAnalysisClient = (apiUrl = 'http://localhost:3000') => {
  const wsUrl = apiUrl.replace('http', 'ws') + '/ws';
  
  // HTTP client methods
  const request = async (method, path, data = null) => {
    const url = apiUrl + path;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    return response.json();
  };
  
  // WebSocket streaming client
  const createStreamingSession = () => {
    let ws = null;
    const listeners = new Map();
    
    const connect = () => {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => resolve();
        ws.onerror = (error) => reject(error);
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const handler = listeners.get(message.type);
            if (handler) {
              handler(message);
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };
      });
    };
    
    const on = (type, handler) => {
      listeners.set(type, handler);
    };
    
    const send = (type, data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...data }));
      }
    };
    
    const disconnect = () => {
      if (ws) {
        ws.close();
        ws = null;
      }
    };
    
    return { connect, on, send, disconnect };
  };
  
  return {
    // HTTP API methods
    getPipelines: () => request('GET', '/api/pipelines'),
    configure: (requirements) => request('POST', '/api/configure', { requirements }),
    getHealth: () => request('GET', '/api/health'),
    processFrame: (frame, requirements) => request('POST', '/api/process', { frame, requirements }),
    
    // WebSocket streaming
    createStreamingSession,
    
    // Utility methods
    request
  };
};

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createFaceAnalysisServer({
    port: process.env.PORT || 3000
  });
  
  server.start().catch(console.error);
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}