/**
 * Audio Processing Chain Module
 * Handles audio preprocessing filters and graph connections
 */

export const createAudioProcessingChain = (audioContext, config) => {
  const nodes = {
    gain: null,
    compressor: null,
    highpass: null,
    lowpass: null,
    notch: null
  };

  // Create audio preprocessing chain
  const createPreprocessingChain = () => {
    // Gain control
    nodes.gain = audioContext.createGain();
    nodes.gain.gain.value = 1.0;
    
    // Dynamic range compression
    nodes.compressor = audioContext.createDynamicsCompressor();
    nodes.compressor.threshold.value = -24;
    nodes.compressor.knee.value = 30;
    nodes.compressor.ratio.value = 12;
    nodes.compressor.attack.value = 0.003;
    nodes.compressor.release.value = 0.25;
    
    // High-pass filter (remove DC offset and rumble)
    nodes.highpass = audioContext.createBiquadFilter();
    nodes.highpass.type = 'highpass';
    nodes.highpass.frequency.value = 80; // Hz
    nodes.highpass.Q.value = 0.7;
    
    // Low-pass filter (anti-aliasing)
    nodes.lowpass = audioContext.createBiquadFilter();
    nodes.lowpass.type = 'lowpass';
    nodes.lowpass.frequency.value = 8000; // Hz
    nodes.lowpass.Q.value = 0.7;
    
    // Notch filter for 50/60Hz hum removal
    nodes.notch = audioContext.createBiquadFilter();
    nodes.notch.type = 'notch';
    nodes.notch.frequency.value = 60; // Hz (adjust for your region)
    nodes.notch.Q.value = 30;

    return nodes;
  };

  // Connect preprocessing chain
  const connectPreprocessingChain = (microphone, analyser, scriptProcessor) => {
    microphone
      .connect(nodes.gain)
      .connect(nodes.highpass)
      .connect(nodes.lowpass)
      .connect(nodes.notch)
      .connect(nodes.compressor)
      .connect(analyser);
    
    nodes.compressor.connect(scriptProcessor);
  };

  // Connect simple chain without preprocessing
  const connectSimpleChain = (microphone, analyser, scriptProcessor) => {
    microphone.connect(analyser);
    microphone.connect(scriptProcessor);
  };

  // Update preprocessing parameters
  const updateParameters = (params) => {
    if (params.gain && nodes.gain) {
      nodes.gain.gain.value = params.gain;
    }
    if (params.threshold && nodes.compressor) {
      nodes.compressor.threshold.value = params.threshold;
    }
    if (params.highpassFreq && nodes.highpass) {
      nodes.highpass.frequency.value = params.highpassFreq;
    }
    if (params.lowpassFreq && nodes.lowpass) {
      nodes.lowpass.frequency.value = params.lowpassFreq;
    }
    if (params.notchFreq && nodes.notch) {
      nodes.notch.frequency.value = params.notchFreq;
    }
  };

  // Cleanup processing nodes
  const cleanup = () => {
    Object.values(nodes).forEach(node => {
      if (node) {
        try {
          node.disconnect();
        } catch (e) {
          // Node may already be disconnected
        }
      }
    });
  };

  return {
    createPreprocessingChain,
    connectPreprocessingChain,
    connectSimpleChain,
    updateParameters,
    cleanup,
    getNodes: () => nodes
  };
};