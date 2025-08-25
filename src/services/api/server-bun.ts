/**
 * Synopticon API Server - Bun Native TypeScript
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * RESTful API with WebSocket streaming using Bun.serve for optimal performance
 * Zero external dependencies - uses Bun built-in HTTP and WebSocket with strict type safety
 */

import { createOrchestrator } from '../../core/orchestrator';
import { createStrategyRegistry } from '../../core/strategies';
import { createDistributionAPI } from './distribution-api';
import type { AnalysisRequirements, CapabilityType, FaceResult, AnalysisResult } from '../../core/types';
import type { ApiResponse } from './distribution-api';

// Server Configuration Interface
export interface ServerConfig {
  readonly port: number;
  readonly host?: string;
  readonly cors: {
    readonly origins: ReadonlyArray<string>;
    readonly credentials: boolean;
  };
  readonly security: {
    readonly apiKey?: string;
    readonly rateLimit: {
      readonly requests: number;
      readonly window: number;
    };
  };
  readonly websocket: {
    readonly enabled: boolean;
    readonly port?: number;
  };
  readonly features: {
    readonly distribution: boolean;
    readonly analysis: boolean;
    readonly monitoring: boolean;
  };
}

// Request/Response Types  
export interface DetectionRequest {
  readonly image?: string; // Base64 encoded
  readonly imageUrl?: string;
  readonly requirements?: Partial<AnalysisRequirements>;
  readonly options?: {
    readonly returnLandmarks?: boolean;
    readonly returnPose?: boolean;
    readonly returnEmotions?: boolean;
  };
}

export interface DetectionResponse {
  readonly success: boolean;
  readonly requestId: string;
  readonly processingTime: number;
  readonly result?: AnalysisResult;
  readonly error?: string;
  readonly timestamp: number;
}

export interface HealthResponse {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: number;
  readonly version: string;
  readonly uptime: number;
  readonly services: {
    readonly orchestrator: 'online' | 'offline';
    readonly distribution: 'online' | 'offline';
    readonly websocket: 'online' | 'offline';
  };
  readonly metrics: {
    readonly totalRequests: number;
    readonly successfulRequests: number;
    readonly averageResponseTime: number;
  };
}

// Secure ID generation using Bun crypto
const generateSecureId = (prefix = ''): string => {
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
};

// CORS configuration
const createCORSHeaders = (config: ServerConfig, request: Request): HeadersInit => {
  const origin = request.headers.get('origin');
  const allowedOrigin = config.cors.origins.includes(origin || '') ? origin : config.cors.origins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': config.cors.credentials.toString(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
};

// Response helpers with proper typing
const createJSONResponse = <T>(data: T, status = 200, headers: HeadersInit = {}): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
};

const createErrorResponse = (message: string, status = 400, headers: HeadersInit = {}): Response => {
  return createJSONResponse({
    success: false,
    error: message,
    timestamp: Date.now()
  }, status, headers);
};

