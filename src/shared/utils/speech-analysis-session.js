/**
 * Session management for speech analysis pipeline
 */

import { createSpeechEvent } from '../core/types.js';

export const createSessionManager = (speechAPI, callbacks) => {
  let activeSession = null;
  let sessionData = null;
  let totalSessions = 0;

  // Start a speech analysis session
  const startSession = async (sessionId = null) => {
    try {
      activeSession = await speechAPI.startSession(sessionId);
      sessionData = {
        startTime: Date.now(),
        transcriptions: [],
        analyses: []
      };
      totalSessions++;
      
      // Notify session start callbacks
      callbacks.onSessionStart.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'session_start',
            data: { sessionId: activeSession }
          }));
        } catch (error) {
          console.warn('Session start callback error:', error);
        }
      });

      return activeSession;

    } catch (error) {
      console.warn('Failed to start speech session:', error);
      throw error;
    }
  };

  // Stop current session
  const stopSession = async () => {
    if (!activeSession) {
      console.warn('No active session to stop');
      return;
    }

    try {
      await speechAPI.stopSession();
      
      const sessionId = activeSession;
      const sessionDuration = Date.now() - (sessionData?.startTime || Date.now());
      
      // Notify session end callbacks
      callbacks.onSessionEnd.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'session_end',
            data: { 
              sessionId, 
              duration: sessionDuration,
              transcriptions: sessionData?.transcriptions?.length || 0,
              analyses: sessionData?.analyses?.length || 0
            }
          }));
        } catch (error) {
          console.warn('Session end callback error:', error);
        }
      });

      activeSession = null;
      sessionData = null;

    } catch (error) {
      console.warn('Failed to stop speech session:', error);
      throw error;
    }
  };

  // Add transcription to session
  const addTranscription = (transcription) => {
    if (sessionData) {
      sessionData.transcriptions.push(transcription);
    }
  };

  // Add analysis to session
  const addAnalysis = (analysis) => {
    if (sessionData) {
      sessionData.analyses.push(analysis);
    }
  };

  return {
    startSession,
    stopSession,
    addTranscription,
    addAnalysis,
    getActiveSession: () => activeSession,
    getSessionData: () => sessionData,
    getTotalSessions: () => totalSessions
  };
};