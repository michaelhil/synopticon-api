/**
 * Synopticon API Server - TypeScript Implementation
 * Streamlined server with extracted route modules and comprehensive type safety
 */

import { parseRequestURL } from '../../shared/utils/url-utils.js';
import { createOrchestrator } from '../../core/orchestration/orchestrator.js';
import { createStrategyRegistry } from '../../core/orchestration/strategies.js';
import { createAnalysisRequirements } from '../../core/configuration/types.js';
import { createMemoryOptimizer } from '../../core/state/memory-optimization.js';
import { createRouteRegistry } from './routes/index.js';
import { createWebSocketManager } from './websocket/index.js';
import { createMiddlewareSystem } from './middleware/index.js';
import {
  type MiddlewareSystem,
  type MiddlewareConfig
} from './middleware/middleware-types.js';

// Server configuration interface
export interface ServerConfig {
  port?: number;
  httpHost?: string;
  websocketHost?: string;
  websocketPort?: number;
  discoveryInterval?: number;
  maxWebSocketSessions?: number;
  websocketTimeout?: number;
  maxFrameSize?: number;
  enableFrameCache?: boolean;
  memoryPressureThreshold?: number;
  allowedOrigins?: string[];
  corsAllowCredentials?: boolean;
  corsLogRequests?: boolean;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  rateLimitAlgorithm?: 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';
  enableDetailedErrors?: boolean;
  enableErrorLogging?: boolean;
  orchestrator?: any;
}

// Route handler type
export type RouteHandler = (request: Request, params?: string[]) => Promise<Response>;

// Router interface
export interface Router {
  add: (method: string, pattern: string, handler: RouteHandler) => void;
  route: (request: Request) => Promise<Response>;
}

// Server instance interface
export interface ServerInstance {
  start: () => Promise<any>;
  stop: () => Promise<void>;
  server: any;
  orchestrator: any;
  strategyRegistry: any;
  middlewareSystem: MiddlewareSystem;
  routes: number;
}

// Distribution stream interface
export interface DistributionStream {
  id: string;
  config: any;
  status: 'active' | 'stopped';
  created_at: number;
  updated_at: number;
}

// Distribution client interface
export interface DistributionClient {
  id: string;
  last_seen: number;
  metadata?: any;
}

// Lazy loading modules interface
interface LazyModules {
  createEmotionAnalysisPipeline?: any;
  distributionModules?: any;
  mediaStreamingModules?: any;
}

// Lazy loading modules storage
const lazyModules: LazyModules = {
  createEmotionAnalysisPipeline: null,
  distributionModules: null,
  mediaStreamingModules: null
};

// Lazy loading functions with proper typing
const getEmotionAnalysisPipeline = async (): Promise<any> => {
  if (!lazyModules.createEmotionAnalysisPipeline) {
    const module = await import('../../features/emotion-analysis/emotion-analysis-pipeline.js');
    lazyModules.createEmotionAnalysisPipeline = module.createEmotionAnalysisPipeline;
  }
  return lazyModules.createEmotionAnalysisPipeline;
};

const getDistributionModules = async (): Promise<any> => {
  if (!lazyModules.distributionModules) {
    lazyModules.distributionModules = await import('../../core/distribution/index.ts');
  }
  return lazyModules.distributionModules;
};

const getMediaStreamingModules = async (): Promise<any> => {
  if (!lazyModules.mediaStreamingModules) {
    const [streamingAPI, coordinator] = await Promise.all([
      import('./media-streaming-api.js'),
      import('../../features/media-streaming/multi-device-coordinator.js')
    ]);
    lazyModules.mediaStreamingModules = {
      createMediaStreamingAPI: streamingAPI.createMediaStreamingAPI,
      createMultiDeviceCoordinator: coordinator.createMultiDeviceCoordinator
    };
  }
  return lazyModules.mediaStreamingModules;
};

// Utility functions with proper typing
const generateSecureId = (prefix: string = ''): string => {
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
};

const getContentType = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'html': 'text/html', 
    'css': 'text/css', 
    'js': 'application/javascript',
    'json': 'application/json', 
    'png': 'image/png', 
    'jpg': 'image/jpeg'
  };
  return mimeTypes[ext || ''] || 'text/plain';
};

const createJSONResponse = (data: any, status: number = 200, headers: Record<string, string> = {}): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
};

const createErrorResponse = (message: string, status: number = 400, headers: Record<string, string> = {}): Response => {
  return createJSONResponse({ error: message, timestamp: Date.now() }, status, headers);
};

const createSuccessResponse = (data: any = {}, headers: Record<string, string> = {}): Response => {
  return createJSONResponse({ success: true, ...data, timestamp: Date.now() }, 200, headers);
};

