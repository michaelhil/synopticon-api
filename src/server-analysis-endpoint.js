/**
 * Server Analysis Endpoint
 * Handles speech analysis on the server side
 * Receives transcripts from browser clients and performs LLM analysis
 * Following functional programming patterns with factory functions
 */

import { createLLMClient } from './speech-analysis/llm-client.js';
import { createAnalysisEngine } from './speech-analysis/analysis-engine.js';
import { createContextManager } from './speech-analysis/context-manager.js';
import { createConversationAnalytics } from './speech-analysis/conversation-analytics.js';

// Create server analysis handler factory
export const createServerAnalysisHandler = (config = {}) => {
  const state = {
    sessions: new Map(),
    
    // Configuration
    config: {
      maxSessions: config.maxSessions || 100,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      
      // LLM configuration
      llmConfig: {
        preferredBackend: config.llmBackend || 'ollama',
        model: config.llmModel || 'llama3.2',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 150,
        apiUrl: config.llmApiUrl || 'http://host.docker.internal:11434',
        ...config.llmConfig
      },
      
      // Analysis configuration
      analysisConfig: {
        prompts: config.prompts || [
          'Analyze the sentiment and key themes in this conversation segment.',
          'Identify any action items or decisions made.',
          'Summarize the main points in 2-3 sentences.'
        ],
        systemPrompt: config.systemPrompt || 
          'You are an AI assistant analyzing conversation transcripts. Provide concise, actionable insights.',
        maxConcurrency: config.maxConcurrency || 3,
        ...config.analysisConfig
      },
      
      // Context configuration
      contextConfig: {
        strategy: config.contextStrategy || 'sliding_window',
        maxChunks: config.maxChunks || 20,
        summaryThreshold: config.summaryThreshold || 30,
        ...config.contextConfig
      },
      
      // Analytics configuration
      analyticsConfig: {
        enabled: config.enableAnalytics !== false,
        trackSentiment: true,
        trackTopics: true,
        trackSpeakingPatterns: true,
        ...config.analyticsConfig
      }
    },
    
    // Shared resources
    llmClient: null,
    analysisEngine: null,
    cleanupTimer: null
  };

  // Session factory
  const createSession = (sessionId) => {
    const contextManager = createContextManager(state.config.contextConfig);
    const analytics = state.config.analyticsConfig.enabled 
      ? createConversationAnalytics(state.config.analyticsConfig)
      : null;
    
    if (analytics) {
      analytics.initialize();
      analytics.startAnalysis();
    }
    
    return {
      id: sessionId,
      contextManager,
      analytics,
      transcripts: [],
      analysisResults: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: {}
    };
  };

  // Initialize server handler
  const initialize = async () => {
    console.log('🚀 Initializing server analysis handler...');
    
    // Create LLM client
    state.llmClient = createLLMClient(state.config.llmConfig);
    await state.llmClient.initialize();
    
    // Create analysis engine
    state.analysisEngine = createAnalysisEngine({
      llmClient: state.llmClient,
      ...state.config.analysisConfig
    });
    
    // Start cleanup timer
    state.cleanupTimer = setInterval(() => {
      cleanupSessions();
    }, state.config.cleanupInterval);
    
    console.log('✅ Server analysis handler initialized');
    return true;
  };

  // Process incoming transcripts
  const processTranscripts = async (sessionId, transcripts) => {
    // Get or create session
    let session = state.sessions.get(sessionId);
    if (!session) {
      session = createSession(sessionId);
      state.sessions.set(sessionId, session);
      console.log(`📝 Created new session: ${sessionId}`);
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    
    // Process each transcript
    const results = [];
    
    for (const transcript of transcripts) {
      try {
        // Add to session transcripts
        session.transcripts.push(transcript);
        
        // Add to context manager
        const context = session.contextManager.addChunk(transcript.text, {
          timestamp: transcript.timestamp,
          confidence: transcript.confidence
        });
        
        // Add to analytics if enabled
        if (session.analytics) {
          session.analytics.addChunk(
            { text: transcript.text, timestamp: transcript.timestamp },
            transcript.participantId || 'default'
          );
        }
        
        // Perform analysis if text is substantial
        if (transcript.text.split(' ').length > 5) {
          const analysisResult = await analyzeTranscript(
            transcript.text,
            context,
            session
          );
          
          if (analysisResult) {
            session.analysisResults.push(analysisResult);
            results.push(analysisResult);
            
            // Add analysis results to analytics
            if (session.analytics && analysisResult.analyses) {
              analysisResult.analyses.forEach(analysis => {
                session.analytics.addChunk(
                  { text: transcript.text, timestamp: transcript.timestamp },
                  'default',
                  [analysis]
                );
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing transcript:`, error);
        results.push({
          error: error.message,
          transcript: transcript.text
        });
      }
    }
    
    // Get session summary
    const summary = getSessionSummary(session);
    
    return {
      sessionId,
      results,
      summary,
      timestamp: Date.now()
    };
  };

  // Analyze individual transcript
  const analyzeTranscript = async (text, context, session) => {
    try {
      // Build context for analysis
      const analysisContext = {
        currentText: text,
        previousChunks: context.chunks.slice(-5),
        summary: context.summary
      };
      
      // Perform analysis with multiple prompts
      const analyses = await Promise.all(
        state.config.analysisConfig.prompts.map(async (prompt) => {
          try {
            const result = await state.analysisEngine.analyze(
              text,
              prompt,
              analysisContext
            );
            
            return {
              prompt,
              result: result.response,
              confidence: result.confidence || 0.8,
              timestamp: Date.now()
            };
          } catch (error) {
            console.warn(`Analysis failed for prompt "${prompt}":`, error);
            return null;
          }
        })
      );
      
      // Filter out failed analyses
      const validAnalyses = analyses.filter(a => a !== null);
      
      if (validAnalyses.length === 0) {
        return null;
      }
      
      return {
        text,
        analyses: validAnalyses,
        context: {
          chunkCount: context.chunks.length,
          hasSummary: !!context.summary
        },
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  };

  // Get session summary
  const getSessionSummary = (session) => {
    const summary = {
      transcriptCount: session.transcripts.length,
      analysisCount: session.analysisResults.length,
      duration: Date.now() - session.createdAt,
      lastActivity: session.lastActivity
    };
    
    // Add analytics summary if available
    if (session.analytics) {
      summary.analytics = session.analytics.getSummary();
    }
    
    // Add context summary
    const context = session.contextManager.getContext();
    summary.context = {
      chunkCount: context.chunks.length,
      hasSummary: !!context.summary,
      totalWords: context.chunks.reduce((sum, chunk) => 
        sum + chunk.text.split(' ').length, 0
      )
    };
    
    return summary;
  };

  // Get full session data
  const getSession = (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    return {
      id: session.id,
      transcripts: session.transcripts,
      analysisResults: session.analysisResults,
      summary: getSessionSummary(session),
      analytics: session.analytics ? session.analytics.getMetrics() : null,
      context: session.contextManager.getContext(),
      metadata: session.metadata,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    };
  };

  // Update session metadata
  const updateSessionMetadata = (sessionId, metadata) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    Object.assign(session.metadata, metadata);
    session.lastActivity = Date.now();
    
    return session.metadata;
  };

  // End session
  const endSession = (sessionId) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Cleanup analytics
    if (session.analytics) {
      session.analytics.stopAnalysis();
      session.analytics.cleanup();
    }
    
    // Remove session
    state.sessions.delete(sessionId);
    console.log(`🏁 Ended session: ${sessionId}`);
    
    return true;
  };

  // Cleanup old sessions
  const cleanupSessions = () => {
    const now = Date.now();
    const timeout = state.config.sessionTimeout;
    
    let cleanedCount = 0;
    
    state.sessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > timeout) {
        endSession(sessionId);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} inactive sessions`);
    }
  };

  // Create Express middleware
  const createExpressMiddleware = () => {
    return async (req, res) => {
      try {
        const { sessionId, transcripts, action } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({
            error: 'Session ID required'
          });
        }
        
        // Handle different actions
        switch (action) {
          case 'analyze':
          case undefined: // Default action
            if (!transcripts || !Array.isArray(transcripts)) {
              return res.status(400).json({
                error: 'Transcripts array required'
              });
            }
            
            const result = await processTranscripts(sessionId, transcripts);
            return res.json(result);
            
          case 'getSession':
            const sessionData = getSession(sessionId);
            if (!sessionData) {
              return res.status(404).json({
                error: 'Session not found'
              });
            }
            return res.json(sessionData);
            
          case 'updateMetadata':
            const metadata = updateSessionMetadata(sessionId, req.body.metadata || {});
            return res.json({ sessionId, metadata });
            
          case 'endSession':
            const ended = endSession(sessionId);
            return res.json({ sessionId, ended });
            
          default:
            return res.status(400).json({
              error: `Unknown action: ${action}`
            });
        }
        
      } catch (error) {
        console.error('Request processing error:', error);
        res.status(500).json({
          error: error.message
        });
      }
    };
  };

  // Create WebSocket handler
  const createWebSocketHandler = () => {
    return {
      onConnection: (ws, sessionId) => {
        console.log(`🔌 WebSocket connected for session: ${sessionId}`);
        
        // Create session if needed
        if (!state.sessions.has(sessionId)) {
          const session = createSession(sessionId);
          state.sessions.set(sessionId, session);
        }
        
        // Send initial status
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId,
          timestamp: Date.now()
        }));
      },
      
      onMessage: async (ws, sessionId, data) => {
        try {
          const message = JSON.parse(data);
          
          switch (message.type) {
            case 'transcript':
              const result = await processTranscripts(sessionId, [message.transcript]);
              ws.send(JSON.stringify({
                type: 'analysis',
                ...result
              }));
              break;
              
            case 'getStatus':
              const session = getSession(sessionId);
              ws.send(JSON.stringify({
                type: 'status',
                session: session ? session.summary : null
              }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                error: `Unknown message type: ${message.type}`
              }));
          }
          
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
      },
      
      onClose: (sessionId) => {
        console.log(`🔌 WebSocket disconnected for session: ${sessionId}`);
      }
    };
  };

  // Cleanup
  const cleanup = async () => {
    // Stop cleanup timer
    if (state.cleanupTimer) {
      clearInterval(state.cleanupTimer);
      state.cleanupTimer = null;
    }
    
    // End all sessions
    state.sessions.forEach((session, sessionId) => {
      endSession(sessionId);
    });
    
    // Cleanup LLM client
    if (state.llmClient) {
      await state.llmClient.cleanup();
    }
    
    console.log('🧹 Server analysis handler cleaned up');
  };

  // Get statistics
  const getStatistics = () => {
    const sessionStats = Array.from(state.sessions.values()).map(session => ({
      id: session.id,
      transcripts: session.transcripts.length,
      analyses: session.analysisResults.length,
      duration: Date.now() - session.createdAt,
      lastActivity: session.lastActivity
    }));
    
    return {
      activeSessions: state.sessions.size,
      totalTranscripts: sessionStats.reduce((sum, s) => sum + s.transcripts, 0),
      totalAnalyses: sessionStats.reduce((sum, s) => sum + s.analyses, 0),
      sessions: sessionStats,
      config: state.config
    };
  };

  return {
    // Core functionality
    initialize,
    processTranscripts,
    getSession,
    updateSessionMetadata,
    endSession,
    cleanup,
    
    // Middleware/handlers
    createExpressMiddleware,
    createWebSocketHandler,
    
    // Statistics
    getStatistics,
    getActiveSessions: () => Array.from(state.sessions.keys()),
    
    // Configuration
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
    },
    getConfig: () => ({ ...state.config })
  };
};

// Export default configuration
export const DEFAULT_SERVER_CONFIG = {
  maxSessions: 100,
  sessionTimeout: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
  llmBackend: 'ollama',
  llmModel: 'llama3.2',
  llmApiUrl: 'http://host.docker.internal:11434',
  temperature: 0.7,
  maxTokens: 150,
  enableAnalytics: true
};