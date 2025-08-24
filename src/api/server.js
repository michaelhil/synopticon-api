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

// Simple HTTP response utilities
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
    origin = allowedOrigins[0]; // Default to first allowed origin
  }
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'false',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
};

const sendJSON = (res, data, status = 200, req = null) => {
  res.writeHead(status, setCORSHeaders(req, res));
  res.end(JSON.stringify(data));
};

const sendError = (res, message, status = 400, req = null) => {
  sendJSON(res, { error: message, timestamp: Date.now() }, status, req);
};

// API Authentication
const generateSecureApiKey = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

const validateApiKey = (apiKey) => {
  // In production, check against database or environment variable
  const validKeys = (process.env.API_KEYS || '').split(',').filter(k => k.trim());
  
  if (validKeys.length === 0) {
    // Development mode - generate and log a key if none exist
    if (process.env.NODE_ENV !== 'production') {
      const devKey = generateSecureApiKey();
      console.warn('⚠️ No API keys configured. Development key:', devKey);
      console.warn('Set API_KEYS environment variable for production');
      return apiKey === devKey || apiKey === 'dev-key-synopticon-2024';
    }
    return false;
  }
  
  return validKeys.includes(apiKey);
};

const authenticateRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return sendError(res, 'API key required', 401, req);
  }
  
  if (!validateApiKey(apiKey)) {
    return sendError(res, 'Invalid API key', 401, req);
  }
  
  req.authenticated = true;
  next();
};

// Rate limiting
const createRateLimiter = () => {
  const requests = new Map();
  const limit = parseInt(process.env.RATE_LIMIT || '100');
  const window = parseInt(process.env.RATE_WINDOW || '900000'); // 15 minutes
  
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const ipRequests = requests.get(ip);
    
    // Clean old requests
    while (ipRequests.length > 0 && (now - ipRequests[0]) > window) {
      ipRequests.shift();
    }
    
    if (ipRequests.length >= limit) {
      return sendError(res, 'Rate limit exceeded', 429, req);
    }
    
    ipRequests.push(now);
    next();
  };
};

const sendSuccess = (res, data = {}, req = null) => {
  sendJSON(res, { success: true, ...data, timestamp: Date.now() }, 200, req);
};

