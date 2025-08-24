#!/usr/bin/env node

/**
 * Speech Analysis Server
 * HTTP server for speech analysis API
 * Receives transcripts from browser clients and performs analysis
 */

import express from 'express';
import cors from 'cors';
import { createServerAnalysisHandler } from './src/server-analysis-endpoint.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Container-friendly binding

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'speech-analysis-server',
    timestamp: Date.now()
  });
});

// Initialize analysis handler
let analysisHandler = null;

const initializeHandler = async () => {
  try {
    console.log('🚀 Initializing speech analysis server...');
    
    // Create handler with configuration from environment or defaults
    analysisHandler = createServerAnalysisHandler({
      llmBackend: process.env.LLM_BACKEND || 'ollama',
      llmModel: process.env.LLM_MODEL || 'llama3.2',
      llmApiUrl: process.env.LLM_API_URL || 'http://host.docker.internal:11434', // Docker-friendly default
      maxSessions: parseInt(process.env.MAX_SESSIONS) || 100,
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000,
      enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false'
    });
    
    await analysisHandler.initialize();
    
    console.log('✅ Speech analysis handler initialized');
    return true;
    
  } catch (error) {
    console.error('Failed to initialize analysis handler:', error);
    return false;
  }
};

// Analysis endpoint
app.post('/api/analyze', async (req, res, next) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  // Use the Express middleware from handler
  const middleware = analysisHandler.createExpressMiddleware();
  middleware(req, res, next);
});

// Get session endpoint
app.get('/api/session/:sessionId', async (req, res) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  try {
    const session = analysisHandler.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }
    
    res.json(session);
    
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Update session metadata
app.patch('/api/session/:sessionId/metadata', async (req, res) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  try {
    const metadata = analysisHandler.updateSessionMetadata(
      req.params.sessionId,
      req.body
    );
    
    res.json({
      sessionId: req.params.sessionId,
      metadata
    });
    
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// End session endpoint
app.delete('/api/session/:sessionId', async (req, res) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  try {
    const ended = analysisHandler.endSession(req.params.sessionId);
    
    res.json({
      sessionId: req.params.sessionId,
      ended
    });
    
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get active sessions
app.get('/api/sessions', async (req, res) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  try {
    const sessions = analysisHandler.getActiveSessions();
    
    res.json({
      count: sessions.length,
      sessions
    });
    
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get server statistics
app.get('/api/stats', async (req, res) => {
  if (!analysisHandler) {
    return res.status(503).json({
      error: 'Service not ready'
    });
  }
  
  try {
    const stats = analysisHandler.getStatistics();
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n📴 Shutting down server...');
  
  if (analysisHandler) {
    await analysisHandler.cleanup();
  }
  
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const startServer = async () => {
  // Initialize handler
  const initialized = await initializeHandler();
  
  if (!initialized) {
    console.error('❌ Failed to initialize server. Exiting...');
    process.exit(1);
  }
  
  // Start listening
  app.listen(PORT, HOST, () => {
    console.log(`🎙️ Speech Analysis Server running on ${HOST}:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   POST   /api/analyze              - Analyze transcripts`);
    console.log(`   GET    /api/session/:id          - Get session data`);
    console.log(`   PATCH  /api/session/:id/metadata - Update session metadata`);
    console.log(`   DELETE /api/session/:id          - End session`);
    console.log(`   GET    /api/sessions             - List active sessions`);
    console.log(`   GET    /api/stats                - Server statistics`);
    console.log(`   GET    /health                   - Health check`);
  });
};

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});