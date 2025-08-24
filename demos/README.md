# Speech & Audio Analysis Demo

A comprehensive demonstration of all speech and audio analysis features in the Synopticon API, including real-time transcription, LLM analysis, audio quality monitoring, voice activity detection, speaker diarization, emotion detection, speaking pace analysis, and conversation flow analysis.

## 🎯 Features Demonstrated

### Core Speech Analysis
- **Real-time Speech Recognition** - Continuous speech-to-text with confidence scoring
- **LLM-based Analysis** - Intelligent analysis using multiple configurable prompts
- **Context Management** - Maintains conversation context and generates summaries

### Audio Processing Pipeline
- **Voice Activity Detection (VAD)** - Multi-algorithm voice detection with temporal smoothing
- **Audio Quality Metrics** - SNR analysis, clipping detection, quality scoring
- **Audio Preprocessing** - Noise reduction, automatic gain control, filtering
- **Real-time Audio Analysis** - Pitch detection, MFCC calculation, spectral analysis

### Advanced Analytics
- **Speaker Diarization** - Voice fingerprinting and speaker identification
- **Emotion Detection** - Prosodic feature-based emotion analysis
- **Speaking Pace Analysis** - WPM calculation, fluency analysis, filler detection
- **Conversation Flow Analysis** - Turn-taking patterns, interruption detection, quality scoring

### Export & Reporting
- **Comprehensive Reports** - JSON, CSV, TXT, and Markdown export formats
- **Performance Metrics** - Real-time monitoring of all components
- **Event Logging** - Detailed activity logs with timestamps

## 📁 Demo Files

### `speech-audio-comprehensive-demo.js`
The main demo JavaScript module that orchestrates all speech and audio analysis components.

**Key Features:**
- Factory function pattern following functional programming principles
- Comprehensive component integration and management
- Real-time event handling and data processing
- Export functionality for all data formats
- Performance monitoring and metrics collection

**Usage:**
```javascript
import { createComprehensiveSpeechAudioDemo } from './speech-audio-comprehensive-demo.js';

const demo = createComprehensiveSpeechAudioDemo();
await demo.initialize();
await demo.start();

// Demo will process speech and show all features in action
// Stop with: await demo.stop();
```

### `speech-audio-demo.html`
Interactive web interface for the comprehensive demo with real-time metrics display.

**Features:**
- Modern responsive design with gradient styling
- Real-time metrics dashboard with live updates
- Interactive controls for demo management
- Configuration panel for adjusting settings
- Event log with color-coded messages
- Component status indicators
- Export functionality with one-click download

**UI Components:**
- **Control Panel**: Start/stop controls, configuration, event logging
- **Metrics Panel**: Real-time performance metrics and current analysis data
- **Live Transcription**: Real-time speech-to-text with confidence display
- **Audio Quality Monitor**: SNR, clipping, and quality indicators
- **Speaker & Emotion Tracking**: Current speaker and emotional state
- **Speaking Pace & Flow**: WPM, fluency, and conversation quality metrics

## 🚀 Quick Start

### Method 1: Web Interface (Recommended)
1. Open `speech-audio-demo.html` in a modern web browser
2. Click "Start Demo" to begin
3. Grant microphone permissions when prompted
4. Speak to see all features in action
5. Export reports using the "Export Report" button

### Method 2: Programmatic Usage
```javascript
import { runDemo } from './speech-audio-comprehensive-demo.js';

// Run demo for 60 seconds
const demo = await runDemo(60000);

// Or create and control manually
const demo = createComprehensiveSpeechAudioDemo();
await demo.initialize();
await demo.start();

// Check status
console.log('Demo running:', demo.isRunning());
console.log('Current metrics:', demo.getMetrics());

// Stop and generate report
await demo.stop();
const report = await demo.generateReport('json');
console.log(report.data);
```

### Method 3: Node.js/Bun Usage
```bash
# Using Bun (recommended)
bun run demos/speech-audio-comprehensive-demo.js

# Using Node.js
node demos/speech-audio-comprehensive-demo.js
```

## ⚙️ Configuration Options

### Speech Analysis Configuration
```javascript
const config = {
  language: 'en-US',           // Recognition language
  continuous: true,            // Continuous recognition
  interimResults: true,        // Show interim results
  autoAnalyze: true,          // Automatic LLM analysis
  enableAudioQuality: true,   // Audio quality monitoring
  enableAnalytics: true,      // Conversation analytics
  enableConversationFlow: true, // Flow analysis
  
  // LLM Configuration
  llmConfig: {
    preferredBackend: 'webllm',
    temperature: 0.7,
    maxTokens: 50
  },
  
  // Custom analysis prompts
  prompts: [
    'Analyze the emotional tone in 3-5 words.',
    'Identify key topics mentioned.',
    'Rate the speaker confidence (1-10) and why.'
  ]
};
```

### Audio Processing Configuration
```javascript
const audioConfig = {
  sampleRate: 44100,          // Audio sample rate
  bufferSize: 4096,           // Processing buffer size
  fftSize: 2048,              // FFT size for spectral analysis
  vadSensitivity: 0.5,        // VAD sensitivity (0-1)
  emotionSmoothing: 0.3,      // Emotion smoothing factor
  enableNoiseReduction: true, // Audio preprocessing
  enableAGC: true,            // Automatic gain control
  agcTarget: 0.5              // AGC target level
};
```

## 📊 Metrics & Data

### Performance Metrics
- **Transcriptions**: Total number of speech transcriptions processed
- **LLM Analyses**: Number of AI-powered analyses performed
- **VAD Triggers**: Voice activity detection events
- **Speaker Changes**: Speaker diarization events
- **Emotion Detections**: Emotion state changes
- **Conversation Events**: Flow analysis updates

