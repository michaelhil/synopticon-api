/**
 * Synopticon API Server - Bun Native TypeScript (Complete Replacement)
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * RESTful API with WebSocket streaming for real-time multi-modal behavioral analysis
 * ZERO external dependencies - uses Bun built-ins ONLY with strict type safety
 */

import { createOrchestrator } from '../../core/orchestrator';
import { createStrategyRegistry } from '../../core/strategies';
import { createDistributionAPI } from './distribution-api';
import { createOpenAPISpec, generateOpenAPIJSON } from './openapi-spec';
import { createMonitoringManager } from './monitoring';
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
    readonly maxFaces?: number;
  };
}

export interface DetectionResponse {
  readonly faces: ReadonlyArray<FaceResult>;
  readonly processingTime: number;
  readonly timestamp: number;
  readonly imageSize?: {
    readonly width: number;
    readonly height: number;
  };
}

export interface HealthResponse {
  readonly status: 'healthy' | 'degraded' | 'critical';
  readonly timestamp: number;
  readonly uptime: number;
  readonly version: string;
  readonly services: Record<string, {
    readonly status: 'up' | 'down' | 'degraded';
    readonly lastCheck: number;
    readonly responseTime?: number;
  }>;
  readonly metrics: {
    readonly requests: {
      readonly total: number;
      readonly success: number;
      readonly errors: number;
    };
    readonly memory: {
      readonly used: number;
      readonly total: number;
      readonly percentage: number;
    };
  };
}

// Rate limiting state
interface RateLimitState {
  readonly requests: Map<string, ReadonlyArray<number>>;
  readonly blocked: Set<string>;
}

// Server state
interface ServerState {
  readonly startTime: number;
  readonly orchestrator: ReturnType<typeof createOrchestrator>;
  readonly distributionAPI: ReturnType<typeof createDistributionAPI>;
  readonly rateLimitState: RateLimitState;
  readonly metrics: {
    requests: {
      total: number;
      success: number;
      errors: number;
    };
  };
}

// Default configuration
const defaultConfig: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: {
    origins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: false
  },
  security: {
    rateLimit: {
      requests: 100,
      window: 60000 // 1 minute
    }
  },
  websocket: {
    enabled: true,
    port: 3001
  },
  features: {
    distribution: true,
    analysis: true,
    monitoring: true
  }
};

/**
 * Create Synopticon API Server - Bun Native
 */
