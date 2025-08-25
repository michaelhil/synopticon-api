/**
 * Comprehensive Speech and Audio Analysis Demo
 * Demonstrates all speech and audio analysis features in the Synopticon API
 * 
 * Features demonstrated:
 * - Real-time Speech Recognition
 * - LLM-based Speech Analysis
 * - Audio Quality Monitoring
 * - Voice Activity Detection
 * - Speaker Diarization
 * - Emotion Detection from Voice
 * - Speaking Pace Analysis
 * - Conversation Flow Analysis
 * - Audio Preprocessing
 * - Export functionality
 */

// Import all speech and audio components
import { 
  createSpeechAnalysisAPI,
  createSpeechRecognition,
  createLLMClient
} from '../../src/speech-analysis/index.js';

import { createRealtimeAudioAnalyzer } from '../../src/audio/realtime-audio-analyzer.js';
import { createAdvancedVAD } from '../../src/audio/voice-activity-detection.js';
import { createAudioQualityAnalyzer } from '../../src/audio/audio-quality-metrics.js';
import { createAudioPreprocessingPipeline } from '../../src/audio/audio-preprocessing-pipeline.js';
import { createSpeakerDiarization } from '../../src/audio/speaker-diarization.js';
import { createEmotionDetection } from '../../src/audio/emotion-detection.js';
import { createSpeakingPaceAnalysis } from '../../src/audio/speaking-pace-analysis.js';
import { createConversationAnalytics } from '../../src/audio/conversation-analytics.js';

/**
 * Main demo class showcasing all speech and audio features
 */
