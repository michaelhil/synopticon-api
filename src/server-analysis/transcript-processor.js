/**
 * Transcript processing logic for server analysis
 */

import { createContextManager } from '../features/speech-analysis/context-manager.js';
import { createConversationAnalytics } from '../features/speech-analysis/conversation-analytics.js';

export const createTranscriptProcessor = (analysisEngine, config) => {

  // Create session with all components
  const createSessionComponents = (sessionId) => {
    const contextManager = createContextManager(config.contextConfig);
    const analytics = config.analyticsConfig.enabled 
      ? createConversationAnalytics(config.analyticsConfig)
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

  // Process incoming transcripts
  const processTranscripts = async (sessionManager, sessionId, transcripts) => {
    // Get or create session
    let session = sessionManager.getSession(sessionId);
    if (!session) {
      const components = createSessionComponents(sessionId);
      session = sessionManager.createSession(sessionId, components.config);
      
      // Add components to session
      session.contextManager = components.contextManager;
      session.analytics = components.analytics;
      session.transcripts = components.transcripts;
      session.analysisResults = components.analysisResults;
      session.metadata = components.metadata;
      
      console.log(`📝 Created new session: ${sessionId}`);
    }
    
    // Update last activity
    sessionManager.updateActivity(sessionId);
    
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
        config.analysisConfig.prompts.map(async (prompt) => {
          try {
            const result = await analysisEngine.analyze(
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
  const getSession = (sessionManager, sessionId) => {
    const session = sessionManager.getSession(sessionId);
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
  const updateSessionMetadata = (sessionManager, sessionId, metadata) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    Object.assign(session.metadata, metadata);
    sessionManager.updateActivity(sessionId);
    
    return session.metadata;
  };

  // End session
  const endSession = (sessionManager, sessionId) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return false;
    }
    
    // Cleanup analytics
    if (session.analytics) {
      session.analytics.stopAnalysis();
      session.analytics.cleanup();
    }
    
    // Remove session via session manager
    sessionManager.removeSession(sessionId);
    console.log(`🏁 Ended session: ${sessionId}`);
    
    return true;
  };

  // Get statistics
  const getStatistics = (sessionManager) => {
    const sessions = sessionManager.getAllSessions();
    const sessionStats = sessions.map(session => ({
      id: session.id,
      transcripts: session.transcripts.length,
      analyses: session.analysisResults.length,
      duration: Date.now() - session.createdAt,
      lastActivity: session.lastActivity
    }));
    
    return {
      activeSessions: sessions.length,
      totalTranscripts: sessionStats.reduce((sum, s) => sum + s.transcripts, 0),
      totalAnalyses: sessionStats.reduce((sum, s) => sum + s.analyses, 0),
      sessions: sessionStats,
      config
    };
  };

  return {
    processTranscripts,
    getSession,
    updateSessionMetadata,
    endSession,
    getStatistics
  };
};