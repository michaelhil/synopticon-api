/**
 * Web Speech API Backend with Web Audio API Integration
 * Comprehensive implementation with real-time audio processing
 */

import {
  createSpeechEvent,
  createSpeechRecognitionResult,
  createSpeechWord
} from '../../../core/configuration/types.ts';

export const createWebSpeechAPIBackend = () => {
  // Audio processing state
  let audioContext = null;
  let analyser = null;
  let microphone = null;
  let processor = null;
  let audioStream = null;

  const checkAvailability = async (state) => {
    console.log('🔍 Checking Web Speech API availability...');
    console.log('Runtime check:', state.runtime);
    
    if (!state.runtime.isBrowser) {
      console.log('⚠️ Not in browser environment');
      return false;
    }

    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('⚠️ Web Speech API not supported in this browser');
      return false;
    }

    // Check for HTTPS (required for Web Speech API)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.log('⚠️ Web Speech API requires HTTPS');
      return false;
    }

    console.log('✅ Web Speech API is available');
    return true;
  };

  const initialize = async (state) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();

    // Configure recognition
    state.recognition.continuous = state.continuous;
    state.recognition.interimResults = state.interimResults;
    state.recognition.lang = state.language;
    state.recognition.maxAlternatives = state.maxAlternatives;

    // Setup comprehensive event handlers
    setupEventHandlers(state);

    console.log('✅ Web Speech API configured');
  };

  const setupEventHandlers = (state) => {
    state.recognition.onstart = () => {
      console.log('🎤 Web Speech API started listening');
    };

    state.recognition.onend = () => {
      console.log('🔇 Web Speech API stopped listening');
    };

    state.recognition.onspeechstart = () => {
      notifyCallbacks(state.callbacks.onSpeechStart, createSpeechEvent({
        type: 'speech_start',
        data: {}
      }));
    };

    state.recognition.onspeechend = () => {
      notifyCallbacks(state.callbacks.onSpeechEnd, createSpeechEvent({
        type: 'speech_end',
        data: {}
      }));
    };

    state.recognition.onresult = (event) => {
      handleRecognitionResult(event, state);
    };

    state.recognition.onerror = (event) => {
      handleRecognitionError(event, state);
    };

    // Additional event handlers for comprehensive coverage
    state.recognition.onaudiostart = () => {
      console.log('🎧 Audio capture started');
    };

    state.recognition.onaudioend = () => {
      console.log('🎧 Audio capture ended');
    };

    state.recognition.onsoundstart = () => {
      console.log('🔊 Sound detected');
    };

    state.recognition.onsoundend = () => {
      console.log('🔇 Sound ended');
    };

    state.recognition.onnomatch = () => {
      console.log('❌ No speech match found');
    };
  };

  const handleRecognitionResult = (event, state) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const {transcript} = result[0];
      const {confidence} = result[0];

      if (result.isFinal) {
        finalTranscript += transcript;
        
        // Create final result with comprehensive word analysis
        const words = transcript.trim().split(' ').map((word, index) => 
          createSpeechWord({
            word: word.trim(),
            confidence,
            startTime: 0, // Web Speech API doesn't provide word timing
            endTime: 0
          })
        ).filter(word => word.word.length > 0);

        state.finalTranscript += finalTranscript;
        state.metrics.totalWords += words.length;
        
        // Update average confidence with proper weighting
        if (confidence > 0) {
          const currentWords = state.metrics.totalWords;
          const previousWords = currentWords - words.length;
          const previousAvg = state.metrics.averageConfidence;
          
          state.metrics.averageConfidence = 
            (previousAvg * previousWords + confidence * words.length) / currentWords;
        }

        const speechResult = createSpeechRecognitionResult({
          transcript: finalTranscript.trim(),
          confidence,
          isFinal: true,
          isInterim: false,
          words,
          language: state.language,
          processingTime: 0,
          alternatives: extractAlternatives(result)
        });

        // Notify final result callbacks
        notifyCallbacks(state.callbacks.onResult, speechResult);

      } else {
        interimTranscript += transcript;
      }
    }

    if (interimTranscript) {
      state.currentTranscript = interimTranscript;
      
      const interimResult = createSpeechRecognitionResult({
        transcript: interimTranscript.trim(),
        confidence: 0.5, // Lower confidence for interim results
        isFinal: false,
        isInterim: true,
        words: [],
        language: state.language,
        processingTime: 0
      });

      // Notify interim result callbacks
      notifyCallbacks(state.callbacks.onInterimResult, interimResult);
    }
  };

  const handleRecognitionError = (event, state) => {
    console.error('Speech recognition error:', event.error);
    state.metrics.errors++;
    
    const errorEvent = createSpeechEvent({
      type: 'speech_recognition_error',
      data: { 
        error: event.error, 
        message: event.message || 'Speech recognition error',
        details: getErrorDetails(event.error)
      },
      severity: 'error'
    });

    notifyCallbacks(state.callbacks.onError, errorEvent);
  };

  const extractAlternatives = (result) => {
    const alternatives = [];
    for (let j = 0; j < Math.min(result.length, 3); j++) {
      alternatives.push({
        transcript: result[j].transcript,
        confidence: result[j].confidence || 0
      });
    }
    return alternatives;
  };

  const getErrorDetails = (error) => {
    const errorMap = {
      'no-speech': 'No speech detected within timeout period',
      'aborted': 'Speech recognition was aborted',
      'audio-capture': 'Audio capture failed - check microphone permissions',
      'network': 'Network error occurred during recognition',
      'not-allowed': 'Microphone access denied by user',
      'service-not-allowed': 'Speech recognition service not allowed',
      'bad-grammar': 'Grammar compilation failed',
      'language-not-supported': 'Language not supported by recognition service'
    };
    return errorMap[error] || `Unknown error: ${error}`;
  };

  const start = async (state) => {
    if (!state.recognition) {
      throw new Error('Web Speech API not initialized');
    }
    
    // Initialize Web Audio API when starting (requires user gesture)
    if (!audioStream) {
      await initializeWebAudioAPI(state);
    }
    
    state.recognition.start();
  };

  const stop = async (state) => {
    if (state.recognition) {
      state.recognition.stop();
    }
  };

  const abort = async (state) => {
    if (state.recognition) {
      state.recognition.abort();
    }
  };

  // Initialize Web Audio API for real-time audio processing
  const initializeWebAudioAPI = async (state) => {
    try {
      console.log('🎧 Initializing Web Audio API integration...');
      
      // Request microphone access with comprehensive audio constraints
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
          latency: 0.01,
          volume: 1.0
        }
      });

      // Create audio context with optimal settings
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });

      // Create analyser for comprehensive real-time audio analysis
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      // Connect microphone to analyser
      microphone = audioContext.createMediaStreamSource(audioStream);
      microphone.connect(analyser);

      // Create script processor for real-time analysis
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        processAudioFrame(event, state);
      };

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      console.log('✅ Web Audio API integration initialized');
      
    } catch (error) {
      console.warn('⚠️ Web Audio API initialization failed:', error);
      // Continue without Web Audio API enhancement
    }
  };

  const processAudioFrame = (event, state) => {
    // Get comprehensive frequency and time domain data
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    // Calculate comprehensive real-time audio metrics
    const audioMetrics = calculateComprehensiveAudioMetrics(frequencyData, timeData);
    
    // Notify audio processing callbacks if available
    if (state.callbacks.onAudioProcessing) {
      notifyCallbacks(state.callbacks.onAudioProcessing, {
        type: 'audio_processing',
        data: audioMetrics,
        timestamp: Date.now()
      });
    }
  };

  // Calculate comprehensive real-time audio metrics
  const calculateComprehensiveAudioMetrics = (frequencyData, timeData) => {
    // Volume level (RMS)
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const volumeLevel = Math.sqrt(sum / timeData.length);

    // Comprehensive frequency analysis
    const signalLevel = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    
    // Background noise estimation (low frequencies)
    const lowFreqBins = frequencyData.slice(0, Math.floor(frequencyData.length * 0.3));
    const backgroundNoise = lowFreqBins.reduce((sum, value) => sum + value, 0) / lowFreqBins.length;
    
    // Mid-range frequencies (speech content)
    const midFreqStart = Math.floor(frequencyData.length * 0.3);
    const midFreqEnd = Math.floor(frequencyData.length * 0.6);
    const midFreqBins = frequencyData.slice(midFreqStart, midFreqEnd);
    const speechContent = midFreqBins.reduce((sum, value) => sum + value, 0) / midFreqBins.length;
    
    // High frequency content (clarity indicator)
    const highFreqStart = Math.floor(frequencyData.length * 0.6);
    const highFreqBins = frequencyData.slice(highFreqStart);
    const clarity = highFreqBins.reduce((sum, value) => sum + value, 0) / highFreqBins.length;

    // Peak frequency detection
    const peakIndex = frequencyData.indexOf(Math.max(...frequencyData));
    const peakFrequency = (peakIndex * audioContext.sampleRate) / (2 * frequencyData.length);

    // Zero crossing rate for voice activity detection
    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] - 128) * (timeData[i - 1] - 128) < 0) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / timeData.length;

    // Signal-to-noise ratio estimation
    const signalPower = speechContent;
    const noisePower = Math.max(backgroundNoise, 1); // Avoid division by zero
    const snrEstimate = 20 * Math.log10(signalPower / noisePower);

    return {
      volumeLevel: Math.round(volumeLevel * 100) / 100,
      signalLevel: Math.round(signalLevel),
      backgroundNoise: Math.round(backgroundNoise),
      speechContent: Math.round(speechContent),
      clarity: Math.round(clarity),
      peakFrequency: Math.round(peakFrequency),
      zeroCrossingRate: Math.round(zeroCrossingRate * 1000) / 1000,
      snrEstimate: Math.round(snrEstimate * 10) / 10,
      timestamp: Date.now(),
      audioContextState: audioContext ? audioContext.state : 'unavailable'
    };
  };

  const cleanup = async (state) => {
    // Cleanup Web Audio API resources
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
      processor = null;
    }
    
    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }
    
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
    
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      audioContext = null;
    }
    
    if (audioStream) {
      audioStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped audio track: ${track.kind}, ${track.label}`);
      });
      audioStream = null;
    }

    // Cleanup speech recognition with comprehensive event handler cleanup
    if (state.recognition) {
      state.recognition.onstart = null;
      state.recognition.onend = null;
      state.recognition.onresult = null;
      state.recognition.onerror = null;
      state.recognition.onspeechstart = null;
      state.recognition.onspeechend = null;
      state.recognition.onaudiostart = null;
      state.recognition.onaudioend = null;
      state.recognition.onsoundstart = null;
      state.recognition.onsoundend = null;
      state.recognition.onnomatch = null;
      state.recognition = null;
    }

    console.log('🧹 Web Speech API + Web Audio API cleaned up');
  };

  // Utility function to notify callbacks safely
  const notifyCallbacks = (callbacks, data) => {
    if (callbacks && Array.isArray(callbacks)) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn('Callback error:', error);
        }
      });
    }
  };

  return {
    checkAvailability,
    initialize,
    start,
    stop,
    abort,
    cleanup
  };
};
