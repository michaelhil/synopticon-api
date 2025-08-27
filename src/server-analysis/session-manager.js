/**
 * Session management for server analysis
 */

export const createSessionManager = (config) => {
  const sessions = new Map();
  let cleanupTimer = null;

  const createSession = (sessionId, userConfig = {}) => {
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      transcripts: [],
      analysisHistory: [],
      context: null,
      analytics: null,
      config: { ...config, ...userConfig }
    };

    sessions.set(sessionId, session);
    
    // Update activity
    updateActivity(sessionId);
    
    return session;
  };

  const getSession = (sessionId) => {
    return sessions.get(sessionId);
  };

  const updateActivity = (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  };

  const removeSession = (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      // Cleanup session resources
      if (session.context && session.context.cleanup) {
        session.context.cleanup();
      }
      if (session.analytics && session.analytics.cleanup) {
        session.analytics.cleanup();
      }
      sessions.delete(sessionId);
      return true;
    }
    return false;
  };

  const cleanupExpiredSessions = () => {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of sessions) {
      if (now - session.lastActivity > config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      removeSession(sessionId);
    });

    return expiredSessions.length;
  };

  const startCleanupTimer = () => {
    if (cleanupTimer) return;
    
    cleanupTimer = setInterval(() => {
      const cleaned = cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
      }
    }, config.cleanupInterval);
  };

  const stopCleanupTimer = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  };

  const getSessionStats = () => {
    const now = Date.now();
    const stats = {
      totalSessions: sessions.size,
      activeSessions: 0,
      expiredSessions: 0
    };

    for (const session of sessions.values()) {
      if (now - session.lastActivity <= config.sessionTimeout) {
        stats.activeSessions++;
      } else {
        stats.expiredSessions++;
      }
    }

    return stats;
  };

  const getAllSessions = () => {
    return Array.from(sessions.values());
  };

  return {
    createSession,
    getSession,
    updateActivity,
    removeSession,
    cleanupExpiredSessions,
    startCleanupTimer,
    stopCleanupTimer,
    getSessionStats,
    getAllSessions
  };
};