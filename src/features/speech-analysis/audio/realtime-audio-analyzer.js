/**
 * Real-time Audio Analysis Pipeline
 * Advanced audio processing and feature extraction for speech analysis
 * Following functional programming patterns with factory functions
 */

// Create real-time audio analyzer factory
export const createRealtimeAudioAnalyzer = (config = {}) => {
  const state = {
    audioContext: null,
    analyser: null,
    microphone: null,
    scriptProcessor: null,
    
    // Audio processing nodes
    nodes: {
      gain: null,
      compressor: null,
      highpass: null,
      lowpass: null,
      notch: null
    },
    
    // Analysis buffers
    buffers: {
      time: null,
      frequency: null,
      fftSize: config.fftSize || 2048,
      smoothing: config.smoothingTimeConstant || 0.8
    },
    
    // Feature extraction
    features: {
      pitch: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      mfcc: [],
      formants: []
    },
    
    // Configuration
    config: {
      sampleRate: config.sampleRate || 48000,
      fftSize: config.fftSize || 2048,
      smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
      minPitch: config.minPitch || 50, // Hz
      maxPitch: config.maxPitch || 400, // Hz
      frameSize: config.frameSize || 512,
      hopSize: config.hopSize || 256,
      enablePreprocessing: config.enablePreprocessing !== false,
      enableNoiseSuppression: config.enableNoiseSuppression !== false,
      ...config
    },
    
    // State tracking
    isInitialized: false,
    isAnalyzing: false,
    
    // Callbacks
    callbacks: {
      onFeatures: [],
      onPitch: [],
      onEnergy: [],
      onSpectrum: [],
      onError: []
    },
    
    // Performance metrics
    metrics: {
      framesProcessed: 0,
      lastProcessTime: 0,
      averageLatency: 0
    }
  };

  // Initialize audio context and analyzer
  const initialize = async () => {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.audioContext = new AudioContext({
        sampleRate: state.config.sampleRate,
        latencyHint: 'interactive'
      });
      
      // Create analyser node
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = state.config.fftSize;
      state.analyser.smoothingTimeConstant = state.config.smoothingTimeConstant;
      
      // Initialize buffers
      state.buffers.time = new Float32Array(state.analyser.fftSize);
      state.buffers.frequency = new Float32Array(state.analyser.frequencyBinCount);
      
      // Create preprocessing chain if enabled
      if (state.config.enablePreprocessing) {
        createPreprocessingChain();
      }
      
      state.isInitialized = true;
      console.log('✅ Real-time audio analyzer initialized');
      console.log(`📊 Sample rate: ${state.audioContext.sampleRate}Hz`);
      console.log(`📊 FFT size: ${state.analyser.fftSize}`);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
      notifyError(error);
      throw error;
    }
  };

  // Create audio preprocessing chain
  const createPreprocessingChain = () => {
    // Gain control
    state.nodes.gain = state.audioContext.createGain();
    state.nodes.gain.gain.value = 1.0;
    
    // Dynamic range compression
    state.nodes.compressor = state.audioContext.createDynamicsCompressor();
    state.nodes.compressor.threshold.value = -24;
    state.nodes.compressor.knee.value = 30;
    state.nodes.compressor.ratio.value = 12;
    state.nodes.compressor.attack.value = 0.003;
    state.nodes.compressor.release.value = 0.25;
    
    // High-pass filter (remove DC offset and rumble)
    state.nodes.highpass = state.audioContext.createBiquadFilter();
    state.nodes.highpass.type = 'highpass';
    state.nodes.highpass.frequency.value = 80; // Hz
    state.nodes.highpass.Q.value = 0.7;
    
    // Low-pass filter (anti-aliasing)
    state.nodes.lowpass = state.audioContext.createBiquadFilter();
    state.nodes.lowpass.type = 'lowpass';
    state.nodes.lowpass.frequency.value = 8000; // Hz
    state.nodes.lowpass.Q.value = 0.7;
    
    // Notch filter for 50/60Hz hum removal
    state.nodes.notch = state.audioContext.createBiquadFilter();
    state.nodes.notch.type = 'notch';
    state.nodes.notch.frequency.value = 60; // Hz (adjust for your region)
    state.nodes.notch.Q.value = 30;
  };

  // Start audio analysis
  const startAnalysis = async (stream) => {
    if (!state.isInitialized) {
      await initialize();
    }
    
    if (state.isAnalyzing) {
      console.warn('Already analyzing audio');
      return;
    }
    
    try {
      // Create microphone source
      state.microphone = state.audioContext.createMediaStreamSource(stream);
      
      // Create script processor for real-time processing
      state.scriptProcessor = state.audioContext.createScriptProcessor(
        state.config.frameSize,
        1, // mono input
        1  // mono output
      );
      
      // Setup audio processing callback
      state.scriptProcessor.onaudioprocess = processAudioFrame;
      
      // Connect audio graph
      if (state.config.enablePreprocessing) {
        connectPreprocessingChain();
      } else {
        state.microphone.connect(state.analyser);
        state.microphone.connect(state.scriptProcessor);
      }
      
      state.scriptProcessor.connect(state.audioContext.destination);
      
      state.isAnalyzing = true;
      console.log('🎤 Started real-time audio analysis');
      
    } catch (error) {
      console.error('Failed to start audio analysis:', error);
      notifyError(error);
      throw error;
    }
  };

  // Connect preprocessing chain
  const connectPreprocessingChain = () => {
    state.microphone
      .connect(state.nodes.gain)
      .connect(state.nodes.highpass)
      .connect(state.nodes.lowpass)
      .connect(state.nodes.notch)
      .connect(state.nodes.compressor)
      .connect(state.analyser);
    
    state.nodes.compressor.connect(state.scriptProcessor);
  };

  // Process audio frame
  const processAudioFrame = (event) => {
    const startTime = performance.now();
    
    // Get time domain data
    state.analyser.getFloatTimeDomainData(state.buffers.time);
    
    // Get frequency domain data
    state.analyser.getFloatFrequencyData(state.buffers.frequency);
    
    // Extract features
    const features = extractFeatures(
      state.buffers.time,
      state.buffers.frequency,
      state.audioContext.sampleRate
    );
    
    // Update state
    Object.assign(state.features, features);
    
    // Notify callbacks
    notifyCallbacks('onFeatures', features);
    
    if (features.pitch > 0) {
      notifyCallbacks('onPitch', features.pitch);
    }
    
    notifyCallbacks('onEnergy', features.energy);
    notifyCallbacks('onSpectrum', state.buffers.frequency);
    
    // Update metrics
    state.metrics.framesProcessed++;
    const processingTime = performance.now() - startTime;
    state.metrics.lastProcessTime = processingTime;
    state.metrics.averageLatency = 
      (state.metrics.averageLatency * 0.9) + (processingTime * 0.1);
  };

  // Extract audio features
  const extractFeatures = (timeData, freqData, sampleRate) => {
    const features = {
      pitch: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      spectralSpread: 0,
      spectralFlux: 0,
      harmonicRatio: 0
    };
    
    // Energy (RMS)
    features.energy = calculateRMS(timeData);
    
    // Zero Crossing Rate
    features.zeroCrossingRate = calculateZCR(timeData);
    
    // Pitch detection using autocorrelation
    features.pitch = detectPitch(timeData, sampleRate);
    
    // Spectral features
    const spectralFeatures = calculateSpectralFeatures(freqData, sampleRate);
    Object.assign(features, spectralFeatures);
    
    // MFCC calculation (simplified)
    features.mfcc = calculateMFCC(freqData, sampleRate);
    
    // Formant detection
    features.formants = detectFormants(freqData, sampleRate);
    
    return features;
  };

  // Calculate RMS energy
  const calculateRMS = (buffer) => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  // Calculate Zero Crossing Rate
  const calculateZCR = (buffer) => {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  };

  // Detect pitch using autocorrelation
  const detectPitch = (buffer, sampleRate) => {
    const minPeriod = Math.floor(sampleRate / state.config.maxPitch);
    const maxPeriod = Math.floor(sampleRate / state.config.minPitch);
    
    // Skip if signal is too quiet
    const rms = calculateRMS(buffer);
    if (rms < 0.01) return 0;
    
    // Autocorrelation
    const autocorr = new Float32Array(maxPeriod);
    for (let lag = minPeriod; lag < maxPeriod; lag++) {
      let sum = 0;
      for (let i = 0; i < buffer.length - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      autocorr[lag] = sum;
    }
    
    // Find peak
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = minPeriod; i < maxPeriod; i++) {
      if (autocorr[i] > maxValue) {
        maxValue = autocorr[i];
        maxIndex = i;
      }
    }
    
    // Convert to frequency
    if (maxIndex > 0 && maxValue > 0.3) {
      return sampleRate / maxIndex;
    }
    
    return 0;
  };

  // Calculate spectral features
  const calculateSpectralFeatures = (freqData, sampleRate) => {
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / freqData.length;
    
    let totalPower = 0;
    let weightedSum = 0;
    let spectralSpread = 0;
    
    // Convert from dB to linear scale and calculate moments
    for (let i = 0; i < freqData.length; i++) {
      const magnitude = Math.pow(10, freqData[i] / 20);
      const frequency = i * binWidth;
      
      totalPower += magnitude;
      weightedSum += magnitude * frequency;
    }
    
    // Spectral centroid
    const spectralCentroid = totalPower > 0 ? weightedSum / totalPower : 0;
    
    // Spectral spread (standard deviation)
    for (let i = 0; i < freqData.length; i++) {
      const magnitude = Math.pow(10, freqData[i] / 20);
      const frequency = i * binWidth;
      const diff = frequency - spectralCentroid;
      spectralSpread += magnitude * diff * diff;
    }
    spectralSpread = totalPower > 0 ? Math.sqrt(spectralSpread / totalPower) : 0;
    
    // Spectral rolloff (95% of energy)
    let cumulativePower = 0;
    let spectralRolloff = 0;
    const rolloffThreshold = totalPower * 0.95;
    
    for (let i = 0; i < freqData.length; i++) {
      const magnitude = Math.pow(10, freqData[i] / 20);
      cumulativePower += magnitude;
      
      if (cumulativePower >= rolloffThreshold) {
        spectralRolloff = i * binWidth;
        break;
      }
    }
    
    // Spectral flux (change between frames)
    let spectralFlux = 0;
    if (state.previousSpectrum) {
      for (let i = 0; i < freqData.length; i++) {
        const diff = freqData[i] - state.previousSpectrum[i];
        if (diff > 0) {
          spectralFlux += diff * diff;
        }
      }
      spectralFlux = Math.sqrt(spectralFlux);
    }
    state.previousSpectrum = new Float32Array(freqData);
    
    return {
      spectralCentroid,
      spectralSpread,
      spectralRolloff,
      spectralFlux
    };
  };

  // Calculate simplified MFCC
  const calculateMFCC = (freqData, sampleRate) => {
    const numCoefficients = 13;
    const mfcc = new Float32Array(numCoefficients);
    
    // Simplified MFCC calculation
    // In production, use proper mel filterbank and DCT
    const melFilters = createMelFilterBank(
      freqData.length,
      sampleRate,
      numCoefficients
    );
    
    // Apply mel filters
    for (let i = 0; i < numCoefficients; i++) {
      let sum = 0;
      for (let j = 0; j < freqData.length; j++) {
        const magnitude = Math.pow(10, freqData[j] / 20);
        sum += magnitude * melFilters[i][j];
      }
      mfcc[i] = Math.log(sum + 1e-10);
    }
    
    // Apply DCT (simplified)
    const dct = new Float32Array(numCoefficients);
    for (let i = 0; i < numCoefficients; i++) {
      let sum = 0;
      for (let j = 0; j < numCoefficients; j++) {
        sum += mfcc[j] * Math.cos(Math.PI * i * (j + 0.5) / numCoefficients);
      }
      dct[i] = sum;
    }
    
    return Array.from(dct);
  };

  // Create mel filterbank
  const createMelFilterBank = (numBins, sampleRate, numFilters) => {
    const filterBank = [];
    const nyquist = sampleRate / 2;
    
    // Convert frequency to mel scale
    const freqToMel = (freq) => 2595 * Math.log10(1 + freq / 700);
    const melToFreq = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);
    
    const melMin = freqToMel(0);
    const melMax = freqToMel(nyquist);
    const melStep = (melMax - melMin) / (numFilters + 1);
    
    for (let i = 0; i < numFilters; i++) {
      const filter = new Float32Array(numBins);
      
      const melCenter = melMin + (i + 1) * melStep;
      const melLow = melCenter - melStep;
      const melHigh = melCenter + melStep;
      
      const freqCenter = melToFreq(melCenter);
      const freqLow = melToFreq(melLow);
      const freqHigh = melToFreq(melHigh);
      
      for (let j = 0; j < numBins; j++) {
        const freq = (j * nyquist) / numBins;
        
        if (freq >= freqLow && freq <= freqCenter) {
          filter[j] = (freq - freqLow) / (freqCenter - freqLow);
        } else if (freq >= freqCenter && freq <= freqHigh) {
          filter[j] = (freqHigh - freq) / (freqHigh - freqCenter);
        }
      }
      
      filterBank.push(filter);
    }
    
    return filterBank;
  };

  // Detect formants (simplified)
  const detectFormants = (freqData, sampleRate) => {
    const formants = [];
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / freqData.length;
    
    // Find peaks in spectrum (simplified formant detection)
    for (let i = 1; i < freqData.length - 1; i++) {
      if (freqData[i] > freqData[i - 1] && 
          freqData[i] > freqData[i + 1] &&
          freqData[i] > -30) { // Threshold in dB
        
        const frequency = i * binWidth;
        
        // Typical formant ranges for adult speech
        if ((frequency > 200 && frequency < 1000) ||  // F1
            (frequency > 800 && frequency < 2500) ||   // F2
            (frequency > 2000 && frequency < 3500) ||  // F3
            (frequency > 3000 && frequency < 4500)) {  // F4
          
          formants.push({
            frequency,
            amplitude: freqData[i]
          });
        }
      }
    }
    
    // Sort by amplitude and take top 4
    formants.sort((a, b) => b.amplitude - a.amplitude);
    return formants.slice(0, 4).map(f => f.frequency);
  };

  // Stop audio analysis
  const stopAnalysis = () => {
    if (!state.isAnalyzing) return;
    
    // Disconnect nodes
    if (state.microphone) {
      state.microphone.disconnect();
      state.microphone = null;
    }
    
    if (state.scriptProcessor) {
      state.scriptProcessor.disconnect();
      state.scriptProcessor = null;
    }
    
    // Disconnect preprocessing chain
    Object.values(state.nodes).forEach(node => {
      if (node) node.disconnect();
    });
    
    state.isAnalyzing = false;
    console.log('🛑 Stopped audio analysis');
  };

  // Get current features
  const getFeatures = () => ({ ...state.features });

  // Get frequency spectrum
  const getSpectrum = () => {
    if (!state.isAnalyzing) return null;
    
    const spectrum = new Float32Array(state.analyser.frequencyBinCount);
    state.analyser.getFloatFrequencyData(spectrum);
    return spectrum;
  };

  // Get time domain waveform
  const getWaveform = () => {
    if (!state.isAnalyzing) return null;
    
    const waveform = new Float32Array(state.analyser.fftSize);
    state.analyser.getFloatTimeDomainData(waveform);
    return waveform;
  };

  // Get performance metrics
  const getMetrics = () => ({ ...state.metrics });

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (state.analyser) {
      state.analyser.fftSize = state.config.fftSize;
      state.analyser.smoothingTimeConstant = state.config.smoothingTimeConstant;
      
      // Reinitialize buffers
      state.buffers.time = new Float32Array(state.analyser.fftSize);
      state.buffers.frequency = new Float32Array(state.analyser.frequencyBinCount);
    }
  };

  // Event subscription
  const onFeatures = (callback) => subscribeCallback('onFeatures', callback);
  const onPitch = (callback) => subscribeCallback('onPitch', callback);
  const onEnergy = (callback) => subscribeCallback('onEnergy', callback);
  const onSpectrum = (callback) => subscribeCallback('onSpectrum', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  // Helper functions
  const subscribeCallback = (event, callback) => {
    state.callbacks[event].push(callback);
    return () => {
      const index = state.callbacks[event].indexOf(callback);
      if (index !== -1) state.callbacks[event].splice(index, 1);
    };
  };

  const notifyCallbacks = (event, data) => {
    state.callbacks[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${event}:`, error);
      }
    });
  };

  const notifyError = (error) => {
    notifyCallbacks('onError', error);
  };

  // Cleanup
  const cleanup = () => {
    stopAnalysis();
    
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }
    
    state.isInitialized = false;
    console.log('🧹 Audio analyzer cleaned up');
  };

  return {
    // Core functionality
    initialize,
    startAnalysis,
    stopAnalysis,
    cleanup,
    
    // Data access
    getFeatures,
    getSpectrum,
    getWaveform,
    getMetrics,
    
    // Configuration
    updateConfig,
    getConfig: () => ({ ...state.config }),
    
    // Status
    isInitialized: () => state.isInitialized,
    isAnalyzing: () => state.isAnalyzing,
    
    // Event handlers
    onFeatures,
    onPitch,
    onEnergy,
    onSpectrum,
    onError
  };
};