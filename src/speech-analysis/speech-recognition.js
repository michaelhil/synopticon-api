/**
 * Speech Recognition with Hybrid Fallbacks
 * Provides unified speech recognition interface across environments
 * Following functional programming patterns with factory functions
 */

import { detectRuntime, checkFeatures } from '../utils/runtime-detector.js';
import { 
  createSpeechRecognitionResult,
  createSpeechWord,
  createSpeechEvent
} from '../core/types.js';

// Speech recognition backends
const SPEECH_BACKENDS = {
  web_speech_api: {
    name: 'Web Speech API',
    description: 'Browser native speech recognition',
    requirements: ['browser', 'https'],
    availability: 'chrome_edge'
  },
  speech_recognition_fallback: {
    name: 'Keyboard Input Simulation',
    description: 'Text input fallback for development',
    requirements: ['browser', 'node'],
    availability: 'universal'
  },
  mock_recognition: {
    name: 'Mock Speech Recognition',
    description: 'Simulated speech for testing',
    requirements: ['browser', 'node'],
    availability: 'universal'
  }
};

// Create speech recognition factory
export const createSpeechRecognition = (config = {}) => {
  const state = {
    runtime: detectRuntime(),
    features: checkFeatures(),
    activeBackend: null,
    isListening: false,
    isInitialized: false,
    language: config.language || 'en-US',
    continuous: config.continuous !== false,
    interimResults: config.interimResults !== false,
    maxAlternatives: config.maxAlternatives || 3,
    
    // Recognition state
    recognition: null,
    currentTranscript: '',
    finalTranscript: '',
    
    // Metrics
    metrics: {
      totalSessions: 0,
      totalWords: 0,
      averageConfidence: 0,
      errors: 0
    },
    
    // Event callbacks
    callbacks: {
      onStart: [],
      onEnd: [],
      onResult: [],
      onInterimResult: [],
      onError: [],
      onSpeechStart: [],
      onSpeechEnd: [],
      onAudioProcessing: []
    }
  };

  // Initialize the best available speech recognition backend
  const initialize = async () => {
    
    const backendPriority = ['web_speech_api', 'speech_recognition_fallback', 'mock_recognition'];

    for (const backendName of backendPriority) {
      try {
        const backend = backends[backendName];
        const isAvailable = await backend.checkAvailability(state);

        if (isAvailable) {
          state.activeBackend = backendName;
          await backend.initialize(state);
          state.isInitialized = true;
          
          return true;
        }
      } catch (error) {
        console.warn(`Failed to initialize ${backendName}:`, error.message);
        continue;
      }
    }

    throw new Error('No speech recognition backends available');
  };

  // Start listening for speech
  const startListening = async () => {
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

    // Notify start callbacks
    notifyCallbacks('onStart', createSpeechEvent({
      type: 'speech_recognition_start',
      data: { backend: state.activeBackend }
    }));
  };

  // Stop listening
  const stopListening = async () => {
    if (!state.isListening || !state.activeBackend) {
      return;
    }

    console.log('🔇 Stopping speech recognition...');
    
    const backend = backends[state.activeBackend];
    await backend.stop(state);
    
    state.isListening = false;

    // Notify end callbacks
    notifyCallbacks('onEnd', createSpeechEvent({
      type: 'speech_recognition_end',
      data: { backend: state.activeBackend }
    }));
  };

  // Abort listening immediately
  const abortListening = async () => {
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
  };

  // Get current status
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    isListening: state.isListening,
    activeBackend: state.activeBackend,
    backendInfo: state.activeBackend ? SPEECH_BACKENDS[state.activeBackend] : null,
    language: state.language,
    continuous: state.continuous,
    interimResults: state.interimResults,
    metrics: { ...state.metrics },
    currentTranscript: state.currentTranscript,
    finalTranscript: state.finalTranscript
  });

  // Cleanup resources
  const cleanup = async () => {
    if (state.isListening) {
      await stopListening();
    }

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

  // Event subscription methods
  const onStart = (callback) => subscribeCallback('onStart', callback);
  const onEnd = (callback) => subscribeCallback('onEnd', callback);
  const onResult = (callback) => subscribeCallback('onResult', callback);
  const onInterimResult = (callback) => subscribeCallback('onInterimResult', callback);
  const onError = (callback) => subscribeCallback('onError', callback);
  const onSpeechStart = (callback) => subscribeCallback('onSpeechStart', callback);
  const onSpeechEnd = (callback) => subscribeCallback('onSpeechEnd', callback);
  const onAudioProcessing = (callback) => subscribeCallback('onAudioProcessing', callback);

  // Helper functions
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  const notifyCallbacks = (eventType, event) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn(`Speech recognition ${eventType} callback error:`, error);
      }
    });
  };

  // Backend implementations
  const backends = {
    web_speech_api: createWebSpeechAPIBackend(),
    speech_recognition_fallback: createFallbackBackend(),
    mock_recognition: createMockRecognitionBackend()
  };

  return {
    // Core functionality
    initialize,
    startListening,
    stopListening,
    abortListening,
    cleanup,

    // Status
    getStatus,
    isListening: () => state.isListening,
    isInitialized: () => state.isInitialized,
    getActiveBackend: () => state.activeBackend,

    // Event handlers
    onStart,
    onEnd,
    onResult,
    onInterimResult,
    onError,
    onSpeechStart,
    onSpeechEnd,
    onAudioProcessing,

    // Configuration
    setLanguage: (language) => { state.language = language; },
    setContinuous: (continuous) => { state.continuous = continuous; },
    setInterimResults: (interimResults) => { state.interimResults = interimResults; },

    // Information
    getSupportedBackends: () => Object.keys(SPEECH_BACKENDS),
    getBackendInfo: (backendName) => SPEECH_BACKENDS[backendName] || null,
    getMetrics: () => ({ ...state.metrics })
  };
};

