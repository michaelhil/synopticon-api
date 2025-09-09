/**
 * Speech Recognition Backend Manager
 * Handles backend selection, initialization, and lifecycle management
 */

export const createBackendManager = (backends, speechBackends) => {
  // Initialize the best available speech recognition backend
  const initializeBestBackend = async (state) => {
    const backendPriority = ['web_speech_api', 'speech_recognition_fallback'];

    for (const backendName of backendPriority) {
      try {
        const backend = backends[backendName];
        const isAvailable = await backend.checkAvailability(state);

        if (isAvailable) {
          state.activeBackend = backendName;
          await backend.initialize(state);
          state.isInitialized = true;
          
          console.log(`✅ Initialized backend: ${backendName}`);
          return true;
        }
      } catch (error) {
        console.warn(`Failed to initialize ${backendName}:`, error.message);
        continue;
      }
    }

    throw new Error('No speech recognition backends available');
  };

  // Start the active backend
  const startBackend = async (state) => {
    if (!state.isInitialized || !state.activeBackend) {
      throw new Error('Speech recognition not initialized');
    }

    if (state.isListening) {
      console.warn('Speech recognition already listening');
      return;
    }

    console.log('🎤 Starting speech recognition...');
    
    const backend = backends[state.activeBackend];
    await backend.start(state);
    
    state.isListening = true;
    state.metrics.totalSessions++;
    state.currentTranscript = '';
    state.finalTranscript = '';

    return state.activeBackend;
  };

  // Stop the active backend
  const stopBackend = async (state) => {
    if (!state.isListening || !state.activeBackend) {
      return;
    }

    console.log('🔇 Stopping speech recognition...');
    
    const backend = backends[state.activeBackend];
    await backend.stop(state);
    
    state.isListening = false;
    return state.activeBackend;
  };

  // Abort the active backend immediately
  const abortBackend = async (state) => {
    if (!state.isListening || !state.activeBackend) {
      return;
    }

    const backend = backends[state.activeBackend];
    if (backend.abort) {
      await backend.abort(state);
    } else {
      await backend.stop(state);
    }
    
    state.isListening = false;
    return state.activeBackend;
  };

  // Cleanup the active backend
  const cleanupBackend = async (state) => {
    if (state.activeBackend && backends[state.activeBackend]) {
      const backend = backends[state.activeBackend];
      if (backend.cleanup) {
        await backend.cleanup(state);
      }
    }

    state.recognition = null;
    state.isInitialized = false;
    state.activeBackend = null;
  };

  // Get backend information
  const getBackendInfo = (backendName) => {
    return speechBackends[backendName] || null;
  };

  // Get all supported backends
  const getSupportedBackends = () => {
    return Object.keys(speechBackends);
  };

  // Check if a specific backend is available
  const checkBackendAvailability = async (backendName, state) => {
    if (!backends[backendName]) {
      return false;
    }

    try {
      return await backends[backendName].checkAvailability(state);
    } catch (error) {
      console.warn(`Backend ${backendName} availability check failed:`, error);
      return false;
    }
  };

  return {
    initializeBestBackend,
    startBackend,
    stopBackend,
    abortBackend,
    cleanupBackend,
    getBackendInfo,
    getSupportedBackends,
    checkBackendAvailability
  };
};