// Rate limiting with Map-based storage
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const client = this.requests.get(clientId);
    
    if (!client || now > client.resetTime) {
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }
    
    if (client.count >= this.maxRequests) {
      return false;
    }
    
    client.count++;
    return true;
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [key, client] of this.requests) {
      if (now > client.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// WebSocket session management with typing
interface WebSocketSession {
  readonly id: string;
  readonly ws: any; // Bun WebSocket type
  requirements: AnalysisRequirements;
  readonly connectedAt: number;
  frameCount: number;
  lastFrameTime: number;
}

// Main server factory with strict typing
export const createSynopticonServer = (config: ServerConfig) => {
  // Initialize core components
  const strategyRegistry = createStrategyRegistry();
  const orchestrator = createOrchestrator({
    strategies: strategyRegistry
  });
  
  const distributionAPI = createDistributionAPI();
  const rateLimiter = new RateLimiter(
    config.security.rateLimit.requests,
    config.security.rateLimit.window
  );
  
  // WebSocket session management
  const wsSessions = new Map<string, WebSocketSession>();
  
  // Request metrics
  let totalRequests = 0;
  let successfulRequests = 0;
  let totalResponseTime = 0;
  const serverStartTime = Date.now();
  
  // Helper to get client IP from request
  const getClientIP = (request: Request): string => {
    return request.headers.get('x-forwarded-for') || 
           request.headers.get('cf-connecting-ip') || 
           'unknown';
  };
  
  // Authentication middleware
  const validateApiKey = (request: Request): boolean => {
    if (!config.security.apiKey) return true;
    
    const providedKey = request.headers.get('x-api-key') || 
                       request.headers.get('authorization')?.replace('Bearer ', '');
    
    return providedKey === config.security.apiKey;
  };
  
  // Create Bun server
  const server = Bun.serve({
    port: config.port,
    hostname: config.host || '0.0.0.0',
    
    async fetch(request: Request, server): Promise<Response> {
      const startTime = performance.now();
      const url = new URL(request.url);
      const method = request.method;
      const clientIP = getClientIP(request);
      
      totalRequests++;
      
      try {
        // CORS preflight
        if (method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: createCORSHeaders(config, request)
          });
        }
        
        // Rate limiting
        if (!rateLimiter.isAllowed(clientIP)) {
          return createErrorResponse('Rate limit exceeded', 429, 
            createCORSHeaders(config, request));
        }
        
        // API key validation
        if (!validateApiKey(request)) {
          return createErrorResponse('Invalid or missing API key', 401,
            createCORSHeaders(config, request));
        }
        
        // WebSocket upgrade
        if (url.pathname === '/ws' && config.websocket.enabled) {
          if (server.upgrade(request)) {
            return undefined as any; // WebSocket upgrade successful
          }
          return createErrorResponse('WebSocket upgrade failed', 500);
        }
        
        // API Routes
        const corsHeaders = createCORSHeaders(config, request);
        
        // Health endpoint
        if (method === 'GET' && url.pathname === '/api/health') {
          const health: HealthResponse = {
            status: 'healthy',
            timestamp: Date.now(),
            version: '1.0.0',
            uptime: Date.now() - serverStartTime,
            services: {
              orchestrator: 'online',
              distribution: config.features.distribution ? 'online' : 'offline',
              websocket: config.websocket.enabled ? 'online' : 'offline'
            },
            metrics: {
              totalRequests,
              successfulRequests,
              averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0
            }
          };
          
          successfulRequests++;
          return createJSONResponse(health, 200, corsHeaders);
        }
        
        // Capabilities endpoint
        if (method === 'GET' && url.pathname === '/api/capabilities') {
          const capabilities = {
            analysis: config.features.analysis,
            distribution: config.features.distribution,
            monitoring: config.features.monitoring,
            websocket: config.websocket.enabled,
            supportedFormats: ['base64', 'url'] as const,
            supportedCapabilities: ['face_detection', 'emotion_analysis'] as CapabilityType[]
          };
          
          successfulRequests++;
          return createJSONResponse({ success: true, data: capabilities }, 200, corsHeaders);
        }
        
        // Detection endpoint
        if (method === 'POST' && url.pathname === '/api/detect') {
          const requestId = generateSecureId('req');
          
          try {
            const body = await request.json() as DetectionRequest;
            
            if (!body.image && !body.imageUrl) {
              return createErrorResponse('Image data or URL required', 400, corsHeaders);
            }
            
            // Process with orchestrator
            const requirements: AnalysisRequirements = {
              capabilities: body.requirements?.capabilities || ['face_detection'],
              ...body.requirements
            };
            const mockImageData = body.image || body.imageUrl; // Would need proper processing
            
            const result = await orchestrator.analyze(mockImageData, requirements);
            
            const processingTime = performance.now() - startTime;
            totalResponseTime += processingTime;
            
            const response: DetectionResponse = {
              success: true,
              requestId,
              processingTime: Math.round(processingTime * 100) / 100,
              result,
              timestamp: Date.now()
            };
            
            successfulRequests++;
            return createJSONResponse(response, 200, corsHeaders);
            
          } catch (error: any) {
            const processingTime = performance.now() - startTime;
            totalResponseTime += processingTime;
            
            const response: DetectionResponse = {
              success: false,
              requestId,
              processingTime: Math.round(processingTime * 100) / 100,
              error: error.message,
              timestamp: Date.now()
            };
            
            return createJSONResponse(response, 500, corsHeaders);
          }
        }
        
        // Batch processing endpoint
        if (method === 'POST' && url.pathname === '/api/batch') {
          const body = await request.json();
          const images = body.images || [];
          
          // Mock batch processing
          const results = images.map((img: any, index: number) => ({
            id: index,
            success: true,
            faces: []
          }));
          
          successfulRequests++;
          return createJSONResponse({
            success: true,
            processed: images.length,
            results
          }, 200, corsHeaders);
        }
        
        // Distribution API endpoints
        if (config.features.distribution && url.pathname.startsWith('/api/distribution/')) {
          // Delegate to distribution API
          return createJSONResponse({
            success: true,
            message: 'Distribution API endpoint',
            endpoint: url.pathname
          }, 200, corsHeaders);
        }
        
        // Static home page
        if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
          return new Response(`
            <h1>Synopticon API Server (Bun Native)</h1>
            <p>WebSocket endpoint: ws://${config.host || 'localhost'}:${config.port}/ws</p>
            <ul>
              <li><a href="/api/health">Health Check</a></li>
              <li><a href="/api/capabilities">Capabilities</a></li>
            </ul>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        // 404 Not Found
        return createErrorResponse('Endpoint not found', 404, corsHeaders);
        
      } finally {
        // Cleanup rate limiter periodically
        if (totalRequests % 1000 === 0) {
          rateLimiter.cleanup();
        }
      }
    },
    
    // WebSocket configuration
    websocket: config.websocket.enabled ? {
      open(ws) {
        const sessionId = generateSecureId('session');
        const session: WebSocketSession = {
          id: sessionId,
          ws,
          requirements: { capabilities: ['face_detection'] },
          connectedAt: Date.now(),
          frameCount: 0,
          lastFrameTime: 0
        };
        
        wsSessions.set(sessionId, session);
        
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId,
          timestamp: Date.now(),
          capabilities: orchestrator.getRegisteredPipelines().map(p => p.name)
        }));
      },
      
      message(ws, message) {
        // Find session
        let session: WebSocketSession | undefined;
        for (const s of wsSessions.values()) {
          if (s.ws === ws) {
            session = s;
            break;
          }
        }
        
        if (!session) return;
        
        try {
          const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
          const parsed = JSON.parse(data);
          
          switch (parsed.type) {
            case 'ping':
              ws.send(JSON.stringify({ 
                type: 'pong', 
                timestamp: Date.now() 
              }));
              break;
              
            case 'configure':
              session.requirements = { ...session.requirements, ...parsed.requirements };
              ws.send(JSON.stringify({
                type: 'configured',
                requirements: session.requirements,
                timestamp: Date.now()
              }));
              break;
              
            case 'frame':
              // Process frame data
              session.frameCount++;
              session.lastFrameTime = Date.now();
              
              ws.send(JSON.stringify({
                type: 'result',
                frameId: parsed.frameId,
                result: { faces: [] }, // Mock result
                timestamp: Date.now()
              }));
              break;
          }
        } catch (error: any) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message,
            timestamp: Date.now()
          }));
        }
      },
      
      close(ws) {
        // Remove session
        for (const [id, session] of wsSessions) {
          if (session.ws === ws) {
            wsSessions.delete(id);
            break;
          }
        }
      }
    } : undefined
  });
  
  return {
    server,
    start: async () => {
      console.log(`🚀 Synopticon API Server (Bun Native) running on http://${config.host || '0.0.0.0'}:${config.port}`);
      console.log(`📋 Health: http://${config.host || 'localhost'}:${config.port}/api/health`);
      if (config.websocket.enabled) {
        console.log(`📡 WebSocket: ws://${config.host || 'localhost'}:${config.port}/ws`);
      }
      return server;
    },
    
    stop: async () => {
      server.stop();
      console.log('🛑 Synopticon API Server (Bun Native) stopped');
    },
    
    getMetrics: () => ({
      totalRequests,
      successfulRequests,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      activeSessions: wsSessions.size
    })
  };
};

// Default configuration
export const defaultConfig: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: {
    origins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: false
  },
  security: {
    rateLimit: {
      requests: 100,
      window: 15 * 60 * 1000 // 15 minutes
    }
  },
  websocket: {
    enabled: true
  },
  features: {
    distribution: true,
    analysis: true,
    monitoring: true
  }
};

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    ...defaultConfig,
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0'
  };
  
  const server = createSynopticonServer(config);
  
  server.start().catch(console.error);
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}