/**
 * Synopticon API Server
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * RESTful API with WebSocket streaming for real-time multi-modal behavioral analysis
 * Minimal dependencies approach using Node.js/Bun built-ins
 */

import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { createOrchestrator } from '../core/orchestrator.js';
import { createStrategyRegistry } from '../core/strategies.js';
import { createAnalysisRequirements } from '../core/types.js';

// Secure ID generation
const generateSecureId = (prefix = '') => {
  const crypto = require('crypto');
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
};

// Secure CORS configuration
const getAllowedOrigins = () => {
  const origins = process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
  return origins.split(',').map(o => o.trim());
};

const setCORSHeaders = (req, res, origin = null) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.origin;
  
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

// Simple HTTP response utilities
const sendJSON = (res, data, status = 200, req = null) => {
  res.writeHead(status, setCORSHeaders(req, res));
  res.end(JSON.stringify(data));
};

const sendError = (res, message, status = 400) => {
  sendJSON(res, { error: message, timestamp: Date.now() }, status);
};

const sendSuccess = (res, data = {}) => {
  sendJSON(res, { success: true, ...data, timestamp: Date.now() });
};

// Request body parsing utility
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

// Route handling
const createRouter = () => {
  const routes = new Map();
  
  const add = (method, pattern, handler) => {
    const key = `${method}:${pattern}`;
    routes.set(key, { pattern: new RegExp(pattern), handler });
  };
  
  const match = (method, path) => {
    for (const [key, route] of routes) {
      if (key.startsWith(method + ':')) {
        const match = path.match(route.pattern);
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
  
  const handleConnection = (ws, request) => {
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
    
    ws.on('message', async (data) => {
      try {
        await handleWebSocketMessage(session, data);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message,
          timestamp: Date.now()
        }));
      }
    });
    
    ws.on('close', () => {
      sessions.delete(sessionId);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      capabilities: orchestrator.getAvailablePipelines(),
      timestamp: Date.now()
    }));
  };
  
  const handleWebSocketMessage = async (session, data) => {
    // Prevent concurrent processing
    if (session.isProcessing) {
      return;
    }
    
    session.isProcessing = true;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'configure':
          session.requirements = { ...session.requirements, ...message.requirements };
          session.ws.send(JSON.stringify({
            type: 'configured',
            requirements: session.requirements,
            timestamp: Date.now()
          }));
          break;
          
        case 'frame':
          await processFrame(session, message);
          break;
          
        case 'ping':
          session.ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      throw new Error(`WebSocket message handling failed: ${error.message}`);
    } finally {
      session.isProcessing = false;
    }
  };
  
  const processFrame = async (session, message) => {
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
      const result = await orchestrator.process(frameData, session.requirements);
      
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
  
  // Simple frame decoding (placeholder - would need proper image processing)
  const decodeFrame = (frameData) => {
    // In a real implementation, this would decode base64 image data
    // and convert to appropriate format for processing pipelines
    return frameData;
  };
  
  return { handleConnection };
};

// Main server factory
export const createFaceAnalysisServer = (config = {}) => {
  const port = config.port || 3000;
  const orchestrator = createOrchestrator(config.orchestrator);
  const strategyRegistry = createStrategyRegistry();
  const router = createRouter();
  const wsManager = createWebSocketManager(orchestrator);
  
  // API Routes
  
  // Get available pipelines
  router.add('GET', '^/api/pipelines$', async (req, res) => {
    const pipelines = orchestrator.getAvailablePipelines();
    sendJSON(res, { pipelines });
  });
  
  // Configure processing requirements
  router.add('POST', '^/api/configure$', async (req, res) => {
    try {
      const body = await parseBody(req);
      const requirements = createAnalysisRequirements(body);
      orchestrator.configure(requirements);
      sendSuccess(res, { requirements });
    } catch (error) {
      sendError(res, error.message);
    }
  });
  
  // Get system health
  router.add('GET', '^/api/health$', async (req, res) => {
    const health = orchestrator.getHealthStatus();
    const metrics = orchestrator.getPerformanceMetrics();
    sendJSON(res, { health, metrics });
  });
  
  // Get available strategies
  router.add('GET', '^/api/strategies$', async (req, res) => {
    const strategies = strategyRegistry.list();
    sendJSON(res, { strategies });
  });
  
  // Single frame processing endpoint
  router.add('POST', '^/api/process$', async (req, res) => {
    try {
      const body = await parseBody(req);
      
      if (!body.frame) {
        return sendError(res, 'Frame data required');
      }
      
      const requirements = createAnalysisRequirements(body.requirements || {});
      const frameData = body.frame; // Would need proper decoding
      
      const result = await orchestrator.process(frameData, requirements);
      sendJSON(res, { result });
      
    } catch (error) {
      sendError(res, error.message);
    }
  });
  
  // Pipeline management
  router.add('POST', '^/api/pipelines/register$', async (req, res) => {
    try {
      const body = await parseBody(req);
      // Pipeline registration would require more complex logic
      sendError(res, 'Pipeline registration not yet implemented', 501);
    } catch (error) {
      sendError(res, error.message);
    }
  });
  
  // Static file serving (basic implementation)
  router.add('GET', '^/(.*)$', async (req, res, match) => {
    // In production, use a proper static file server
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Face Analysis API</h1><p>WebSocket endpoint: ws://localhost:' + port + '/ws</p>');
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  // Handle CORS preflight
  const handleCORS = (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return true;
    }
    return false;
  };
  
  // HTTP Server
  const server = createServer(async (req, res) => {
    try {
      // Handle CORS
      if (handleCORS(req, res)) return;
      
      const { pathname } = parse(req.url);
      const route = router.match(req.method, pathname);
      
      if (route) {
        await route.handler(req, res, route.params);
      } else {
        sendError(res, 'Not found', 404);
      }
    } catch (error) {
      console.error('Server error:', error);
      sendError(res, 'Internal server error', 500);
    }
  });
  
  // WebSocket Server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });
  
  wss.on('connection', wsManager.handleConnection);
  
  // Server control
  const start = async () => {
    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`Face Analysis API running on http://localhost:${port}`);
        console.log(`WebSocket endpoint: ws://localhost:${port}/ws`);
        resolve();
      });
    });
  };
  
  const stop = async () => {
    return new Promise((resolve) => {
      wss.close();
      server.close(() => {
        console.log('Face Analysis API stopped');
        resolve();
      });
    });
  };
  
  return {
    start,
    stop,
    server,
    orchestrator,
    strategyRegistry
  };
};

// Client SDK factory for easy integration
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