// Router implementation with proper typing
const createRouter = (): Router => {
  const routes = new Map<string, { pattern: RegExp; handler: RouteHandler }>();
  
  const add = (method: string, pattern: string, handler: RouteHandler): void => {
    const key = `${method}:${pattern}`;
    routes.set(key, { pattern: new RegExp(pattern), handler });
  };
  
  const route = async (request: Request): Promise<Response> => {
    const { method } = request;
    const url = parseRequestURL(request.url);
    const path = url.pathname;
    
    for (const [key, { pattern, handler }] of routes.entries()) {
      if (key.startsWith(`${method}:`)) {
        const match = path.match(pattern);
        if (match) {
          const params = match.slice(1);
          return await handler(request, params);
        }
      }
    }
    
    return new Response('Not Found', { status: 404 });
  };
  
  return { add, route };
};

// Main server factory with comprehensive typing
export const createFaceAnalysisServer = (config: ServerConfig = {}): ServerInstance => {
  const port = config.port || 3000;
  const strategyRegistry = createStrategyRegistry();
  const orchestrator = createOrchestrator({
    strategies: strategyRegistry,
    ...config.orchestrator
  });
  
  // Initialize memory optimizer
  const memoryOptimizer = createMemoryOptimizer({
    memoryPressureThreshold: config.memoryPressureThreshold || 0.75
  });
  memoryOptimizer.startMonitoring();

  // Lazy component initialization
  let emotionPipelineInitialized = false;
  const initializeEmotionPipeline = async (): Promise<void> => {
    if (emotionPipelineInitialized) return;
    
    try {
      console.log('🔄 Lazy loading emotion analysis pipeline...');
      const createEmotionPipeline = await getEmotionAnalysisPipeline();
      const emotionPipeline = createEmotionPipeline({
        smoothingFactor: 0.3,
        confidenceThreshold: 0.5,
        enableValenceArousal: true
      });
      
      await emotionPipeline.initialize();
      orchestrator.registerPipeline(emotionPipeline);
      emotionPipelineInitialized = true;
      console.log('✅ Emotion analysis pipeline lazy loaded and registered');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Failed to lazy load emotion analysis pipeline:', message);
      throw error;
    }
  };

  // Lazy media streaming components
  let mediaStreamingAPI: any = null;
  let multiDeviceCoordinator: any = null;

  const getMediaStreamingAPI = async (): Promise<any> => {
    if (!mediaStreamingAPI) {
      console.log('🔄 Lazy loading media streaming API...');
      const modules = await getMediaStreamingModules();
      mediaStreamingAPI = modules.createMediaStreamingAPI({
        httpHost: config.httpHost || 'localhost',
        httpPort: port,
        websocketHost: config.websocketHost || '0.0.0.0',
        websocketPort: config.websocketPort || 8081,
        discoveryInterval: config.discoveryInterval || 10000
      });
      await mediaStreamingAPI.initialize();
      console.log('✅ Media streaming API lazy loaded');
    }
    return mediaStreamingAPI;
  };

  const getMultiDeviceCoordinator = async (): Promise<any> => {
    if (!multiDeviceCoordinator) {
      console.log('🔄 Lazy loading multi-device coordinator...');
      const modules = await getMediaStreamingModules();
      multiDeviceCoordinator = modules.createMultiDeviceCoordinator({
        defaultQuality: 'medium',
        syncStreaming: true,
        globalQualityControl: true,
        loadBalancing: true,
        adaptiveQuality: true,
        pipelineConfig: {
          bufferSize: 60,
          windowMs: 5000,
          enableQualityControl: true
        }
      });
      console.log('✅ Multi-device coordinator lazy loaded');
    }
    return multiDeviceCoordinator;
  };

  // Lazy distribution system
  let distributionSessionManager: any = null;
  let distributionConfigManager: any = null;
  let distributionPresets: any = null;
  
  const getDistributionSystem = async (): Promise<{
    distributionSessionManager: any;
    distributionConfigManager: any;
    distributionPresets: any;
  }> => {
    if (!distributionSessionManager) {
      console.log('🔄 Lazy loading distribution system...');
      const modules = await getDistributionModules();
      distributionSessionManager = modules.createDistributionSessionManager();
      distributionConfigManager = modules.createDistributionConfigManager();
      distributionPresets = modules.getDistributionPresets();
      console.log('✅ Distribution system lazy loaded');
    }
    return { distributionSessionManager, distributionConfigManager, distributionPresets };
  };

  // Distribution state
  const distributionStreams = new Map<string, DistributionStream>();
  const distributionClients = new Map<string, DistributionClient>();

  const getDistributionOverallStatus = () => {
    const activeStreams = Array.from(distributionStreams.values()).filter(s => s.status === 'active');
    
    return {
      timestamp: Date.now(),
      streams: {
        total: distributionStreams.size,
        active: activeStreams.length,
        stopped: distributionStreams.size - activeStreams.length
      },
      clients: {
        total: distributionClients.size,
        active: Array.from(distributionClients.values()).filter(c => 
          Date.now() - c.last_seen < 60000
        ).length
      }
    };
  };

  const createDistributionStream = async (streamConfig: any): Promise<DistributionStream> => {
    const streamId = generateSecureId('stream');
    
    // Lazy load distribution system
    const { distributionSessionManager, distributionConfigManager } = await getDistributionSystem();
    
    if (!streamConfig.type || !streamConfig.destination || !streamConfig.source) {
      throw new Error('Stream configuration must include type, destination, and source');
    }

    const stream: DistributionStream = {
      id: streamId,
      config: streamConfig,
      status: 'active',
      created_at: Date.now(),
      updated_at: Date.now()
    };
    
    distributionStreams.set(streamId, stream);
    return stream;
  };

  // WebSocket manager with enhanced capabilities
  const wsManager = createWebSocketManager({
    orchestrator,
    initializeEmotionPipeline,
    config: {
      maxWebSocketSessions: config.maxWebSocketSessions || 100,
      websocketTimeout: config.websocketTimeout || 300000,
      maxFrameSize: config.maxFrameSize || 10 * 1024 * 1024,
      enableFrameCache: config.enableFrameCache !== false
    }
  });
  
  // Initialize middleware system with comprehensive configuration
  const middlewareConfig: MiddlewareConfig = {
    cors: {
      allowedOrigins: config.allowedOrigins || [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
      ],
      allowCredentials: config.corsAllowCredentials || false,
      logRequests: config.corsLogRequests || false
    },
    rateLimiting: {
      windowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: config.rateLimitMaxRequests || 100,
      algorithm: config.rateLimitAlgorithm || 'sliding-window'
    },
    errorHandler: {
      enableDetailedErrors: config.enableDetailedErrors || false,
      enableErrorLogging: config.enableErrorLogging !== false
    }
  };
  
  const middlewareSystem = createMiddlewareSystem(middlewareConfig);
  
  // Create router and register all routes
  const router = createRouter();
  
  // Register modular routes
  const routeDependencies = {
    // Lazy loaders
    getMediaStreamingAPI,
    getMultiDeviceCoordinator,
    getDistributionSystem,
    initializeEmotionPipeline,
    
    // Core components
    orchestrator,
    memoryOptimizer,
    
    // Utilities
    middlewareSystem,
    createJSONResponse,
    createErrorResponse,
    generateSecureId,
    decodeFrame: wsManager.frameProcessor.processFrame,
    
    // Distribution
    getDistributionOverallStatus,
    createDistributionStream,
    distributionStreams,
    distributionClients
  };
  
  const routes = createRouteRegistry(routeDependencies);
  routes.forEach(([method, pattern, handler]: [string, string, RouteHandler]) => {
    router.add(method, pattern, handler);
  });

  // Add root route
  router.add('GET', '^/$', async (request: Request): Promise<Response> => {
    return createJSONResponse({
      message: 'Synopticon API Server - TypeScript Version',
      version: '2.0.0',
      routes: routes.length,
      middleware: 'enabled',
      timestamp: Date.now()
    });
  });

  // Create Bun server
  const server = Bun.serve({
    port,
    fetch: async (request: Request, server: any): Promise<Response> => {
      const url = parseRequestURL(request.url);
      
      // WebSocket upgrade (bypass middleware)
      if (url.pathname === '/ws' && server.upgrade(request)) {
        return new Response(); // This won't be reached due to upgrade
      }
      
      // Serve static files from examples directory
      if (url.pathname.startsWith('/examples/')) {
        try {
          const filePath = `.${url.pathname}`;
          const file = Bun.file(filePath);
          
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                'Content-Type': getContentType(filePath),
                'Cache-Control': 'public, max-age=3600'
              }
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Static file error: ${message}`);
        }
        
        return new Response('File not found', { status: 404 });
      }
      
      // Process all HTTP requests through middleware system
      return await middlewareSystem.processRequest(request, async (req: Request) => {
        return await router.route(req);
      });
    },
    
    websocket: wsManager.websocketHandlers
  });

  // Server control
  const start = async (): Promise<any> => {
    console.log(`🚀 Face Analysis API (TypeScript) running on http://${server.hostname}:${server.port}`);
    console.log(`📡 WebSocket endpoint: ws://${server.hostname}:${server.port}/ws`);
    console.log(`📝 Registered ${routes.length} routes across ${Object.keys(routeDependencies).length} modules`);
    return server;
  };
  
  const stop = async (): Promise<void> => {
    console.log('🛑 Stopping Face Analysis API...');
    
    try {
      // Cleanup memory optimizer
      memoryOptimizer.cleanup();
      
      // Cleanup WebSocket manager
      wsManager.cleanup();
      
      // Cleanup middleware system
      middlewareSystem.cleanup();
      
      // Cleanup lazy-loaded components
      if (multiDeviceCoordinator) {
        await multiDeviceCoordinator.cleanup();
      }
      
      if (mediaStreamingAPI) {
        await mediaStreamingAPI.cleanup();
      }
      
      if (distributionSessionManager) {
        await distributionSessionManager.cleanup();
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Warning during cleanup:', message);
    }
    
    server.stop();
    console.log('✅ Face Analysis API stopped');
  };
  
  return {
    start,
    stop,
    server,
    orchestrator,
    strategyRegistry,
    middlewareSystem,
    routes: routes.length
  };
};

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createFaceAnalysisServer({
    port: Number(process.env.PORT) || 3000
  });
  
  server.start().catch(console.error);
  
  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    
    try {
      await server.stop();
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
    
    process.exit(0);
  });
}