// Web Speech API Backend with Web Audio API Integration
const createWebSpeechAPIBackend = () => {
  // Audio processing state
  let audioContext = null;
  let analyser = null;
  let microphone = null;
  let processor = null;
  let audioStream = null;
  const checkAvailability = async (state) => {
    if (!state.runtime.isBrowser) {
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

    // Initialize Web Audio API for enhanced audio processing
    await initializeWebAudioAPI(state);

    // Setup event handlers
    state.recognition.onstart = () => {
      console.log('🎤 Web Speech API started listening');
    };

    state.recognition.onend = () => {
      console.log('🔇 Web Speech API stopped listening');
    };

    state.recognition.onspeechstart = () => {
      state.callbacks.onSpeechStart.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'speech_start',
            data: {}
          }));
        } catch (error) {
          console.warn('Speech start callback error:', error);
        }
      });
    };

    state.recognition.onspeechend = () => {
      state.callbacks.onSpeechEnd.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'speech_end',
            data: {}
          }));
        } catch (error) {
          console.warn('Speech end callback error:', error);
        }
      });
    };

    state.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          
          // Create final result
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
          
          // Update average confidence
          if (confidence > 0) {
            state.metrics.averageConfidence = 
              (state.metrics.averageConfidence + confidence) / 2;
          }

          const speechResult = createSpeechRecognitionResult({
            transcript: finalTranscript.trim(),
            confidence,
            isFinal: true,
            isInterim: false,
            words,
            language: state.language,
            processingTime: 0
          });

          // Notify final result callbacks
          state.callbacks.onResult.forEach(callback => {
            try {
              callback(speechResult);
            } catch (error) {
              console.warn('Speech result callback error:', error);
            }
          });

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
        state.callbacks.onInterimResult.forEach(callback => {
          try {
            callback(interimResult);
          } catch (error) {
            console.warn('Interim result callback error:', error);
          }
        });
      }
    };

    state.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      state.metrics.errors++;
      
      const errorEvent = createSpeechEvent({
        type: 'speech_recognition_error',
        data: { 
          error: event.error, 
          message: event.message || 'Speech recognition error'
        },
        severity: 'error'
      });

      state.callbacks.onError.forEach(callback => {
        try {
          callback(errorEvent);
        } catch (error) {
          console.warn('Error callback error:', error);
        }
      });
    };

    console.log('✅ Web Speech API configured');
  };

  const start = async (state) => {
    if (!state.recognition) {
      throw new Error('Web Speech API not initialized');
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
      
      // Request microphone access
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      // Create audio context
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100
      });

      // Create analyser for real-time audio analysis
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
        // Get frequency and time domain data
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(timeData);

        // Calculate real-time audio metrics
        const audioMetrics = calculateRealTimeAudioMetrics(frequencyData, timeData);
        
        // Notify audio processing callbacks if available
        if (state.callbacks.onAudioProcessing) {
          state.callbacks.onAudioProcessing.forEach(callback => {
            try {
              callback({
                type: 'audio_processing',
                data: audioMetrics,
                timestamp: Date.now()
              });
            } catch (error) {
              console.warn('Audio processing callback error:', error);
            }
          });
        }
      };

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      console.log('✅ Web Audio API integration initialized');
      
    } catch (error) {
      console.warn('⚠️ Web Audio API initialization failed:', error);
      // Continue without Web Audio API enhancement
    }
  };

  // Calculate real-time audio metrics
  const calculateRealTimeAudioMetrics = (frequencyData, timeData) => {
    // Volume level (RMS)
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const volumeLevel = Math.sqrt(sum / timeData.length);

    // Frequency analysis
    const signalLevel = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
    
    // Background noise estimation (low frequencies)
    const lowFreqBins = frequencyData.slice(0, Math.floor(frequencyData.length * 0.3));
    const backgroundNoise = lowFreqBins.reduce((sum, value) => sum + value, 0) / lowFreqBins.length;
    
    // High frequency content (clarity indicator)
    const highFreqStart = Math.floor(frequencyData.length * 0.6);
    const highFreqBins = frequencyData.slice(highFreqStart);
    const clarity = highFreqBins.reduce((sum, value) => sum + value, 0) / highFreqBins.length;

    return {
      volumeLevel: Math.round(volumeLevel * 100) / 100,
      signalLevel: Math.round(signalLevel),
      backgroundNoise: Math.round(backgroundNoise),
      clarity: Math.round(clarity),
      timestamp: Date.now()
    };
  };

  const cleanup = async (state) => {
    // Cleanup Web Audio API resources
    if (processor) {
      processor.disconnect();
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
      await audioContext.close();
      audioContext = null;
    }
    
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }

    // Cleanup speech recognition
    if (state.recognition) {
      state.recognition.onstart = null;
      state.recognition.onend = null;
      state.recognition.onresult = null;
      state.recognition.onerror = null;
      state.recognition.onspeechstart = null;
      state.recognition.onspeechend = null;
      state.recognition = null;
    }

    console.log('🧹 Web Speech API + Web Audio API cleaned up');
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