export const createSynopticonServer = (userConfig: Partial<ServerConfig> = {}) => {
  const config: ServerConfig = { ...defaultConfig, ...userConfig };
  
  // Initialize monitoring
  const monitoring = createMonitoringManager({
    enableMetrics: config.features.monitoring,
    enableLogging: true,
    logLevel: 'info'
  });

  // Initialize server state
  const state: ServerState = {
    startTime: Date.now(),
    orchestrator: createOrchestrator({
      strategies: createStrategyRegistry(),
      defaultStrategy: 'accuracy_first'
    }),
    distributionAPI: config.features.distribution ? createDistributionAPI({
      enableWebSocket: config.websocket.enabled,
      wsPort: config.websocket.port
    }) : null as any,
    rateLimitState: {
      requests: new Map(),
      blocked: new Set()
    },
    metrics: {
      requests: {
        total: 0,
        success: 0,
        errors: 0
      }
    }
  };

  // Start monitoring if enabled
  if (config.features.monitoring) {
    monitoring.startMetricsCollection();
    monitoring.log.info('System monitoring started');
  }

  // Security utilities
  const getAllowedOrigins = (): ReadonlyArray<string> => {
    const envOrigins = process.env.CORS_ORIGINS;
    if (envOrigins) {
      return envOrigins.split(',').map(o => o.trim());
    }
    return config.cors.origins;
  };

  // Rate limiting
  const checkRateLimit = (clientIp: string): boolean => {
    const now = Date.now();
    const windowStart = now - config.security.rateLimit.window;
    
    if (state.rateLimitState.blocked.has(clientIp)) {
      return false;
    }
    
    const clientRequests = state.rateLimitState.requests.get(clientIp) || [];
    const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= config.security.rateLimit.requests) {
      state.rateLimitState.blocked.add(clientIp);
      setTimeout(() => {
        state.rateLimitState.blocked.delete(clientIp);
      }, config.security.rateLimit.window);
      return false;
    }
    
    const updatedRequests = [...recentRequests, now];
    state.rateLimitState.requests.set(clientIp, updatedRequests);
    return true;
  };

  // Authentication
  const checkAuth = (req: Request): boolean => {
    if (!config.security.apiKey) {
      return true; // No auth required
    }
    
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    return apiKey === config.security.apiKey;
  };

  // Response helpers
  const createCORSResponse = (data: any, status = 200, request?: Request) => {
    const allowedOrigins = getAllowedOrigins();
    const requestOrigin = request?.headers.get('origin');
    const selectedOrigin = (requestOrigin && allowedOrigins.includes(requestOrigin)) ? requestOrigin : allowedOrigins[0];
    
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': selectedOrigin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Allow-Credentials': config.cors.credentials.toString(),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    });
  };

  // Enhanced monitoring endpoints
  const handleMetrics = async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const format = url.searchParams.get('format') || 'json';
      
      if (format === 'prometheus') {
        const prometheusMetrics = monitoring.exportPrometheusMetrics();
        return new Response(prometheusMetrics, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        const detailedHealth = monitoring.getDetailedHealth();
        return createCORSResponse({ 
          success: true, 
          data: detailedHealth, 
          timestamp: Date.now() 
        } satisfies ApiResponse, 200, request);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Metrics collection failed';
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() } satisfies ApiResponse, 500, request);
    }
  };

  // Route handlers
  const handleHealth = async (request: Request): Promise<Response> => {
    try {
      const uptime = Date.now() - state.startTime;
      const memUsage = process.memoryUsage();
      
      const healthResponse: HealthResponse = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime,
        version: '0.6.0-beta.1',
        services: {
          orchestrator: {
            status: state.orchestrator ? 'up' : 'down',
            lastCheck: Date.now()
          },
          distribution: {
            status: config.features.distribution && state.distributionAPI ? 'up' : 'down',
            lastCheck: Date.now()
          }
        },
        metrics: {
          requests: { ...state.metrics.requests },
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
          }
        }
      };
      
      return createCORSResponse({ success: true, data: healthResponse, timestamp: Date.now() } satisfies ApiResponse<HealthResponse>, 200, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health check failed';
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() } satisfies ApiResponse, 500, request);
    }
  };

  const handleConfig = async (request: Request): Promise<Response> => {
    try {
      const configResponse = {
        capabilities: [
          'face_detection',
          'pose_3dof',
          'pose_6dof', 
          'eye_tracking',
          'expression',
          'landmarks',
          'age_estimation',
          'gender_detection'
        ] as ReadonlyArray<CapabilityType>,
        strategies: ['accuracy_first', 'performance_first', 'balanced'],
        endpoints: {
          health: '/api/health',
          config: '/api/config',
          detect: '/api/detect',
          docs: '/api/docs',
          docsYaml: '/api/docs?format=yaml',
          ...(config.features.monitoring ? {
            metrics: '/api/metrics',
            metricsPrometheus: '/api/metrics?format=prometheus'
          } : {}),
          ...(config.features.distribution ? {
            distributionStatus: '/api/distribution/status',
            distributionDiscovery: '/api/distribution/discovery', 
            distributionStreams: '/api/distribution/streams',
            distributionTemplates: '/api/distribution/templates'
          } : {})
        },
        features: {
          analysis: config.features.analysis,
          distribution: config.features.distribution,
          monitoring: config.features.monitoring,
          websocket: config.websocket.enabled
        },
        limits: {
          maxImageSize: 10 * 1024 * 1024, // 10MB
          maxRequests: config.security.rateLimit.requests,
          timeout: 30000 // 30 seconds
        }
      };
      
      return createCORSResponse({ success: true, data: configResponse, timestamp: Date.now() } satisfies ApiResponse<typeof configResponse>, 200, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Config fetch failed';
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() } satisfies ApiResponse, 500, request);
    }
  };

  const handleDocs = async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const format = url.searchParams.get('format') || 'json';
      
      if (format === 'yaml') {
        const yamlSpec = `openapi: 3.0.3
info:
  title: Synopticon API
  version: 0.6.0-beta.1
  description: Comprehensive real-time multi-modal behavioral analysis API
servers:
  - url: ${url.origin}
    description: Synopticon API Server
paths:
  /api/health:
    get:
      summary: System Health Check
      tags: [System Management]
  /api/config:
    get:
      summary: System Configuration  
      tags: [System Management]
  /api/detect:
    post:
      summary: Face Detection Analysis
      tags: [Analysis]
  /api/distribution/status:
    get:
      summary: Distribution System Status
      tags: [Distribution Management]
# See /api/docs?format=json for complete specification`;

        return new Response(yamlSpec, {
          headers: {
            'Content-Type': 'text/yaml',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        const openAPISpec = generateOpenAPIJSON({
          baseUrl: url.origin,
          version: '0.6.0-beta.1'
        });
        
        return new Response(openAPISpec, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Documentation generation failed';
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() } satisfies ApiResponse, 500, request);
    }
  };

  const handleDetect = async (request: Request): Promise<Response> => {
    try {
      const body = await request.json() as DetectionRequest;
      
      if (!body.image && !body.imageUrl) {
        return createCORSResponse({ success: false, error: 'Missing image data or imageUrl', timestamp: Date.now() } satisfies ApiResponse, 400, request);
      }
      
      // Create analysis requirements
      const requirements: AnalysisRequirements = {
        capabilities: ['face_detection'],
        quality: {
          minConfidence: 0.5,
          maxLatency: 5000,
          requiredFPS: 30
        },
        ...body.requirements
      };
      
      // Process with orchestrator
      const startTime = Date.now();
      const result = await state.orchestrator.analyze(
        { /* mock image data */ }, 
        requirements
      ) as AnalysisResult;
      
      const processingTime = Date.now() - startTime;
      
      // Handle discriminated union result
      let faces: ReadonlyArray<FaceResult> = [];
      let imageSize = { width: 640, height: 480 };
      
      if (result.status === 'success' && result.data) {
        const data = result.data as any; // Type assertion for legacy compatibility
        faces = data.faces || [];
        imageSize = data.metadata?.imageSize || imageSize;
      }
      
      const response: DetectionResponse = {
        faces,
        processingTime,
        timestamp: Date.now(),
        imageSize
      };
      
      return createCORSResponse({ success: true, data: response, timestamp: Date.now() } satisfies ApiResponse<DetectionResponse>, 200, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed';
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() } satisfies ApiResponse, 500, request);
    }
  };

  // Bun native request router
  const router = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;
    const clientIp = request.headers.get('cf-connecting-ip') || 
                     request.headers.get('x-forwarded-for') || 'unknown';
    const startTime = Date.now();
    
    // Update metrics
    state.metrics.requests.total++;
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return createCORSResponse(null, 204, request);
    }
    
    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      state.metrics.requests.errors++;
      monitoring.trackRequest(method, path, startTime, false, 'Rate limit exceeded');
      return createCORSResponse({ success: false, error: 'Rate limit exceeded', timestamp: Date.now() }, 429, request);
    }
    
    // Authentication  
    if (!checkAuth(request)) {
      state.metrics.requests.errors++;
      monitoring.trackRequest(method, path, startTime, false, 'Unauthorized');
      return createCORSResponse({ success: false, error: 'Unauthorized', timestamp: Date.now() }, 401, request);
    }
    
    try {
      // Route to handlers
      if (method === 'GET' && path === '/api/health') {
        const response = await handleHealth(request);
        state.metrics.requests.success++;
        monitoring.trackRequest(method, path, startTime, true);
        return response;
      } else if (method === 'GET' && path === '/api/config') {
        const response = await handleConfig(request);
        state.metrics.requests.success++;
        monitoring.trackRequest(method, path, startTime, true);
        return response;
      } else if (method === 'GET' && path === '/api/docs') {
        const response = await handleDocs(request);
        state.metrics.requests.success++;
        monitoring.trackRequest(method, path, startTime, true);
        return response;
      } else if (config.features.monitoring && method === 'GET' && path === '/api/metrics') {
        const response = await handleMetrics(request);
        state.metrics.requests.success++;
        monitoring.trackRequest(method, path, startTime, true);
        return response;
      } else if (method === 'POST' && path === '/api/detect') {
        const response = await handleDetect(request);
        state.metrics.requests.success++;
        monitoring.trackRequest(method, path, startTime, true);
        return response;
      } else if (config.features.distribution && path.startsWith('/api/distribution/')) {
        // Handle distribution API routes
        if (state.distributionAPI && state.distributionAPI.routes) {
          const routeKey = `${method} ${path}`;
          const handler = state.distributionAPI.routes[routeKey];
          if (handler) {
            const response = await handler(request);
            state.metrics.requests.success++;
            monitoring.trackRequest(method, path, startTime, true);
            return response;
          }
        }
        // If distribution is enabled but route not found, return 404 with helpful message
        state.metrics.requests.errors++;
        monitoring.trackRequest(method, path, startTime, false, 'Distribution endpoint not found');
        return createCORSResponse({ 
          success: false, 
          error: `Distribution endpoint '${path}' not found. Available endpoints: /status, /discovery, /streams, /templates`, 
          timestamp: Date.now() 
        }, 404, request);
      } else {
        state.metrics.requests.errors++;
        monitoring.trackRequest(method, path, startTime, false, 'Endpoint not found');
        return createCORSResponse({ success: false, error: 'Endpoint not found', timestamp: Date.now() }, 404, request);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      state.metrics.requests.errors++;
      monitoring.trackRequest(method, path, startTime, false, message);
      return createCORSResponse({ success: false, error: message, timestamp: Date.now() }, 500, request);
    }
  };

  // Create Bun native server with integrated WebSocket
  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    
    // HTTP handler
    async fetch(request, server) {
      const url = new URL(request.url);
      
      // WebSocket upgrade
      if (config.websocket.enabled && url.pathname === '/ws') {
        if (server.upgrade(request)) {
          return; // WebSocket upgrade successful
        }
        return new Response('WebSocket upgrade failed', { status: 500 });
      }
      
      // Route to HTTP handlers
      return await router(request);
    },
    
    // Bun native WebSocket handlers
    websocket: config.websocket.enabled ? {
      open(ws) {
        console.log('🔌 Bun WebSocket connected');
        
        // Add to distribution API if available
        if (state.distributionAPI?.addStatusConnection) {
          state.distributionAPI.addStatusConnection(ws);
        }
      },
      
      close(ws) {
        console.log('🔌 Bun WebSocket disconnected');
        if (state.distributionAPI?.removeStatusConnection) {
          state.distributionAPI.removeStatusConnection(ws);
        }
      },
      
      message(ws, message) {
        try {
          const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
          console.log('Received WebSocket message:', data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      }
    } : undefined
  });

  return {
    server,
    config,
    
    // Server control
    start: (): Promise<void> => {
      return Promise.resolve().then(() => {
        console.log(`🚀 Synopticon API Server (Bun Native) running on ${config.host}:${config.port}`);
        console.log(`📋 Health: http://${config.host}:${config.port}/api/health`);
        console.log(`⚙️ Config: http://${config.host}:${config.port}/api/config`);
        
        if (config.websocket.enabled) {
          console.log(`📡 WebSocket: ws://${config.host}:${config.port}/ws`);
        }
      });
    },
    
    stop: (): Promise<void> => {
      return Promise.resolve().then(() => {
        server.stop();
        console.log('🛑 Synopticon API Server (Bun Native) stopped');
      });
    },
    
    // Server info
    getStatus: (): Pick<HealthResponse, 'uptime' | 'metrics'> => ({
      uptime: Date.now() - state.startTime,
      metrics: {
        requests: { ...state.metrics.requests },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        }
      }
    }),
    
    getMetrics: () => ({ ...state.metrics }),
    
    // Cleanup
    cleanup: (): void => {
      state.rateLimitState.requests.clear();
      state.rateLimitState.blocked.clear();
      if (state.distributionAPI?.cleanup) {
        state.distributionAPI.cleanup();
      }
    }
  };
};

// Factory function for easy server creation
export const createServer = (config?: Partial<ServerConfig>) => {
  return createSynopticonServer(config);
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