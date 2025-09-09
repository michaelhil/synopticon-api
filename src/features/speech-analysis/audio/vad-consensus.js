/**
 * VAD consensus algorithm for combining multiple detection methods
 */

export const createVADConsensus = (config) => {
  const state = {
    config,
    decisionBuffer: [],
    hangoverCount: 0
  };

  // Calculate weighted consensus from multiple algorithm results
  const calculateWeightedScore = (energyResult, zcrResult, entropyResult) => {
    return (energyResult.confidence * state.config.energyWeight) +
           (zcrResult.confidence * state.config.zcrWeight) +
           (entropyResult.confidence * state.config.entropyWeight);
  };

  // Apply decision smoothing using a rolling buffer
  const applySmoothingAndHangover = (currentDecision) => {
    // Add current decision to buffer
    state.decisionBuffer.push(currentDecision);
    if (state.decisionBuffer.length > state.config.smoothingWindow) {
      state.decisionBuffer.shift();
    }

    // Calculate smoothed decision based on majority vote
    const speechCount = state.decisionBuffer.filter(d => d).length;
    const smoothedDecision = speechCount > state.decisionBuffer.length / 2;

    // Apply hangover effect (extend speech detection)
    let finalDecision;
    if (smoothedDecision) {
      state.hangoverCount = state.config.hangoverFrames;
      finalDecision = true;
    } else if (state.hangoverCount > 0) {
      state.hangoverCount--;
      finalDecision = true;
    } else {
      finalDecision = false;
    }

    return {
      raw: currentDecision,
      smoothed: smoothedDecision,
      final: finalDecision,
      hangoverActive: state.hangoverCount > 0
    };
  };

  // Process consensus decision from all algorithms
  const processConsensus = (energyResult, zcrResult, entropyResult, timestamp) => {
    const weightedScore = calculateWeightedScore(energyResult, zcrResult, entropyResult);
    const rawDecision = weightedScore > state.config.consensusThreshold;
    
    const decision = applySmoothingAndHangover(rawDecision);
    
    // Calculate algorithm agreement metrics
    const decisions = [energyResult.isVoiceActive, zcrResult.isVoiceActive, entropyResult.isVoiceActive];
    const activeCount = decisions.filter(d => d).length;
    const agreement = activeCount / 3;

    return {
      isVoiceActive: decision.final,
      confidence: weightedScore,
      timestamp,
      decision,
      algorithms: {
        energy: energyResult,
        zcr: zcrResult,
        entropy: entropyResult
      },
      consensus: {
        score: weightedScore,
        threshold: state.config.consensusThreshold,
        agreement,
        activeCount
      }
    };
  };

  // Reset consensus state
  const reset = () => {
    state.decisionBuffer.length = 0;
    state.hangoverCount = 0;
  };

  // Get current state
  const getState = () => ({
    decisionBuffer: [...state.decisionBuffer],
    hangoverCount: state.hangoverCount,
    bufferFill: state.decisionBuffer.length / state.config.smoothingWindow
  });

  return {
    processConsensus,
    reset,
    getState,
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
    }
  };
};