// Fallback Backend (Text Input Simulation)
const createFallbackBackend = () => {
  let textInput = null;
  let inputContainer = null;
  let isActive = false;

  const checkAvailability = async (state) => {
    return state.runtime.isBrowser; // Only works in browser
  };

  const initialize = async (state) => {
    if (!state.runtime.isBrowser) {
      throw new Error('Fallback backend requires browser environment');
    }

    // Create a text input interface for speech simulation
    console.log('🔄 Setting up speech recognition fallback (text input)...');
    createTextInputInterface(state);
    console.log('✅ Speech recognition fallback ready');
  };

  const createTextInputInterface = (state) => {
    // Create input container
    inputContainer = document.createElement('div');
    inputContainer.id = 'speech-fallback-container';
    inputContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f0f0f0;
      border: 2px solid #ccc;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-width: 300px;
      display: none;
    `;

    // Create header
    const header = document.createElement('div');
    header.innerHTML = '🎤 Speech Input Simulation';
    header.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #333;';
    inputContainer.appendChild(header);

    // Create text input
    textInput = document.createElement('textarea');
    textInput.placeholder = 'Type text to simulate speech recognition...';
    textInput.style.cssText = `
      width: 100%;
      height: 80px;
      margin-bottom: 10px;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      resize: vertical;
      font-size: 14px;
      box-sizing: border-box;
    `;
    inputContainer.appendChild(textInput);

    // Create buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px;';

    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send as Final';
    sendButton.style.cssText = `
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    sendButton.onclick = () => sendText(state, textInput.value, true);

    const interimButton = document.createElement('button');
    interimButton.textContent = 'Send as Interim';
    interimButton.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    interimButton.onclick = () => sendText(state, textInput.value, false);

    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    clearButton.onclick = () => { textInput.value = ''; };

    buttonContainer.appendChild(sendButton);
    buttonContainer.appendChild(interimButton);
    buttonContainer.appendChild(clearButton);
    inputContainer.appendChild(buttonContainer);

    // Add Enter key support
    textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText(state, textInput.value, true);
      }
    });

    // Append to body
    document.body.appendChild(inputContainer);
  };

  const sendText = (state, text, isFinal) => {
    if (!text.trim()) return;

    const words = text.trim().split(' ').map((word, index) => 
      createSpeechWord({
        word: word.trim(),
        confidence: 0.95, // High confidence for manual input
        startTime: index * 100,
        endTime: (index + 1) * 100
      })
    ).filter(word => word.word.length > 0);

    const result = createSpeechRecognitionResult({
      transcript: text.trim(),
      confidence: 0.95,
      isFinal,
      isInterim: !isFinal,
      words: isFinal ? words : [],
      language: state.language,
      processingTime: 0
    });

    if (isFinal) {
      state.finalTranscript += text.trim() + ' ';
      state.metrics.totalWords += words.length;
      textInput.value = ''; // Clear after final

      state.callbacks.onResult.forEach(callback => {
        try {
          callback(result);
        } catch (error) {
          console.warn('Fallback result callback error:', error);
        }
      });
    } else {
      state.currentTranscript = text.trim();
      
      state.callbacks.onInterimResult.forEach(callback => {
        try {
          callback(result);
        } catch (error) {
          console.warn('Fallback interim result callback error:', error);
        }
      });
    }
  };

  const start = async (state) => {
    if (inputContainer) {
      inputContainer.style.display = 'block';
      textInput.focus();
      isActive = true;
    }
  };

  const stop = async (state) => {
    if (inputContainer) {
      inputContainer.style.display = 'none';
      isActive = false;
    }
  };

  const cleanup = async (state) => {
    if (inputContainer && inputContainer.parentNode) {
      inputContainer.parentNode.removeChild(inputContainer);
    }
    inputContainer = null;
    textInput = null;
    isActive = false;
  };

  return {
    checkAvailability,
    initialize,
    start,
    stop,
    cleanup
  };
};

