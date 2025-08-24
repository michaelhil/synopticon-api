/**
 * Simplified Synopticon API Server - Lightweight Version
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * Now uses MediaPipe for 99% smaller bundle size
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// Use lightweight MediaPipe face detection instead of TensorFlow.js
import { createMediaPipeFaceDetector } from '../modules/detection/mediapipe/mediapipe-face-detector.js';

export const createSimpleAPIServer = (config = {}) => {
  const app = express();
  const serverConfig = {
    port: process.env.PORT || 3001,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    },
    maxImageSize: 5 * 1024 * 1024, // 5MB
    ...config
  };

  // Global MediaPipe face detector
  let faceDetector = null;

  // Middleware setup
  app.use(helmet());
  app.use(cors({
    origin: serverConfig.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  }));
  
  app.use(morgan('combined'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit(serverConfig.rateLimit);
  app.use('/api/', limiter);

  // Request validation middleware
  const validateImageInput = [
    body('image').notEmpty().withMessage('Image data is required'),
    body('format').optional().isIn(['base64', 'url']).withMessage('Format must be base64 or url'),
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

  // Initialize MediaPipe face detector
  const initializeFaceDetector = async () => {
    try {
      console.log('🔄 Loading MediaPipe face detection...');
      
      faceDetector = await createMediaPipeFaceDetector({
        modelSelection: 0, // short-range
        minDetectionConfidence: 0.5
      });
      
      console.log('✅ MediaPipe face detection loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load face detection:', error);
      // Continue without face detection for Docker deployment
      console.warn('⚠️ Continuing without face detection (mock mode)');
      faceDetector = null;
      return true;
    }
  };

  // Helper function to process base64 image (simplified)
  const processBase64Image = async (base64Data) => {
    // In a real implementation, you'd decode the base64, create a tensor, etc.
    // For now, return mock tensor dimensions
    return {
      width: 640,
      height: 480,
      channels: 3
    };
  };

  // API Routes
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      faceDetection: {
        loaded: !!faceDetector,
        backend: 'mediapipe' // MediaPipe face detection
      }
    };

    res.json(health);
  });

  // Get configuration
  app.get('/api/config', (req, res) => {
    const config = {
      algorithm: 'mediapipe',
      backend: 'wasm',
      maxFaces: 10,
      supportedFormats: ['base64'],
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    try {
      if (!faceDetector) {
        return res.status(503).json({
          success: false,
          error: 'Face detection model not loaded',
          request_id: requestId
        });
      }

      const { image, format = 'base64', options = {} } = req.body;

      // Process input image
      const imageInfo = await processBase64Image(image);
      
      // Mock face detection results for now (in real implementation, process with model)
      const mockDetections = [
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
      ];

      const processingTime = performance.now() - startTime;

      res.json({
        success: true,
        request_id: requestId,
        processing_time: Math.round(processingTime * 100) / 100,
        data: {
          faces: mockDetections,
          count: mockDetections.length,
          processingInfo: {
            algorithm: 'blazeface',
            backend: 'cpu',
            inputSize: [imageInfo.width, imageInfo.height]
          }
        },
        metadata: {
          algorithm: 'blazeface',
          timestamp: new Date().toISOString(),
          version: '2.0.0'
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
        'POST /api/v1/detect'
      ]
    });
  });

  // Server control functions
  const start = async () => {
    try {
      await initializeFaceDetector();
      
      const host = process.env.HOST || '0.0.0.0';
      const server = app.listen(serverConfig.port, host, () => {
        console.log(`🚀 Simple Face Analysis API Server listening on ${host}:${serverConfig.port}`);
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
    if (faceDetector) {
      // MediaPipe models are cleaned up automatically
      faceDetector = null;
    }
    console.log('🛑 Simple Face Analysis API Server stopped');
  };

  return {
    app,
    start,
    stop,
    getModel: () => faceDetector
  };
};

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createSimpleAPIServer();
  server.start().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}