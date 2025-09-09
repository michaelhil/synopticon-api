/**
 * Analysis processing logic for server endpoint
 */

export const createAnalysisProcessor = (llmClient, analysisEngine, config) => {
  
  const processTranscript = async (session, transcript) => {
    try {
      // Update session activity
      session.lastActivity = Date.now();
      session.transcripts.push({
        text: transcript,
        timestamp: Date.now(),
        processed: false
      });

      // Process with analysis engine if configured
      let analysisResult = null;
      if (analysisEngine && config.analysisConfig) {
        analysisResult = await analysisEngine.analyze(transcript, {
          sessionId: session.id,
          context: session.context,
          prompts: config.analysisConfig.prompts,
          systemPrompt: config.analysisConfig.systemPrompt
        });
        
        session.analysisHistory.push({
          transcript,
          analysis: analysisResult,
          timestamp: Date.now()
        });
      }

      // Update context if context manager exists
      if (session.context) {
        session.context.addTranscript(transcript);
      }

      // Update analytics if enabled
      if (session.analytics && config.analyticsConfig) {
        await session.analytics.processTranscript(transcript, analysisResult);
      }

      // Mark transcript as processed
      const lastTranscript = session.transcripts[session.transcripts.length - 1];
      lastTranscript.processed = true;

      return {
        success: true,
        analysis: analysisResult,
        sessionStats: {
          totalTranscripts: session.transcripts.length,
          processedTranscripts: session.transcripts.filter(t => t.processed).length,
          sessionDuration: Date.now() - session.createdAt
        }
      };

    } catch (error) {
      console.error(`Analysis processing error for session ${session.id}:`, error);
      return {
        success: false,
        error: error.message,
        sessionStats: {
          totalTranscripts: session.transcripts.length,
          processedTranscripts: session.transcripts.filter(t => t.processed).length,
          sessionDuration: Date.now() - session.createdAt
        }
      };
    }
  };

  const getSessionSummary = async (session) => {
    try {
      if (!session.transcripts.length) {
        return {
          success: false,
          error: 'No transcripts available for summary'
        };
      }

      const allTranscripts = session.transcripts.map(t => t.text).join(' ');
      
      let summary = null;
      if (analysisEngine) {
        summary = await analysisEngine.analyze(allTranscripts, {
          sessionId: session.id,
          context: session.context,
          prompts: ['Provide a comprehensive summary of this conversation.'],
          systemPrompt: 'You are an AI assistant providing conversation summaries. Be concise and highlight key points.'
        });
      }

      return {
        success: true,
        summary,
        analytics: session.analytics ? session.analytics.getSummary() : null,
        sessionStats: {
          totalTranscripts: session.transcripts.length,
          sessionDuration: Date.now() - session.createdAt,
          analysisCount: session.analysisHistory.length
        }
      };

    } catch (error) {
      console.error(`Session summary error for ${session.id}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  const processAnalysisRequest = async (sessionId, transcript, requestConfig = {}, sessionManager) => {
    // Merge request config with default config
    const effectiveConfig = {
      ...config,
      ...requestConfig
    };

    // Get or create session
    const session = getOrCreateSession(sessionId, effectiveConfig, sessionManager);
    
    // Process the transcript
    return processTranscript(session, transcript);
  };

  const getOrCreateSession = (sessionId, effectiveConfig, sessionManager) => {
    let session = sessionManager.getSession(sessionId);
    if (!session) {
      session = sessionManager.createSession(sessionId, effectiveConfig);
      session.analysisHistory = [];
    }
    return session;
  };

  return {
    processTranscript,
    getSessionSummary,
    processAnalysisRequest
  };
};
