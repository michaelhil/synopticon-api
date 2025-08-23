/**
 * Simplified Synopticon API Server
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * Direct BlazeFace integration without WebGL pipeline
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// TensorFlow.js setup for Node.js
import '@tensorflow/tfjs-node'; // Use CPU backend for server
import * as blazeface from '@tensorflow-models/blazeface';

export const createSimpleAPIServer = (config = {}) => {
  const app = express();
  const serverConfig = {
    port: process.env.PORT || 3001,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    },
    maxImageSize: 5 * 1024 * 1024, // 5MB
    ...config
  };

  // Global BlazeFace model
  let blazeFaceModel = null;

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

  // Initialize BlazeFace model
  const initializeBlazeFace = async () => {
    try {
      console.log('🔄 Loading BlazeFace model...');
      
      blazeFaceModel = await blazeface.load({
        inputWidth: 256,
        inputHeight: 256,
        maxFaces: 10,
        iouThreshold: 0.3,
        scoreThreshold: 0.75
      });
      
      console.log('✅ BlazeFace model loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load BlazeFace model:', error);
      throw error;
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
      blazeface: {
        loaded: !!blazeFaceModel,
        backend: 'cpu' // TensorFlow.js Node.js backend
      }
    };

    res.json(health);
  });

  // Get configuration
  app.get('/api/config', (req, res) => {
    const config = {
      algorithm: 'blazeface',
      backend: 'cpu',
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
      if (!blazeFaceModel) {
        return res.status(503).json({
          success: false,
          error: 'BlazeFace model not loaded',
          request_id: requestId
        });
      }

      const { image, format = 'base64', options = {} } = req.body;

      // Process input image
      const imageInfo = await processBase64Image(image);
      
      // Mock BlazeFace results for now (in real implementation, process with model)
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
      await initializeBlazeFace();
      
      const server = app.listen(serverConfig.port, () => {
        console.log(`🚀 Simple Face Analysis API Server listening on port ${serverConfig.port}`);
        console.log(`📋 Health check: http://localhost:${serverConfig.port}/api/health`);
        console.log(`⚙️  Configuration: http://localhost:${serverConfig.port}/api/config`);
      });

      return server;
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  };

  const stop = () => {
    if (blazeFaceModel) {
      // BlazeFace models are cleaned up automatically by TensorFlow.js
      blazeFaceModel = null;
    }
    console.log('🛑 Simple Face Analysis API Server stopped');
  };

  return {
    app,
    start,
    stop,
    getModel: () => blazeFaceModel
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