export const createComprehensiveSpeechAudioDemo = () => {
  let isRunning = false;
  let demoSession = null;
  let audioContext = null;
  let mediaStream = null;
  let demoStartTime = null;
  
  // Component instances
  const components = {
    speechAPI: null,
    audioAnalyzer: null,
    vad: null,
    audioQuality: null,
    preprocessing: null,
    speakerDiarization: null,
    emotionDetection: null,
    speakingPace: null,
    conversationFlow: null
  };

  // Demo configuration
  const config = {
    // Speech Analysis API configuration
    speechAPI: {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      autoAnalyze: true,
      enableAudioQuality: true,
      enableAnalytics: true,
      enableConversationFlow: true,
      
      // LLM configuration
      llmConfig: {
        preferredBackend: 'mock', // Use mock for demo reliability
        temperature: 0.7,
        maxTokens: 50
      },
      
      // Analysis prompts
      prompts: [
        'Analyze the emotional tone in 3-5 words.',
        'Identify key topics mentioned.',
        'Rate the speaker confidence (1-10) and why.',
        'Detect any stress indicators in speech.'
      ],
      
      systemPrompt: 'You are analyzing speech for behavioral research. Be concise and objective.'
    },
    
    // Audio processing configuration
    audio: {
      sampleRate: 44100,
      bufferSize: 4096,
      fftSize: 2048,
      smoothingTimeConstant: 0.8
    },
    
    // Demo display configuration
    display: {
      updateInterval: 100, // ms
      maxLogEntries: 50,
      showDebugInfo: true
    }
  };

  // Demo state and metrics
  const state = {
    metrics: {
      totalTranscriptions: 0,
      totalAnalyses: 0,
      audioQualityUpdates: 0,
      vadDetections: 0,
      speakerChanges: 0,
      emotionDetections: 0,
      paceAnalyses: 0,
      conversationEvents: 0
    },
    
    logs: [],
    
    currentData: {
      transcription: '',
      confidence: 0,
      audioQuality: null,
      vadState: 'inactive',
      currentSpeaker: null,
      emotion: null,
      speakingPace: null,
      conversationFlow: null,
      processedAudio: null
    }
  };

  /**
   * Initialize all components for the demo
   */
  const initializeDemo = async () => {
    try {
      logEvent('🚀 Initializing Comprehensive Speech & Audio Demo...');

      // Initialize Speech Analysis API with full configuration
      components.speechAPI = createSpeechAnalysisAPI(config.speechAPI);
      
      await components.speechAPI.initialize({
        enableSync: true,
        streamConfig: {
          bufferSize: config.audio.bufferSize,
          sampleRate: config.audio.sampleRate
        }
      });

      // Initialize individual audio components
      components.audioAnalyzer = createRealtimeAudioAnalyzer({
        sampleRate: config.audio.sampleRate,
        fftSize: config.audio.fftSize,
        enableAdvancedFeatures: true
      });

      components.vad = createAdvancedVAD({
        algorithm: 'multi_algorithm',
        energyThreshold: 0.01,
        spectralThreshold: 0.5,
        temporalSmoothing: true
      });

      components.audioQuality = createAudioQualityAnalyzer({
        fftSize: config.audio.fftSize,
        smoothingTimeConstant: config.audio.smoothingTimeConstant,
        enableRecommendations: true
      });

      components.preprocessing = createAudioPreprocessingPipeline({
        enableNoiseReduction: true,
        enableAGC: true,
        enableHighPassFilter: true,
        agcTarget: 0.5
      });

      components.speakerDiarization = createSpeakerDiarization({
        mfccCoefficients: 13,
        windowSize: 1024,
        hopSize: 512,
        enableRealtime: true
      });

      components.emotionDetection = createEmotionDetection({
        model: 'prosodic_features',
        enableDimensional: true,
        smoothingFactor: 0.3
      });

      components.speakingPace = createSpeakingPaceAnalysis({
        windowSize: 5.0,
        enableFlillersDetection: true,
        enableFlluencyAnalysis: true
      });

      components.conversationFlow = createConversationAnalytics({
        minSilenceDuration: 0.5,
        interruptionThreshold: 0.2,
        flowAnalysisWindow: 30.0
      });

      // Setup event handlers
      setupEventHandlers();

      logEvent('✅ All components initialized successfully');
      return true;

    } catch (error) {
      logEvent(`❌ Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  };

  /**
   * Setup event handlers for all components
   */
  const setupEventHandlers = () => {
    // Speech Analysis API events
    components.speechAPI.onReady((event) => {
      logEvent(`🎤 Speech API ready with components: ${event.components.join(', ')}`);
    });

    components.speechAPI.onTranscription((event) => {
      state.metrics.totalTranscriptions++;
      state.currentData.transcription = event.data.result.transcript || event.data.result.text;
      state.currentData.confidence = event.data.result.confidence;
      
      logEvent(`📝 Transcription (${(state.currentData.confidence * 100).toFixed(1)}%): "${state.currentData.transcription}"`);
      
      // Feed transcription to individual audio components
      processAudioWithComponents(event.data.result);
    });

    components.speechAPI.onAnalysis((event) => {
      state.metrics.totalAnalyses++;
      const analysis = event.data.result;
      
      logEvent(`🧠 Analysis: "${analysis.response}" (Prompt: "${analysis.prompt}")`);
    });

    components.speechAPI.onQualityUpdate((event) => {
      state.metrics.audioQualityUpdates++;
      state.currentData.audioQuality = event.data;
      
      logEvent(`🔊 Audio Quality: ${event.data.current?.quality || 'Unknown'} (SNR: ${event.data.current?.signalToNoise?.toFixed(1) || 'N/A'}dB)`);
    });

    components.speechAPI.onError((event) => {
      logEvent(`❌ Error: ${event.message} (Source: ${event.source || 'unknown'})`, 'error');
    });

    components.speechAPI.onStatusChange((event) => {
      logEvent(`📊 Status Change: ${JSON.stringify(event.data)}`);
    });
  };

  /**
   * Process audio data with individual components
   */
  const processAudioWithComponents = async (transcriptionResult) => {
    const timestamp = Date.now();
    const audioFeatures = transcriptionResult.audioFeatures || {};
    
    try {
      // Voice Activity Detection
      if (components.vad && audioFeatures.audioBuffer) {
        const vadResult = components.vad.detectVoiceActivity(audioFeatures.audioBuffer, timestamp);
        if (vadResult.isVoiceActive !== (state.currentData.vadState === 'active')) {
          state.metrics.vadDetections++;
          state.currentData.vadState = vadResult.isVoiceActive ? 'active' : 'inactive';
          logEvent(`🎙️ VAD: ${vadResult.isVoiceActive ? 'Voice detected' : 'Silence'} (Confidence: ${(vadResult.confidence * 100).toFixed(1)}%)`);
        }
      }

      // Audio Preprocessing (simulate processing)
      if (components.preprocessing && audioFeatures.audioBuffer) {
        const processed = await components.preprocessing.processAudio(audioFeatures.audioBuffer);
        state.currentData.processedAudio = processed;
        
        if (processed.appliedEffects?.length > 0) {
          logEvent(`🔧 Audio Processing: Applied ${processed.appliedEffects.join(', ')}`);
        }
      }

      // Speaker Diarization
      if (components.speakerDiarization) {
        const speakerResult = components.speakerDiarization.analyzeSpeaker(
          transcriptionResult.transcript || transcriptionResult.text,
          audioFeatures,
          timestamp
        );
        
        if (speakerResult.speakerId !== state.currentData.currentSpeaker) {
          state.metrics.speakerChanges++;
          state.currentData.currentSpeaker = speakerResult.speakerId;
          logEvent(`👤 Speaker Change: ${speakerResult.speakerId} (Confidence: ${(speakerResult.confidence * 100).toFixed(1)}%)`);
        }
      }

      // Emotion Detection
      if (components.emotionDetection) {
        const emotionResult = components.emotionDetection.analyzeEmotion(audioFeatures, timestamp);
        
        if (emotionResult.dominant && emotionResult.dominant !== state.currentData.emotion?.dominant) {
          state.metrics.emotionDetections++;
          state.currentData.emotion = emotionResult;
          logEvent(`😊 Emotion: ${emotionResult.dominant} (${(emotionResult.confidence * 100).toFixed(1)}%) [Arousal: ${emotionResult.arousal?.toFixed(2)}, Valence: ${emotionResult.valence?.toFixed(2)}]`);
        }
      }

      // Speaking Pace Analysis
      if (components.speakingPace) {
        const paceResult = components.speakingPace.analyzePace(
          transcriptionResult.transcript || transcriptionResult.text,
          audioFeatures,
          timestamp
        );
        
        if (paceResult.wordsPerMinute) {
          state.metrics.paceAnalyses++;
          state.currentData.speakingPace = paceResult;
          
          const wpm = paceResult.wordsPerMinute.toFixed(0);
          const fluency = (paceResult.fluencyScore * 100).toFixed(0);
          logEvent(`⚡ Speaking Pace: ${wpm} WPM, Fluency: ${fluency}%, Fillers: ${paceResult.fillerWords || 0}`);
        }
      }

      // Conversation Flow Analysis
      if (components.conversationFlow) {
        const speakerData = {
          [state.currentData.currentSpeaker || 'default']: {
            isActive: state.currentData.vadState === 'active',
            confidence: state.currentData.confidence || 0.8
          }
        };
        
        const flowResult = components.conversationFlow.analyze(speakerData, audioFeatures, timestamp);
        
        if (flowResult.currentMetrics) {
          state.metrics.conversationEvents++;
          state.currentData.conversationFlow = flowResult;
          
          const metrics = flowResult.currentMetrics.metrics;
          logEvent(`💬 Conversation Flow: ${flowResult.totalTurns} turns, Quality: ${(metrics.participationBalance * 100).toFixed(0)}%`);
        }
      }

    } catch (error) {
      logEvent(`⚠️ Component processing error: ${error.message}`, 'warn');
    }
  };

  /**
   * Start the comprehensive demo
   */
  const startDemo = async () => {
    if (isRunning) {
      logEvent('⚠️ Demo already running', 'warn');
      return;
    }

    try {
      logEvent('🎬 Starting Comprehensive Speech & Audio Demo...');
      demoStartTime = Date.now();

      // Request microphone access
      logEvent('🎤 Requesting microphone access...');
      mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: config.audio.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false, // We'll handle this in preprocessing
          autoGainControl: false   // We'll handle this in preprocessing
        } 
      });

      // Create audio context
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: config.audio.sampleRate
      });

      // Initialize components if not already done
      if (!components.speechAPI) {
        await initializeDemo();
      }

      // Start speech analysis session
      demoSession = await components.speechAPI.startSession();
      
      isRunning = true;
      
      logEvent(`✅ Demo started successfully! Session ID: ${demoSession}`);
      logEvent('🎯 Say something to see all features in action...');
      
      // Start demo metrics display
      startMetricsDisplay();

    } catch (error) {
      logEvent(`❌ Failed to start demo: ${error.message}`, 'error');
      isRunning = false;
    }
  };

  /**
   * Stop the demo
   */
  const stopDemo = async () => {
    if (!isRunning) {
      logEvent('⚠️ Demo not running', 'warn');
      return;
    }

    try {
      logEvent('🛑 Stopping demo...');

      // Stop speech analysis
      if (components.speechAPI) {
        await components.speechAPI.stopSession();
      }

      // Stop media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }

      // Close audio context
      if (audioContext) {
        await audioContext.close();
        audioContext = null;
      }

      isRunning = false;
      demoSession = null;

      const demoRuntime = demoStartTime ? ((Date.now() - demoStartTime) / 1000).toFixed(1) : 'unknown';
      logEvent(`✅ Demo stopped. Runtime: ${demoRuntime}s`);

      // Display final statistics
      displayFinalStatistics();

    } catch (error) {
      logEvent(`❌ Error stopping demo: ${error.message}`, 'error');
    }
  };

  /**
   * Generate comprehensive demo report
   */
  const generateDemoReport = async (format = 'json') => {
    if (!components.speechAPI) {
      throw new Error('Demo not initialized');
    }

    try {
      logEvent(`📋 Generating demo report in ${format.toUpperCase()} format...`);

      // Get data from all components
      const speechData = components.speechAPI.exportConversationData(format);
      const analyticsHistory = components.speechAPI.getAnalysisHistory();
      const conversationSummary = components.speechAPI.getConversationFlowSummary();
      
      // Compile comprehensive demo report
      const demoReport = {
        demoMetadata: {
          startTime: new Date(demoStartTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: demoStartTime ? (Date.now() - demoStartTime) / 1000 : 0,
          sessionId: demoSession,
          componentsUsed: Object.keys(components).filter(key => components[key] !== null)
        },
        
        performanceMetrics: {
          ...state.metrics,
          averageConfidence: analyticsHistory?.chunks ? 
            analyticsHistory.chunks.reduce((sum, chunk) => sum + chunk.confidence, 0) / analyticsHistory.chunks.length : 0
        },
        
        componentData: {
          speechAnalysis: speechData.data,
          audioQuality: state.currentData.audioQuality,
          conversationFlow: conversationSummary,
          currentStates: {
            vadState: state.currentData.vadState,
            currentSpeaker: state.currentData.currentSpeaker,
            emotion: state.currentData.emotion,
            speakingPace: state.currentData.speakingPace
          }
        },
        
        eventLogs: state.logs.slice(-20), // Last 20 events
        
        insights: generateDemoInsights()
      };

      if (format === 'json') {
        return {
          data: JSON.stringify(demoReport, null, 2),
          filename: `speech_audio_demo_report_${Date.now()}.json`,
          mimeType: 'application/json'
        };
      } else {
        // Use speech API export for other formats
        return speechData;
      }

    } catch (error) {
      logEvent(`❌ Failed to generate report: ${error.message}`, 'error');
      throw error;
    }
  };

  /**
   * Generate insights from demo data
   */
  const generateDemoInsights = () => {
    const insights = [];
    
    // Performance insights
    if (state.metrics.totalTranscriptions > 0) {
      insights.push(`Processed ${state.metrics.totalTranscriptions} transcriptions with ${state.metrics.totalAnalyses} LLM analyses`);
    }
    
    if (state.metrics.vadDetections > 0) {
      insights.push(`Voice Activity Detection triggered ${state.metrics.vadDetections} times`);
    }
    
    if (state.metrics.speakerChanges > 0) {
      insights.push(`Detected ${state.metrics.speakerChanges} speaker changes`);
    }
    
    if (state.metrics.emotionDetections > 0) {
      insights.push(`Identified ${state.metrics.emotionDetections} emotion changes`);
    }
    
    if (state.currentData.audioQuality) {
      insights.push(`Current audio quality: ${state.currentData.audioQuality.current?.quality || 'Unknown'}`);
    }
    
    if (state.currentData.conversationFlow?.currentMetrics) {
      const quality = state.currentData.conversationFlow.currentMetrics.metrics.participationBalance;
      insights.push(`Conversation balance score: ${(quality * 100).toFixed(0)}%`);
    }
    
    return insights;
  };

  /**
   * Start metrics display updates
   */
  const startMetricsDisplay = () => {
    const interval = setInterval(() => {
      if (!isRunning) {
        clearInterval(interval);
        return;
      }
      
      updateDisplayMetrics();
    }, config.display.updateInterval);
  };

  /**
   * Update display metrics (for UI integration)
   */
  const updateDisplayMetrics = () => {
    // This would update a UI if present
    if (typeof window !== 'undefined' && window.updateDemoMetrics) {
      window.updateDemoMetrics({
        isRunning,
        metrics: state.metrics,
        currentData: state.currentData,
        logs: state.logs.slice(-10) // Last 10 events for display
      });
    }
  };

  /**
   * Display final statistics
   */
  const displayFinalStatistics = () => {
    const runtime = demoStartTime ? ((Date.now() - demoStartTime) / 1000).toFixed(1) : 'unknown';
    
    logEvent('📊 DEMO STATISTICS:', 'info');
    logEvent(`⏱️  Runtime: ${runtime} seconds`);
    logEvent(`📝 Transcriptions: ${state.metrics.totalTranscriptions}`);
    logEvent(`🧠 LLM Analyses: ${state.metrics.totalAnalyses}`);
    logEvent(`🔊 Audio Quality Updates: ${state.metrics.audioQualityUpdates}`);
    logEvent(`🎙️  VAD Detections: ${state.metrics.vadDetections}`);
    logEvent(`👤 Speaker Changes: ${state.metrics.speakerChanges}`);
    logEvent(`😊 Emotion Detections: ${state.metrics.emotionDetections}`);
    logEvent(`⚡ Pace Analyses: ${state.metrics.paceAnalyses}`);
    logEvent(`💬 Conversation Events: ${state.metrics.conversationEvents}`);
  };

  /**
   * Log events with timestamp and type
   */
  const logEvent = (message, type = 'info') => {
    const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.sss
    const logEntry = {
      timestamp,
      message,
      type,
      fullTimestamp: new Date().toISOString()
    };
    
    state.logs.push(logEntry);
    
    // Limit log size
    if (state.logs.length > config.display.maxLogEntries) {
      state.logs.shift();
    }
    
    // Console output
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  };

  /**
   * Test individual components (for development/debugging)
   */
  const testComponent = async (componentName, testData = {}) => {
    if (!components[componentName]) {
      throw new Error(`Component ${componentName} not initialized`);
    }

    logEvent(`🧪 Testing component: ${componentName}`);

    try {
      switch (componentName) {
        case 'speechAPI':
          await components.speechAPI.processText(testData.text || 'This is a test message for speech analysis.');
          break;

        case 'vad':
          // Test with dummy audio buffer
          const dummyBuffer = new Float32Array(1024).fill(0.1);
          const vadResult = components.vad.detectVoiceActivity(dummyBuffer, Date.now());
          logEvent(`VAD Test Result: ${JSON.stringify(vadResult)}`);
          break;

        case 'emotionDetection':
          const emotionResult = components.emotionDetection.analyzeEmotion({
            pitch: testData.pitch || 150,
            energy: testData.energy || 0.5,
            spectralCentroid: testData.spectralCentroid || 2000
          }, Date.now());
          logEvent(`Emotion Test Result: ${JSON.stringify(emotionResult)}`);
          break;

        case 'speakingPace':
          const paceResult = components.speakingPace.analyzePace(
            testData.text || 'This is a test sentence for pace analysis.',
            { duration: 2.0 },
            Date.now()
          );
          logEvent(`Pace Test Result: ${JSON.stringify(paceResult)}`);
          break;

        default:
          logEvent(`No test available for component: ${componentName}`, 'warn');
      }

      logEvent(`✅ Component test completed: ${componentName}`);

    } catch (error) {
      logEvent(`❌ Component test failed: ${componentName} - ${error.message}`, 'error');
    }
  };

  // Public API
  return {
    // Core demo controls
    initialize: initializeDemo,
    start: startDemo,
    stop: stopDemo,
    
    // Status and data
    isRunning: () => isRunning,
    getState: () => ({ ...state }),
    getMetrics: () => ({ ...state.metrics }),
    getCurrentData: () => ({ ...state.currentData }),
    getLogs: () => [...state.logs],
    
    // Component access
    getComponents: () => ({ ...components }),
    getComponent: (name) => components[name],
    
    // Reporting and export
    generateReport: generateDemoReport,
    exportData: (format) => components.speechAPI?.exportConversationData(format),
    
    // Development utilities
    testComponent,
    processTestAudio: processAudioWithComponents,
    
    // Configuration
    getConfig: () => ({ ...config }),
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
      logEvent(`Configuration updated: ${Object.keys(newConfig).join(', ')}`);
    },
    
    // Event logging
    logEvent,
    clearLogs: () => {
      state.logs = [];
      logEvent('Logs cleared');
    }
  };
};

// Export default factory
export default createComprehensiveSpeechAudioDemo;

// Helper function for standalone usage
export const runDemo = async (duration = 60000) => {
  const demo = createComprehensiveSpeechAudioDemo();
  
  try {
    await demo.initialize();
    await demo.start();
    
    console.log(`Demo will run for ${duration / 1000} seconds...`);
    console.log('🎤 Please speak to see all features in action!');
    
    // Auto-stop after duration
    setTimeout(async () => {
      await demo.stop();
      const report = await demo.generateReport('json');
      console.log('📋 Final Report:', report.data);
    }, duration);
    
    return demo;
    
  } catch (error) {
    console.error('Failed to run demo:', error);
    return null;
  }
};