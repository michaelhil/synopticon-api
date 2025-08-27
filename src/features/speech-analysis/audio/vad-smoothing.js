/**
 * VAD signal smoothing and temporal filtering
 */

export const createVADSmoothing = (config) => {
  const state = {
    config: {
      smoothingWindow: config.smoothingWindow || 5,
      hangoverFrames: config.hangoverFrames || 3,
      hysteresisThreshold: config.hysteresisThreshold || 0.1
    },
    decisionHistory: [],
    confidenceHistory: [],
    hangoverCount: 0,
    lastState: 'silence'
  };

  // Apply temporal smoothing to decisions
  const smoothDecision = (rawDecision, confidence) => {
    // Add to history buffers
    state.decisionHistory.push(rawDecision);
    state.confidenceHistory.push(confidence);
    
    // Maintain buffer size
    if (state.decisionHistory.length > state.config.smoothingWindow) {
      state.decisionHistory.shift();
      state.confidenceHistory.shift();
    }

    // Calculate smoothed decision using majority vote
    const speechCount = state.decisionHistory.filter(d => d).length;
    const majorityDecision = speechCount > state.decisionHistory.length / 2;
    
    // Calculate average confidence
    const avgConfidence = state.confidenceHistory.reduce((sum, c) => sum + c, 0) / 
                         state.confidenceHistory.length;

    return {
      raw: rawDecision,
      majority: majorityDecision,
      confidence: avgConfidence,
      speechRatio: speechCount / state.decisionHistory.length
    };
  };

  // Apply hysteresis to prevent rapid state changes
  const applyHysteresis = (smoothedResult, threshold) => {
    const { majority, confidence } = smoothedResult;
    let decision = majority;

    // Apply hysteresis based on previous state
    if (state.lastState === 'silence' && majority) {
      // Need higher confidence to switch to speech
      decision = confidence > (threshold + state.config.hysteresisThreshold);
    } else if (state.lastState === 'speech' && !majority) {
      // Need lower confidence to switch to silence
      decision = confidence > (threshold - state.config.hysteresisThreshold);
    }

    return {
      ...smoothedResult,
      hysteresis: decision,
      stateChange: decision !== (state.lastState === 'speech')
    };
  };

  // Apply hangover effect to extend speech detection
  const applyHangover = (hysteresisResult) => {
    const { hysteresis } = hysteresisResult;
    let finalDecision = hysteresis;

    if (hysteresis) {
      // Reset hangover when speech is detected
      state.hangoverCount = state.config.hangoverFrames;
      finalDecision = true;
    } else if (state.hangoverCount > 0) {
      // Continue speech detection during hangover
      state.hangoverCount--;
      finalDecision = true;
    } else {
      finalDecision = false;
    }

    // Update last state
    const newState = finalDecision ? 'speech' : 'silence';
    const transitionOccurred = newState !== state.lastState;
    state.lastState = newState;

    return {
      ...hysteresisResult,
      hangover: finalDecision,
      hangoverActive: state.hangoverCount > 0,
      hangoverRemaining: state.hangoverCount,
      finalState: newState,
      transition: transitionOccurred
    };
  };

  // Main processing function
  const processSmoothing = (rawDecision, confidence, threshold) => {
    const smoothed = smoothDecision(rawDecision, confidence);
    const hysteresis = applyHysteresis(smoothed, threshold);
    const hangover = applyHangover(hysteresis);

    return {
      input: { decision: rawDecision, confidence },
      smoothed,
      hysteresis: hysteresis.hysteresis,
      final: hangover.hangover,
      meta: {
        hangoverActive: hangover.hangoverActive,
        hangoverRemaining: hangover.hangoverRemaining,
        stateTransition: hangover.transition,
        currentState: hangover.finalState
      }
    };
  };

  // Reset smoothing state
  const reset = () => {
    state.decisionHistory.length = 0;
    state.confidenceHistory.length = 0;
    state.hangoverCount = 0;
    state.lastState = 'silence';
  };

  // Get current smoothing state
  const getState = () => ({
    decisionHistory: [...state.decisionHistory],
    confidenceHistory: [...state.confidenceHistory],
    hangoverCount: state.hangoverCount,
    lastState: state.lastState,
    bufferFill: state.decisionHistory.length / state.config.smoothingWindow
  });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    // Adjust buffer sizes if window size changed
    if (newConfig.smoothingWindow && newConfig.smoothingWindow !== state.config.smoothingWindow) {
      const targetSize = newConfig.smoothingWindow;
      
      // Trim or maintain existing history
      if (state.decisionHistory.length > targetSize) {
        state.decisionHistory = state.decisionHistory.slice(-targetSize);
        state.confidenceHistory = state.confidenceHistory.slice(-targetSize);
      }
    }
  };

  return {
    processSmoothing,
    reset,
    getState,
    updateConfig,
    
    // Individual smoothing functions for testing
    smoothDecision,
    applyHysteresis,
    applyHangover
  };
};