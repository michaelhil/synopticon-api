/**
 * Bun.serve request handlers for server analysis
 */

export const createBunHandlers = (sessionManager, processTranscriptsFn, getSessionFn, updateSessionMetadataFn, endSessionFn) => {
  
  // Create Bun.serve request handler
  const createAnalysisHandler = () => {
    return async (request) => {
      try {
        const body = await request.json();
        const { sessionId, transcripts, action } = body;
        
        if (!sessionId) {
          return new Response(JSON.stringify({
            error: 'Session ID required'
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Handle different actions
        switch (action) {
          case 'analyze':
          case undefined: // Default action
            if (!transcripts || !Array.isArray(transcripts)) {
              return new Response(JSON.stringify({
                error: 'Transcripts array required'
              }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            const result = await processTranscriptsFn(sessionId, transcripts);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          case 'getSession':
            const sessionData = getSessionFn(sessionId);
            if (!sessionData) {
              return new Response(JSON.stringify({
                error: 'Session not found'
              }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            return new Response(JSON.stringify(sessionData), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          case 'updateMetadata':
            const metadata = updateSessionMetadataFn(sessionId, body.metadata || {});
            return new Response(JSON.stringify({ sessionId, metadata }), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          case 'endSession':
            const ended = endSessionFn(sessionId);
            return new Response(JSON.stringify({ sessionId, ended }), {
              headers: { 'Content-Type': 'application/json' }
            });
            
          default:
            return new Response(JSON.stringify({
              error: `Unknown action: ${action}`
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
        }
        
      } catch (error) {
        console.error('Request processing error:', error);
        return new Response(JSON.stringify({
          error: error.message
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
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
        let session = sessionManager.getSession(sessionId);
        if (!session) {
          session = sessionManager.createSession(sessionId);
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
              const result = await processTranscriptsFn(sessionId, [message.transcript]);
              ws.send(JSON.stringify({
                type: 'analysis',
                ...result
              }));
              break;
              
            case 'getStatus':
              const session = getSessionFn(sessionId);
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

  return {
    createAnalysisHandler,
    createWebSocketHandler
  };
};