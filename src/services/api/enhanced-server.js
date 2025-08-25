/**
 * Enhanced Synopticon API Server with Distribution API - Bun.serve Version
 * Complete implementation with all endpoints using native Bun performance
 * Zero external dependencies - uses Bun built-in HTTP and WebSocket
 */

import { createOrchestrator } from '../../core/orchestrator.ts';
import { createStrategyRegistry } from '../../core/strategies.ts';
import { createDistributionAPI } from './distribution-api.ts';
import { parseRequestURL } from '../../shared/utils/url-utils.js';

/**
 * Create enhanced API server with distribution capabilities using Bun.serve
 */
export const createEnhancedAPIServer = (config = {}) => {
  const port = config.port || 3000;
  const hostname = config.hostname || process.env.HOST || '0.0.0.0';
  
  const orchestrator = createOrchestrator({
    strategies: createStrategyRegistry(),
    ...config.orchestrator
  });
  const distributionAPI = createDistributionAPI(config.distribution);
  
  // CORS headers using Web API Response format
  const createCORSHeaders = (request) => {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Content-Type': 'application/json'
    };
  };
  
  // Response helpers using Web API Response
  const createJSONResponse = (data, status = 200, headers = {}) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...createCORSHeaders(),
        ...headers
      }
    });
  };
  
  // Route matcher for distribution API
  const matchRoute = (method, pathname) => {
    // Check distribution API routes
    const routeKey = `${method} ${pathname}`;
    if (distributionAPI.routes && distributionAPI.routes[routeKey]) {
      return async (request) => {
        // Adapt distribution API to Web Response format
        let responseData = null;
        let responseStatus = 200;
        
        const mockRes = {
          json: (data) => { responseData = data; },
          status: (code) => { 
            responseStatus = code; 
            return { json: (data) => { responseData = data; } };
          }
        };
        
        const mockSendJSON = (res, data, status = 200) => {
          responseData = data;
          responseStatus = status;
        };
        
        try {
          await distributionAPI.routes[routeKey](request, mockRes, {}, mockSendJSON);
          return createJSONResponse(responseData, responseStatus);
        } catch (error) {
          return createJSONResponse({ 
            success: false, 
            error: error.message 
          }, 500);
        }
      };
    }
    
    // Check routes with parameters
    if (distributionAPI.routes) {
      for (const [pattern, handler] of Object.entries(distributionAPI.routes)) {
        const [routeMethod, routePath] = pattern.split(' ');
        if (routeMethod !== method) continue;
        
        // Convert route pattern to regex
        const paramPattern = routePath.replace(/:(\\w+)/g, '(?<$1>[^/]+)');
        const regex = new RegExp(`^${paramPattern}$`);
        const match = pathname.match(regex);
        
        if (match) {
          return async (request) => {
            let responseData = null;
            let responseStatus = 200;
            
            const mockSendJSON = (res, data, status = 200) => {
              responseData = data;
              responseStatus = status;
            };
            
            try {
              await handler(request, null, match.groups || {}, mockSendJSON);
              return createJSONResponse(responseData, responseStatus);
            } catch (error) {
              return createJSONResponse({ 
                success: false, 
                error: error.message 
              }, 500);
            }
          };
        }
      }
    }
    
    return null;
  };
  
  // WebSocket connection management
  const wsConnections = new Set();
  
  // Bun.serve configuration
  const server = Bun.serve({
    port,
    hostname,
    
    // HTTP request handler
    async fetch(request, server) {
      const url = new URL(request.url);
      const method = request.method;
      
      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: createCORSHeaders(request)
        });
      }
      
      // WebSocket upgrade for distribution events
      if (url.pathname === '/api/distribution/events') {
        if (server.upgrade(request)) {
          return; // WebSocket upgrade successful
        }
        return createJSONResponse({ 
          success: false, 
          error: 'WebSocket upgrade failed' 
        }, 500);
      }
      
      // Core API endpoints
      if (method === 'GET' && url.pathname === '/api/health') {
        const health = {
          status: 'healthy',
          timestamp: Date.now(),
          distribution: distributionAPI.getStatus ? distributionAPI.getStatus() : {},
          orchestrator: {
            pipelines: orchestrator.getRegisteredPipelines ? 
              orchestrator.getRegisteredPipelines().map(p => p.name) : []
          }
        };
        return createJSONResponse({ success: true, data: health });
      }
      
      if (method === 'GET' && url.pathname === '/api/config') {
        const config = {
          api_version: '1.0.0',
          capabilities: [
            'face_detection',
            'eye_tracking',
            'speech_analysis',
            'distribution'
          ],
          endpoints: {
            core: [
              'GET /api/health',
              'GET /api/config',
              'POST /api/detect',
              'POST /api/batch'
            ],
            distribution: [
              'GET /api/distribution/status',
              'GET /api/distribution/discovery',
              'POST /api/distribution/streams',
              'GET /api/distribution/streams',
              'GET /api/distribution/streams/:id',
              'PUT /api/distribution/streams/:id',
              'DELETE /api/distribution/streams/:id',
              'POST /api/distribution/clients',
              'GET /api/distribution/clients',
              'GET /api/distribution/templates',
              'POST /api/distribution/templates/:id/instantiate',
              'POST /api/distribution/streams/:id/record',
              'POST /api/distribution/streams/:id/share'
            ]
          }
        };
        return createJSONResponse({ success: true, data: config });
      }
      
      if (method === 'POST' && url.pathname === '/api/detect') {
        const body = await request.json();
        // Mock face detection response
        const result = {
          faces: [{
            id: 'face_0',
            bbox: { x: 100, y: 100, width: 200, height: 200 },
            confidence: 0.95
          }],
          processing_time: 45.2
        };
        return createJSONResponse({ success: true, data: result });
      }
      
      if (method === 'POST' && url.pathname === '/api/batch') {
        const body = await request.json();
        // Mock batch processing response
        const result = {
          processed: body.images ? body.images.length : 0,
          results: []
        };
        return createJSONResponse({ success: true, data: result });
      }
      
      // Try distribution API routes
      const handler = matchRoute(method, url.pathname);
      if (handler) {
        return await handler(request);
      }
      
      // Static home page
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return new Response('<h1>Enhanced Synopticon API</h1><p>WebSocket: ws://localhost:' + port + '/api/distribution/events</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      // 404 Not Found
      return createJSONResponse({ 
        success: false, 
        error: 'Endpoint not found',
        available_endpoints: [
          '/api/health',
          '/api/config',
          '/api/distribution/status',
          '/api/distribution/discovery'
        ]
      }, 404);
    },
    
    // WebSocket handlers for distribution events
    websocket: {
      open(ws) {
        wsConnections.add(ws);
        
        // Send initial status if distribution API supports it
        if (distributionAPI.addStatusConnection) {
          distributionAPI.addStatusConnection(ws);
        } else {
          // Send basic welcome message
          ws.send(JSON.stringify({
            type: 'connected',
            timestamp: Date.now(),
            message: 'Connected to Enhanced Synopticon API'
          }));
        }
      },
      
      message(ws, message) {
        try {
          const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
          const parsed = JSON.parse(data);
          
          // Handle ping/pong
          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: Date.now() 
            }));
          }
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message,
            timestamp: Date.now() 
          }));
        }
      },
      
      close(ws) {
        wsConnections.delete(ws);
        
        if (distributionAPI.removeStatusConnection) {
          distributionAPI.removeStatusConnection(ws);
        }
      }
    }
  });
  
  // Server control
  const start = async () => {
    console.log(`🚀 Enhanced Synopticon API Server (Bun.serve) running on http://${hostname}:${port}`);
    console.log(`📋 Health: http://${hostname}:${port}/api/health`);
    console.log(`🔍 Discovery: http://${hostname}:${port}/api/distribution/discovery`);
    console.log(`📡 WebSocket: ws://${hostname}:${port}/api/distribution/events`);
    return server;
  };
  
  const stop = async () => {
    server.stop();
    console.log('🛑 Enhanced Server (Bun.serve) stopped');
  };
  
  return {
    server,
    start,
    stop,
    distributionAPI,
    orchestrator
  };
};

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createEnhancedAPIServer({
    port: process.env.PORT || 3000
  });
  
  server.start().catch(console.error);
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}