// Mock Recognition Backend
const createMockRecognitionBackend = () => {
  let mockInterval = null;
  let sampleTexts = [
    'Hello, this is a test of speech recognition.',
    'The weather is looking great today.',
    'I need to finish my work before the deadline.',
    'This is an example of continuous speech recognition.',
    'Testing the interim and final results functionality.'
  ];
  let textIndex = 0;

  const checkAvailability = async (state) => {
    return true; // Always available
  };

  const initialize = async (state) => {
    console.log('🔄 Initializing mock speech recognition...');
    console.log('✅ Mock speech recognition ready');
  };

  const start = async (state) => {
    console.log('🎤 Mock speech recognition started');
    
    // Simulate speech recognition with periodic results
    let wordIndex = 0;
    const currentText = sampleTexts[textIndex % sampleTexts.length];
    const words = currentText.split(' ');

    mockInterval = setInterval(() => {
      if (wordIndex < words.length) {
        // Send interim result
        const interimText = words.slice(0, wordIndex + 1).join(' ');
        const interimResult = createSpeechRecognitionResult({
          transcript: interimText,
          confidence: 0.8,
          isFinal: false,
          isInterim: true,
          words: [],
          language: state.language,
          processingTime: Math.random() * 50
        });

        state.currentTranscript = interimText;
        state.callbacks.onInterimResult.forEach(callback => {
          try {
            callback(interimResult);
          } catch (error) {
            console.warn('Mock interim result callback error:', error);
          }
        });

        wordIndex++;
      } else {
        // Send final result
        const finalWords = words.map((word, index) => 
          createSpeechWord({
            word,
            confidence: 0.85 + Math.random() * 0.15,
            startTime: index * 200,
            endTime: (index + 1) * 200
          })
        );

        const finalResult = createSpeechRecognitionResult({
          transcript: currentText,
          confidence: 0.85,
          isFinal: true,
          isInterim: false,
          words: finalWords,
          language: state.language,
          processingTime: Math.random() * 100
        });

        state.finalTranscript += currentText + ' ';
        state.metrics.totalWords += words.length;

        state.callbacks.onResult.forEach(callback => {
          try {
            callback(finalResult);
          } catch (error) {
            console.warn('Mock result callback error:', error);
          }
        });

        // Move to next sample text
        textIndex++;
        wordIndex = 0;
        
        // Stop after a few iterations unless continuous
        if (!state.continuous && textIndex >= 3) {
          clearInterval(mockInterval);
          mockInterval = null;
        }
      }
    }, 500 + Math.random() * 500); // Variable timing
  };

  const stop = async (state) => {
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
    console.log('🔇 Mock speech recognition stopped');
  };

  const cleanup = async (state) => {
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
  };

  return {
    checkAvailability,
    initialize,
    start,
    stop,
    cleanup
  };
};

// Export default factory
export { createSpeechRecognition };