### Real-time Data Display
- **Audio Quality**: SNR levels, clipping detection, quality scoring
- **Speaker Analysis**: Current speaker identification and confidence
- **Emotion Analysis**: Dominant emotion, arousal/valence levels
- **Speaking Pace**: Words per minute, fluency score, filler word count
- **Conversation Flow**: Turn-taking patterns, participation balance

### Export Formats

#### JSON Report
```json
{
  "demoMetadata": {
    "startTime": "2024-01-20T10:30:00.000Z",
    "duration": 120.5,
    "componentsUsed": ["speechAPI", "audioAnalyzer", "vad", ...]
  },
  "performanceMetrics": {
    "totalTranscriptions": 45,
    "totalAnalyses": 12,
    "averageConfidence": 0.87
  },
  "componentData": {
    "speechAnalysis": {...},
    "audioQuality": {...},
    "conversationFlow": {...}
  }
}
```

#### CSV Export
Structured tabular data with timestamps, transcriptions, analyses, and metrics.

#### Markdown Report
Human-readable report with sections for summary, transcriptions, analyses, and insights.

## 🔧 Development & Testing

### Testing Individual Components
```javascript
const demo = createComprehensiveSpeechAudioDemo();
await demo.initialize();

// Test specific components
await demo.testComponent('vad', { /* test parameters */ });
await demo.testComponent('emotionDetection', { pitch: 150, energy: 0.5 });
await demo.testComponent('speakingPace', { text: 'Test sentence' });
```

### Debug Mode
```javascript
const demo = createComprehensiveSpeechAudioDemo();
demo.updateConfig({ 
  display: { 
    showDebugInfo: true,
    updateInterval: 50  // Faster updates for debugging
  }
});
```

### Event Monitoring
```javascript
// Monitor all events
demo.logEvent('Custom event message', 'info');

// Get recent logs
const logs = demo.getLogs();
console.log('Recent events:', logs.slice(-10));

// Clear logs
demo.clearLogs();
```

## 🎛️ Browser Compatibility

### Supported Browsers
- **Chrome 88+**: Full feature support
- **Firefox 85+**: Full feature support  
- **Safari 14+**: Full feature support
- **Edge 88+**: Full feature support

### Required Permissions
- **Microphone Access**: Required for real-time audio analysis
- **Local Storage**: Used for configuration persistence (optional)

### Web Audio API Requirements
- Modern browser with Web Audio API support
- HTTPS required for microphone access (except localhost)
- Minimum 44.1kHz audio context support

## 🚨 Troubleshooting

### Common Issues

**Microphone Access Denied**
- Ensure HTTPS (or localhost for development)
- Check browser permissions settings
- Try refreshing and re-granting permissions

**Demo Not Starting**
- Check browser console for errors
- Verify all demo files are properly served
- Ensure no CORS issues with modules

**Poor Audio Quality**
- Check microphone positioning and environment
- Adjust VAD sensitivity in configuration
- Enable audio preprocessing features

**Missing LLM Analyses**
- Verify LLM backend is properly configured
- Check network connectivity for remote backends
- Consider using 'mock' backend for testing

### Debug Steps
1. Open browser developer console
2. Check for JavaScript errors or warnings
3. Verify microphone permissions in browser settings
4. Test with different browsers if issues persist
5. Check network connectivity for online features

## 📈 Performance Optimization

### Memory Usage
- Enhanced object pooling with 95%+ reuse efficiency
- Automatic cleanup of old data beyond configured limits
- Efficient buffer management for audio processing

### Processing Efficiency
- Multi-algorithm VAD with consensus voting
- Optimized MFCC calculation using FFT
- Parallel processing of multiple analysis components

### Network Optimization
- Local processing for core features
- Optional remote LLM backends with fallbacks
- Efficient data serialization for exports

## 📚 Integration Examples

### Research Applications
```javascript
// Behavioral research setup
const demo = createComprehensiveSpeechAudioDemo();
demo.updateConfig({
  prompts: [
    'Identify stress indicators in speech patterns.',
    'Analyze communication confidence levels.',
    'Detect signs of cognitive load or fatigue.'
  ],
  enableConversationFlow: true,
  flowAnalysisWindow: 60.0  // Longer analysis windows
});
```

### Clinical Applications
```javascript
// Clinical assessment configuration
demo.updateConfig({
  emotionSmoothing: 0.1,      // More sensitive emotion detection
  vadSensitivity: 0.3,        // Higher sensitivity for quiet speech
  enableAudioQuality: true,   // Monitor recording quality
  analysisConfig: {
    prompts: [
      'Assess speech fluency and clarity.',
      'Identify potential speech disorders.',
      'Evaluate emotional state indicators.'
    ]
  }
});
```

### Educational Applications
```javascript
// Language learning setup
demo.updateConfig({
  language: 'en-US',
  prompts: [
    'Evaluate pronunciation accuracy.',
    'Identify grammatical errors.',
    'Assess speaking confidence and fluency.'
  ],
  enableSpeakingPace: true,
  enableFlillersDetection: true
});
```

## 🤝 Contributing

To extend the demo with additional features:

1. Add new component imports to the demo file
2. Initialize components in the `initializeDemo()` function
3. Add event handlers in `setupEventHandlers()`
4. Update the UI elements in the HTML file
5. Add corresponding metrics and display logic

## 📄 License

This demo is part of the Synopticon API open-source project. See the main project license for details.

---

**Ready to explore the full power of speech and audio analysis? Start the demo and speak to see all features in action!** 🎤✨