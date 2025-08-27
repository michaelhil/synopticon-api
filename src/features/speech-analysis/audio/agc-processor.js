/**
 * AGC Processing Core
 * Core automatic gain control processing logic
 */

export const createAGCProcessor = (state) => {
  // Convert linear to dB
  const linearToDb = (linear) => 20 * Math.log10(Math.max(linear, 1e-10));

  // Convert dB to linear
  const dbToLinear = (db) => Math.pow(10, db / 20);

  // Initialize AGC
  const initialize = () => {
    // Calculate time constants
    state.attackCoeff = Math.exp(-1 / (state.config.attackTime * state.config.sampleRate));
    state.releaseCoeff = Math.exp(-1 / (state.config.releaseTime * state.config.sampleRate));
    
    // Initialize look-ahead buffer
    const lookAheadSamples = Math.floor(state.config.lookAheadTime * state.config.sampleRate);
    state.lookAheadBuffer = new Float32Array(lookAheadSamples);
  };

  // Process single sample with envelope following
  const processSample = (inputSample, lookAheadSize) => {
    // Store current sample in look-ahead buffer
    state.lookAheadBuffer[state.lookAheadIndex] = inputSample;
    
    // Get delayed sample for processing
    const delayedIndex = (state.lookAheadIndex + 1) % lookAheadSize;
    const delayedSample = state.lookAheadBuffer[delayedIndex];
    
    // Calculate envelope of current sample
    const inputLevel = Math.abs(inputSample);
    
    // Envelope follower
    if (inputLevel > state.envelope) {
      state.envelope = state.attackCoeff * state.envelope + (1 - state.attackCoeff) * inputLevel;
    } else {
      state.envelope = state.releaseCoeff * state.envelope + (1 - state.releaseCoeff) * inputLevel;
    }
    
    // Calculate required gain
    const inputLevelDb = linearToDb(state.envelope);
    const gainNeededDb = state.config.targetLevel - inputLevelDb;
    
    // Limit gain
    const limitedGainDb = Math.max(state.config.minGain, 
                                 Math.min(state.config.maxGain, gainNeededDb));
    
    // Smooth gain changes
    const targetGain = dbToLinear(limitedGainDb);
    const gainDiff = targetGain - state.currentGain;
    state.currentGain += gainDiff * 0.01; // Smooth gain adjustment
    
    // Apply gain to delayed sample
    const outputSample = delayedSample * state.currentGain;
    
    // Update buffer index
    state.lookAheadIndex = (state.lookAheadIndex + 1) % lookAheadSize;
    
    return outputSample;
  };

  // Update statistics
  const updateStats = (audioBuffer) => {
    state.stats.totalFrames++;
    const avgInputLevel = audioBuffer.reduce((sum, s) => sum + Math.abs(s), 0) / audioBuffer.length;
    const inputLevelDb = linearToDb(avgInputLevel);
    
    state.stats.peakLevel = Math.max(state.stats.peakLevel, inputLevelDb);
    state.stats.averageLevel = (state.stats.averageLevel * (state.stats.totalFrames - 1) + inputLevelDb) / state.stats.totalFrames;
    state.stats.averageGain = (state.stats.averageGain * (state.stats.totalFrames - 1) + linearToDb(state.currentGain)) / state.stats.totalFrames;
    
    if (Math.abs(linearToDb(state.currentGain)) > 1) {
      state.stats.gainAdjustments++;
    }
  };

  return {
    initialize,
    processSample,
    updateStats
  };
};