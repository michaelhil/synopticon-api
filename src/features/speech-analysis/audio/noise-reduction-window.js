/**
 * Windowing Functions for Noise Reduction
 * Handles window initialization and application
 */

export const createWindowProcessor = (state) => {
  // Initialize Hann window
  const initializeWindow = () => {
    state.window = new Float32Array(state.config.frameSize);
    for (let i = 0; i < state.config.frameSize; i++) {
      state.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (state.config.frameSize - 1)));
    }
    
    state.overlapBuffer = new Float32Array(state.config.frameSize - state.config.hopSize);
  };

  // Apply window function
  const applyWindow = (audioBuffer) => {
    const windowed = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      windowed[i] = audioBuffer[i] * state.window[i];
    }
    return windowed;
  };

  // Process overlap-add reconstruction
  const processOverlapAdd = (enhanced) => {
    // Apply window again for overlap-add
    for (let i = 0; i < enhanced.length; i++) {
      enhanced[i] *= state.window[i];
    }
    
    // Overlap-add processing
    const output = new Float32Array(state.config.hopSize);
    
    // Add overlap from previous frame
    for (let i = 0; i < state.overlapBuffer.length && i < state.config.hopSize; i++) {
      output[i] = enhanced[i] + state.overlapBuffer[i];
    }
    
    // Copy remaining samples
    for (let i = state.overlapBuffer.length; i < state.config.hopSize && i < enhanced.length; i++) {
      output[i] = enhanced[i];
    }
    
    // Save overlap for next frame
    const overlapStart = state.config.hopSize;
    for (let i = 0; i < state.overlapBuffer.length; i++) {
      if (overlapStart + i < enhanced.length) {
        state.overlapBuffer[i] = enhanced[overlapStart + i];
      } else {
        state.overlapBuffer[i] = 0;
      }
    }
    
    return output;
  };

  return {
    initializeWindow,
    applyWindow,
    processOverlapAdd
  };
};