// Secure ID generation
const generateSecureId = (prefix = '') => {
  const crypto = require('crypto');
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
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
export const createSynopticonAPIServer = (config = {}) => {
  const port = config.port || 3000;
  const orchestrator = createOrchestrator(config.orchestrator);
  const strategyRegistry = createStrategyRegistry();
  const router = createRouter();
  const wsManager = createWebSocketManager(orchestrator);

  // Request validation middleware
  const validateImageInput = [
    body('image').notEmpty().withMessage('Image data is required'),
    body('format').optional().isIn(['base64', 'url']).withMessage('Format must be base64 or url'),
    body('pipeline').optional().isIn(['fast', 'accurate', 'full', 'api']).withMessage('Invalid pipeline type'),
    body('options').optional().isObject().withMessage('Options must be an object')
  ];

  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  };

  // Initialize analysis engine
  const initializeEngine = async () => {
    try {
      console.log('🔄 Initializing Synopticon API Engine...');
      
      // Create off-screen canvas for server processing
      const canvas = createCanvas(640, 480);
      
      analysisEngine = createFaceAnalysisEngine(canvas, {
        pipelineType: serverConfig.defaultPipeline,
        performance: {
          enableMonitoring: true,
          enableGPU: true
        }
      });

      await analysisEngine.initialize();
      console.log('✅ Synopticon API Engine initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Synopticon API Engine:', error);
      throw error;
    }
  };

  // Helper function to process image input
  const processImageInput = async (imageData, format = 'base64') => {
    try {
      let canvas;
      
      if (format === 'base64') {
        // Handle base64 encoded image
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create image from buffer (this would need a proper image loading library)
        // For now, we'll create a placeholder implementation
        canvas = await createCanvasFromBuffer(buffer);
        
      } else if (format === 'url') {
        // Handle image URL
        canvas = await createCanvasFromURL(imageData);
      } else {
        throw new Error('Unsupported image format');
      }

      return canvas;
    } catch (error) {
      throw new Error(`Failed to process image input: ${error.message}`);
    }
  };

  // API Routes
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      engine: {
        initialized: analysisEngine?.isReady() || false,
        features: analysisEngine?.getAvailableFeatures() || {},
        stats: analysisEngine?.getStats() || null
      }
    };

    res.json(health);
  });

  // Get available algorithms and configurations
  app.get('/api/config', (req, res) => {
    if (!analysisEngine) {
      return res.status(503).json({
        success: false,
        error: 'Analysis engine not initialized'
      });
    }

    const config = {
      availableAlgorithms: analysisEngine.getPipeline()?.getAvailableModules() || {},
      supportedPipelines: ['fast', 'accurate', 'full', 'api'],
      currentConfiguration: {
        features: analysisEngine.getAvailableFeatures(),
        modules: analysisEngine.getPipeline()?.getModuleInfo() || []
      },
      limits: {
        maxImageSize: serverConfig.maxImageSize,
        rateLimit: serverConfig.rateLimit
      }
    };

    res.json({
      success: true,
      data: config
    });
  });

  // Face detection endpoint
  app.post('/api/v1/detect', validateImageInput, handleValidationErrors, async (req, res) => {
    const requestId = generateSecureId('req');
    const startTime = performance.now();

    try {
      if (!analysisEngine) {
        return res.status(503).json({
          success: false,
          error: 'Analysis engine not initialized',
          request_id: requestId
        });
      }

      const { image, format = 'base64', pipeline = 'api', options = {} } = req.body;

      // Process input image
      const canvas = await processImageInput(image, format);
      
      // Switch pipeline if different from current
      if (pipeline !== serverConfig.defaultPipeline) {
        // This would require pipeline switching implementation
        console.log(`Requested pipeline: ${pipeline}`);
      }

      // Process single frame (mock implementation for now)
      const mockResults = {
        faces: [
          {
            id: 'face_0',
            bbox: { x: 150, y: 100, width: 200, height: 200 },
            confidence: 0.95,
            landmarks: [
              { id: 0, x: 180, y: 140, name: 'rightEye' },
              { id: 1, x: 220, y: 140, name: 'leftEye' },
              { id: 2, x: 200, y: 170, name: 'noseTip' },
              { id: 3, x: 200, y: 200, name: 'mouthCenter' }
            ]
          }
        ],
        count: 1,
        processingInfo: {
          algorithm: 'blazeface',
          inputSize: [canvas.width, canvas.height],
          pipeline: pipeline
        }
      };

      const processingTime = performance.now() - startTime;

      res.json({
        success: true,
        request_id: requestId,
        processing_time: Math.round(processingTime * 100) / 100,
        data: mockResults,
        metadata: {
          pipeline_used: pipeline,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      console.error(`Request ${requestId} failed:`, error);
      
      res.status(500).json({
        success: false,
        request_id: requestId,
        processing_time: Math.round(processingTime * 100) / 100,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Batch processing endpoint
  app.post('/api/v1/batch', async (req, res) => {
    const requestId = generateSecureId('batch');
    const startTime = performance.now();

    try {
      const { images, pipeline = 'api', options = {} } = req.body;

      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Images array is required and must not be empty',
          request_id: requestId
        });
      }

      if (images.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Batch size limited to 10 images',
          request_id: requestId
        });
      }

      // Process images in batch (mock implementation)
      const results = [];
      
      for (let i = 0; i < images.length; i++) {
        const mockResult = {
          image_index: i,
          faces: [],
          count: 0,
          success: true
        };
        results.push(mockResult);
      }

      const processingTime = performance.now() - startTime;

      res.json({
        success: true,
        request_id: requestId,
        processing_time: Math.round(processingTime * 100) / 100,
        data: {
          results,
          total_images: images.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        },
        metadata: {
          pipeline_used: pipeline,
          batch_size: images.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      res.status(500).json({
        success: false,
        request_id: requestId,
        processing_time: Math.round(processingTime * 100) / 100,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      available_endpoints: [
        'GET /api/health',
        'GET /api/config', 
        'POST /api/v1/detect',
        'POST /api/v1/batch'
      ]
    });
  });

  // Server control functions
  const start = async () => {
    try {
      await initializeEngine();
      
      const host = process.env.HOST || '0.0.0.0';
      const server = app.listen(serverConfig.port, host, () => {
        console.log(`🚀 Synopticon API Server listening on ${host}:${serverConfig.port}`);
        console.log(`📋 Health check: http://${host}:${serverConfig.port}/api/health`);
        console.log(`⚙️  Configuration: http://${host}:${serverConfig.port}/api/config`);
      });

      return server;
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  };

  const stop = () => {
    if (analysisEngine) {
      analysisEngine.cleanup();
      analysisEngine = null;
    }
    console.log('🛑 Synopticon API Server stopped');
  };

  return {
    app,
    start,
    stop,
    getEngine: () => analysisEngine
  };
};

// Placeholder implementations for image processing
// These would be replaced with proper image loading libraries like 'canvas' or 'sharp'
const createCanvasFromBuffer = async (buffer) => {
  // Mock implementation - would use proper image decoding
  const canvas = createCanvas(640, 480);
  return canvas;
};

const createCanvasFromURL = async (url) => {
  // Mock implementation - would fetch and decode image
  const canvas = createCanvas(640, 480);
  return canvas;
};

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createAPIServer();
  server.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}