/**
 * Synopticon API Server - Modular Version
 * Streamlined server with extracted route modules
 */

import { parseRequestURL } from '../../shared/utils/url-utils.js';
import { createOrchestrator } from '../../core/orchestration/orchestrator.js';
import { createStrategyRegistry } from '../../core/orchestration/strategies.js';
import { createAnalysisRequirements } from '../../core/configuration/types.js';
import { createMemoryOptimizer } from '../../core/state/memory-optimization.js';
import { createRouteRegistry } from './routes/index.js';
import { createWebSocketManager } from './websocket/index.js';
import { createMiddlewareSystem } from './middleware/index.js';

// Lazy loading modules
let createEmotionAnalysisPipeline = null;
let distributionModules = null;
let mediaStreamingModules = null;

const getEmotionAnalysisPipeline = async () => {
  if (!createEmotionAnalysisPipeline) {
    const module = await import('../../features/emotion-analysis/emotion-analysis-pipeline.js');
    createEmotionAnalysisPipeline = module.createEmotionAnalysisPipeline;
  }
  return createEmotionAnalysisPipeline;
};

const getDistributionModules = async () => {
  if (!distributionModules) {
    distributionModules = await import('../../core/distribution/index.js');
  }
  return distributionModules;
};

const getMediaStreamingModules = async () => {
  if (!mediaStreamingModules) {
    const [streamingAPI, coordinator] = await Promise.all([
      import('./media-streaming-api.js'),
      import('../../features/media-streaming/multi-device-coordinator.js')
    ]);
    mediaStreamingModules = {
      createMediaStreamingAPI: streamingAPI.createMediaStreamingAPI,
      createMultiDeviceCoordinator: coordinator.createMultiDeviceCoordinator
    };
  }
  return mediaStreamingModules;
};

// Utility functions
const generateSecureId = (prefix = '') => {
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
};

const getContentType = (filePath) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'html': 'text/html', 'css': 'text/css', 'js': 'application/javascript',
    'json': 'application/json', 'png': 'image/png', 'jpg': 'image/jpeg'
  };
  return mimeTypes[ext] || 'text/plain';
};


const createJSONResponse = (data, status = 200, headers = {}) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
};

const createErrorResponse = (message, status = 400, headers = {}) => {
  return createJSONResponse({ error: message, timestamp: Date.now() }, status, headers);
};

const createSuccessResponse = (data = {}, headers = {}) => {
  return createJSONResponse({ success: true, ...data, timestamp: Date.now() }, 200, headers);
};

// Router implementation
const createRouter = () => {
  const routes = new Map();
  
  const add = (method, pattern, handler) => {
    const key = `${method}:${pattern}`;
    routes.set(key, { pattern: new RegExp(pattern), handler });
  };
  
  const route = async (request) => {
    const method = request.method;
    const url = parseRequestURL(request.url);
    const path = url.pathname;
    
    for (const [key, { pattern, handler }] of routes.entries()) {
      if (key.startsWith(method + ':')) {
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

// WebSocket session management is now handled by the WebSocket module

// Frame processing is now handled by the WebSocket frame processor module

// Main server factory
export const createFaceAnalysisServer = (config = {}) => {
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
  const initializeEmotionPipeline = async () => {
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
      console.warn('⚠️ Failed to lazy load emotion analysis pipeline:', error.message);
      throw error;
    }
  };

  // Lazy media streaming components
  let mediaStreamingAPI = null;
  let multiDeviceCoordinator = null;

  const getMediaStreamingAPI = async () => {
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

  const getMultiDeviceCoordinator = async () => {
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
  let distributionSessionManager = null;
  let distributionConfigManager = null;
  let distributionPresets = null;
  
  const getDistributionSystem = async () => {
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
  const distributionStreams = new Map();
  const distributionClients = new Map();

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

  const createDistributionStream = async (config) => {
    const streamId = generateSecureId('stream');
    
    // Lazy load distribution system
    const { distributionSessionManager, distributionConfigManager } = await getDistributionSystem();
    
    if (!config.type || !config.destination || !config.source) {
      throw new Error('Stream configuration must include type, destination, and source');
    }

    const stream = {
      id: streamId,
      config,
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
  
  // Initialize middleware system
  const middlewareSystem = createMiddlewareSystem({
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
  });
  
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
  routes.forEach(([method, pattern, handler]) => {
    router.add(method, pattern, handler);
  });

  // Add root route
  router.add('GET', '^/$', async (request) => {
    return createJSONResponse({
      message: 'Synopticon API Server - Modular Version',
      version: '2.0.0',
      routes: routes.length,
      middleware: 'enabled',
      timestamp: Date.now()
    });
  });

  // Create Bun server
  const server = Bun.serve({
    port,
    fetch: async (request, server) => {
      const url = parseRequestURL(request.url);
      
      // WebSocket upgrade (bypass middleware)
      if (url.pathname === '/ws' && server.upgrade(request)) {
        return;
      }
      
      // Process all HTTP requests through middleware system
      return await middlewareSystem.processRequest(request, async (req) => {
        return await router.route(req);
      });
    },
    
    websocket: wsManager.websocketHandlers
  });

  // Server control
  const start = async () => {
    console.log(`🚀 Face Analysis API (Modular) running on http://${server.hostname}:${server.port}`);
    console.log(`📡 WebSocket endpoint: ws://${server.hostname}:${server.port}/ws`);
    console.log(`📝 Registered ${routes.length} routes across ${Object.keys(routeDependencies).length} modules`);
    return server;
  };
  
  const stop = async () => {
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
      console.warn('Warning during cleanup:', error.message);
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
    port: process.env.PORT || 3000
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