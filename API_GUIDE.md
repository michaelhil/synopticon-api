# API Guide: Complete Beginner's Guide and Synopticon System APIs

## 📖 What is an API?

An **API (Application Programming Interface)** is a set of rules and protocols that allows different software applications to communicate with each other. Think of it as a waiter in a restaurant - you (the client) tell the waiter (API) what you want from the kitchen (server), and the waiter brings back your order.

### Key Concepts:
- **Client**: The application making requests (your code, mobile app, website)
- **Server**: The application providing data or services
- **Request**: What the client asks for
- **Response**: What the server sends back
- **Endpoint**: A specific URL where an API can be accessed

## 🔄 Types of APIs

### 1. REST API (REpresentational State Transfer)
- **Most Common**: Standard web API using HTTP methods
- **Methods**: GET (read), POST (create), PUT (update), DELETE (remove)
- **Format**: Usually JSON data
- **Example**:
```javascript
// Get user data
fetch('https://api.example.com/users/123')
  .then(response => response.json())
  .then(data => console.log(data));

// Create new user
fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John', email: 'john@example.com' })
});
```

### 2. GraphQL API
- **Flexible**: Request exactly the data you need
- **Single Endpoint**: One URL for all operations
- **Example**:
```javascript
const query = `
  query {
    user(id: "123") {
      name
      email
      posts {
        title
      }
    }
  }
`;

fetch('https://api.example.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});
```

### 3. RPC APIs (Remote Procedure Calls)
- **Function Calls**: Call remote functions directly
- **Types**: JSON-RPC, XML-RPC, gRPC
- **Example**:
```javascript
// JSON-RPC
const request = {
  jsonrpc: "2.0",
  method: "getUserData",
  params: { userId: 123 },
  id: 1
};
```

## 🚀 Transport Methods

### HTTP/HTTPS (Standard Web)
- **Most Common**: Used by REST APIs
- **Stateless**: Each request is independent
- **Methods**: GET, POST, PUT, DELETE, PATCH
- **Pros**: Simple, widely supported, cacheable
- **Cons**: Request-response only, higher latency

### WebSockets
- **Real-time**: Bidirectional communication
- **Persistent Connection**: Stays open for continuous data flow
- **Low Latency**: Perfect for live updates
- **API Integration**: Can work alongside REST APIs
- **Example**:
```javascript
const socket = new WebSocket('wss://api.example.com/live');

socket.onopen = () => {
  socket.send(JSON.stringify({ type: 'subscribe', channel: 'audio-analysis' }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

### Server-Sent Events (SSE)
- **One-way**: Server pushes data to client
- **Automatic Reconnection**: Built-in retry mechanism
- **HTTP-based**: Uses standard HTTP connection
- **Example**:
```javascript
const eventSource = new EventSource('https://api.example.com/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Server update:', data);
};
```

### WebRTC
- **Peer-to-Peer**: Direct browser-to-browser communication
- **Real-time Media**: Audio, video, and data streams
- **Low Latency**: Bypasses servers for media
- **API Integration**: Can be coordinated through REST APIs

### gRPC (Google RPC)
- **High Performance**: Binary protocol, faster than JSON
- **Streaming**: Supports real-time data streams
- **Type Safety**: Strongly typed with protocol buffers
- **Example**:
```javascript
// Protocol buffer definition
service UserService {
  rpc GetUser(UserRequest) returns (UserResponse);
  rpc StreamUpdates(Empty) returns (stream Update);
}
```

### Message Queues (AMQP, MQTT)
- **Asynchronous**: Fire-and-forget messaging
- **Reliable**: Message delivery guarantees
- **Pub/Sub**: Publishers and subscribers pattern
- **API Integration**: Often used behind REST APIs

## 🔐 API Authentication

### 1. API Keys
```javascript
fetch('https://api.example.com/data', {
  headers: { 'X-API-Key': 'your-api-key-here' }
});
```

### 2. Bearer Tokens (JWT)
```javascript
fetch('https://api.example.com/data', {
  headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...' }
});
```

### 3. OAuth 2.0
```javascript
// First get access token, then use it
fetch('https://api.example.com/data', {
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
```

## 📊 API Data Formats

### JSON (Most Common)
```json
{
  "name": "John Doe",
  "age": 30,
  "skills": ["JavaScript", "Python"]
}
```

### XML
```xml
<user>
  <name>John Doe</name>
  <age>30</age>
</user>
```

### Protocol Buffers (Binary)
- Smaller size, faster parsing
- Used with gRPC

---

# 🖥️ Browser vs Server Execution: Understanding Where APIs Run

## The Dual-Environment Challenge

One unique aspect of the Synopticon system is that many of our APIs can run in **two different environments**: in the browser (client-side) and on the server (Node.js). This flexibility is powerful but can be confusing for beginners. Let's break this down with practical examples.

### What Does This Mean?

**Browser Execution (Client-Side)**:
- Code runs directly in the user's web browser
- Has access to camera, microphone, and user interactions
- Processing happens on the user's device
- No data needs to be sent over the network for processing

**Server Execution (Node.js)**:
- Code runs on a remote server or your local machine
- Can process large amounts of data efficiently
- Centralized processing for multiple users
- Better for privacy-sensitive applications

## Example 1: Face Detection API - Two Execution Models

### Browser-Based Face Detection
```javascript
// Running in the browser - processes video in real-time
import { createHybridMediaPipeFacePipeline } from './mediapipe-face-pipeline-hybrid.js';

const pipeline = createHybridMediaPipeFacePipeline({
  confidenceThreshold: 0.7
});

// Get user's camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    const video = document.getElementById('webcam');
    video.srcObject = stream;
    
    // Process each frame locally
    video.addEventListener('loadeddata', () => {
      setInterval(async () => {
        const faces = await pipeline.detectFaces(video);
        updateUI(faces); // Show face rectangles on screen
      }, 100); // 10 FPS processing
    });
  });
```

**When to Use Browser-Based Face Detection:**
- **Interactive Applications**: Real-time face tracking for AR filters, virtual backgrounds
- **Privacy-First**: Face data never leaves the user's device
- **Low Latency**: Immediate processing without network delays
- **Personal Use**: Single-user applications like fitness apps or accessibility tools

### Server-Based Face Detection
```javascript
// Running on Node.js server - processes uploaded images/videos
import { createHybridMediaPipeFacePipeline } from './mediapipe-face-pipeline-hybrid.js';
import express from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'uploads/' });
const pipeline = createHybridMediaPipeFacePipeline({
  confidenceThreshold: 0.8
});

app.post('/api/analyze-faces', upload.single('video'), async (req, res) => {
  try {
    // Process uploaded video file
    const videoPath = req.file.path;
    const faces = await pipeline.processVideo(videoPath);
    
    // Store results in database
    await database.saveFaceAnalysis(faces);
    
    res.json({
      faceCount: faces.length,
      analysisId: generateId(),
      results: faces
    });
  } catch (error) {
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

**When to Use Server-Based Face Detection:**
- **Research Studies**: Analyzing hundreds of participant videos
- **Compliance**: When data must be processed in controlled environments
- **Heavy Processing**: Large video files that would overwhelm browser memory
- **Multi-user Analysis**: Comparing faces across different participants

## Example 2: Speech Analysis API - Choosing the Right Approach

### Browser-Based Speech Analysis
```javascript
// Real-time speech processing in the browser
import { createRealtimeAudioAnalyzer } from './realtime-audio-analyzer.js';
import { createConversationAnalytics } from './conversation-analytics.js';

const audioAnalyzer = createRealtimeAudioAnalyzer({
  sampleRate: 44100,
  features: ['pitch', 'energy', 'mfcc']
});

const analytics = createConversationAnalytics();

// Process speech as user speaks
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    audioAnalyzer.connectAudioStream(stream);
    
    audioAnalyzer.onAnalysis = (features) => {
      // Real-time voice stress detection
      const stressLevel = calculateStress(features.pitch, features.energy);
      
      if (stressLevel > 0.8) {
        showBreathingExercise(); // Immediate user feedback
      }
    };
    
    // Use Web Speech API for transcription
    const recognition = new webkitSpeechRecognition();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      analytics.addChunk({
        text: transcript,
        timestamp: Date.now(),
        features: audioAnalyzer.getLastFeatures()
      });
      
      displayLiveFeedback(analytics.getCurrentSentiment());
    };
  });
```

**When to Use Browser-Based Speech Analysis:**
- **Live Coaching**: Real-time feedback during presentations or therapy
- **Privacy Protection**: Sensitive conversations that shouldn't leave the device
- **Interactive Apps**: Voice-controlled interfaces, meditation apps
- **Personal Training**: Individual skill development with immediate feedback

### Server-Based Speech Analysis
```javascript
// Server processes recorded conversations for research
import { createConversationAnalytics } from './conversation-analytics.js';
import { createAudioPreprocessingPipeline } from './audio-preprocessing-pipeline.js';

const app = express();
const analytics = createConversationAnalytics();
const preprocessor = createAudioPreprocessingPipeline({
  enableNoiseReduction: true,
  enableAGC: true
});

app.post('/api/analyze-conversation', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId, participants, studyType } = req.body;
    
    // Clean up audio quality
    const cleanAudio = await preprocessor.processFile(req.file.path);
    
    // Transcribe using server-side speech recognition
    const transcript = await transcribeAudio(cleanAudio);
    
    // Perform deep analysis
    analytics.startAnalysis(sessionId);
    
    for (const chunk of transcript.segments) {
      analytics.addChunk({
        text: chunk.text,
        timestamp: chunk.start,
        speaker: chunk.speaker,
        confidence: chunk.confidence
      });
    }
    
    const insights = analytics.getInsights();
    
    // Generate research report
    const report = await generateResearchReport({
      sessionId,
      participants,
      studyType,
      insights,
      audioQuality: preprocessor.getStats()
    });
    
    // Store in research database
    await database.saveAnalysis(report);
    
    res.json({
      analysisId: sessionId,
      insights: insights,
      reportUrl: `/reports/${sessionId}.pdf`
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});
```

**When to Use Server-Based Speech Analysis:**
- **Research Studies**: Analyzing hundreds of therapy sessions or interviews
- **Compliance Requirements**: Healthcare data that must stay on approved servers
- **Complex Analysis**: Deep linguistic analysis requiring powerful LLMs
- **Comparative Studies**: Cross-participant analysis and population insights

## Understanding "Headless" Execution

### What Does "Headless" Mean?

**Headless** means running software without a graphical user interface (GUI). In our context:

- **Headless Browser**: Browser APIs running on a server without a visible window
- **Headless Processing**: Audio/video processing without user interaction
- **Headless Analysis**: Batch processing of data without real-time display

### Why Is Headless Useful?

```javascript
// Headless face detection for batch processing
import puppeteer from 'puppeteer';
import { createHybridMediaPipeFacePipeline } from './mediapipe-face-pipeline-hybrid.js';

const processVideosBatch = async (videoFiles) => {
  // Launch headless browser for video processing
  const browser = await puppeteer.launch({ 
    headless: true,  // No visible browser window
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  const pipeline = createHybridMediaPipeFacePipeline();
  
  const results = [];
  
  for (const videoFile of videoFiles) {
    // Load video in headless browser
    await page.goto(`data:text/html,<video id="video" src="${videoFile}" autoplay muted></video>`);
    
    // Process video without displaying it
    const faces = await page.evaluate(async () => {
      const video = document.getElementById('video');
      return await pipeline.processEntireVideo(video);
    });
    
    results.push({
      filename: videoFile,
      faces: faces,
      processedAt: new Date()
    });
  }
  
  await browser.close();
  return results;
};

// Process 100 research participant videos overnight
processVideosBatch(participantVideos)
  .then(results => {
    console.log(`Processed ${results.length} videos`);
    generateResearchReport(results);
  });
```

**Benefits of Headless Processing:**
- **Automation**: Process data without human interaction
- **Efficiency**: No resources wasted on graphics rendering
- **Scalability**: Run multiple instances simultaneously
- **Server Deployment**: Works on servers without displays
- **Batch Processing**: Handle large datasets overnight

## Decision Framework: When to Use Which Approach

### Choose Browser-Based APIs When:
✅ **Real-time interaction** is needed  
✅ **Privacy** is a top concern  
✅ **Low latency** is critical  
✅ **Personal applications** for individual users  
✅ **Live feedback** enhances user experience  

### Choose Server-Based APIs When:
✅ **Heavy computation** is required  
✅ **Data compliance** mandates server processing  
✅ **Batch analysis** of large datasets  
✅ **Research studies** need centralized analysis  
✅ **Cross-user comparisons** are needed  

### Choose Headless Processing When:
✅ **Automation** of repetitive tasks  
✅ **Batch processing** of files  
✅ **Server deployment** without GUI  
✅ **Research pipelines** with large datasets  
✅ **Background processing** during off-hours  

## Hybrid Approaches: Best of Both Worlds

Many research applications benefit from **combining both approaches**:

```javascript
// Hybrid: Real-time browser feedback + Server-based research storage
class HybridSpeechAnalysis {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.browserAnalyzer = createRealtimeAudioAnalyzer();
    this.isRecording = false;
    this.sessionData = [];
  }
  
  startSession(participantId) {
    this.isRecording = true;
    this.sessionData = [];
    
    // Browser: Real-time feedback to participant
    this.browserAnalyzer.onAnalysis = (features) => {
      const feedback = this.generateLiveFeedback(features);
      this.displayToParticipant(feedback);
      
      // Store for later server analysis
      this.sessionData.push({
        timestamp: Date.now(),
        features: features
      });
    };
  }
  
  async endSession() {
    this.isRecording = false;
    
    // Send accumulated data to server for research analysis
    const response = await fetch(`${this.serverUrl}/api/store-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: this.participantId,
        sessionData: this.sessionData,
        timestamp: new Date()
      })
    });
    
    return response.json();
  }
}
```

This hybrid approach gives participants **immediate feedback** while ensuring researchers have **comprehensive data** for later analysis.

---

# 🎯 Synopticon API System

## Current APIs in Our System

### 1. **Speech Analysis API** (`/api/analyze`)
**Function**: Processes audio transcripts using LLM for conversation analysis and insights.

**Input**: Takes text transcripts and analysis configuration parameters as JSON data.
**Output**: Returns structured analysis results including sentiment scores, topics, and conversation insights.
**API Type**: This is a REST API that uses HTTP POST requests where you send data once and get a complete response back immediately.

**Local Connection Example**:
```javascript
const response = await fetch('http://localhost:3000/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transcript: "Hello, how are you today?",
    analysisType: "sentiment"
  })
});
const analysis = await response.json();
```

**Remote Connection Example**:
```javascript
// From a different computer/server connecting to remote Synopticon instance
const response = await fetch('https://synopticon-api.research-lab.edu/api/analyze', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    transcript: "The patient seems more optimistic today...",
    analysisType: "clinical_assessment"
  })
});
const analysis = await response.json();
```

**Research Use Case**: Behavioral researchers can analyze therapy session transcripts to identify emotional patterns, communication effectiveness, and therapeutic progress markers automatically, saving hours of manual coding time.

### 2. **Face Detection Pipeline API** (Internal/MediaPipe)
**Function**: Detects faces and estimates head pose in real-time video streams using MediaPipe.

**Input**: Takes video frame data or image data as binary input along with detection parameters.
**Output**: Returns face coordinates, bounding boxes, confidence scores, and head pose angles for each detected face.
**API Type**: This is an internal library API that processes data directly in your application rather than over a network connection.

**Local Connection Example**:
```javascript
import { createHybridMediaPipeFacePipeline } from './src/pipelines/mediapipe-face-pipeline-hybrid.js';

const pipeline = createHybridMediaPipeFacePipeline({
  modelPath: '/models/face_detection',
  confidenceThreshold: 0.7
});
const faces = await pipeline.detectFaces(videoFrame);
```

**Remote Connection Example**:
```javascript
// Send video frames to remote Synopticon server for face detection
const formData = new FormData();
formData.append('videoFrame', videoBlob);
formData.append('config', JSON.stringify({ confidenceThreshold: 0.7 }));

const response = await fetch('https://synopticon-api.research-lab.edu/api/detect-faces', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-api-token-here' },
  body: formData
});
const faces = await response.json();
```

**Research Use Case**: Human factors researchers studying attention and engagement can automatically track where participants are looking during interface testing, measuring visual attention patterns without intrusive eye-tracking hardware.

### 3. **Real-time Audio Analysis API** (Audio Analyzer)
**Function**: Extracts audio features like pitch, MFCC, formants, and spectral characteristics from live audio streams.

**Input**: Receives live audio stream data or audio buffer chunks with sample rate and configuration settings.
**Output**: Provides continuous stream of audio features including pitch values, MFCC coefficients, formant frequencies, and spectral analysis data.
**API Type**: This is a persistent connection API that maintains a continuous audio stream and provides real-time analysis results as data flows through.

**Local Connection Example**:
```javascript
import { createRealtimeAudioAnalyzer } from './src/audio/realtime-audio-analyzer.js';

const analyzer = createRealtimeAudioAnalyzer({
  sampleRate: 44100,
  frameSize: 1024
});

navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => analyzer.connectAudioStream(stream));
```

**Remote Connection Example**:
```javascript
// Connect to remote Synopticon server via WebSocket for real-time audio analysis
const socket = new WebSocket('wss://synopticon-api.research-lab.edu/audio-analysis');

socket.onopen = () => {
  socket.send(JSON.stringify({ 
    action: 'start_analysis',
    config: { sampleRate: 44100, features: ['pitch', 'mfcc', 'formants'] }
  }));
  
  // Stream audio data
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const audioContext = new AudioContext();
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        socket.send(audioData.buffer);
      };
    });
};

socket.onmessage = (event) => {
  const analysis = JSON.parse(event.data);
  console.log('Audio features:', analysis);
};
```

**Research Use Case**: Speech pathologists and behavioral researchers can objectively measure vocal stress, emotional state, and speech clarity in real-time during interviews or therapy sessions, providing quantitative data for treatment effectiveness.

### 4. **Voice Activity Detection API** (VAD)
**Function**: Automatically detects when speech is present versus silence using multiple algorithms with consensus voting.

**Input**: Takes audio stream data with configuration parameters for detection sensitivity and algorithm weights.
**Output**: Returns real-time voice activity events with timestamps, confidence scores, and speech/silence classifications.
**API Type**: This is an event-driven API that maintains a persistent connection and sends callbacks when voice activity changes occur.

**Local Connection Example**:
```javascript
import { createWebAudioVAD } from './src/audio/voice-activity-detection.js';

const vad = createWebAudioVAD({
  onVoiceStart: (result) => console.log('Speech detected:', result.confidence),
  onVoiceEnd: (result) => console.log('Silence detected'),
  consensusThreshold: 0.6
});

await vad.initialize(audioStream);
vad.start();
```

**Remote Connection Example**:
```javascript
// Connect to remote VAD service via WebSocket
const socket = new WebSocket('wss://synopticon-api.research-lab.edu/vad');

socket.onopen = () => {
  socket.send(JSON.stringify({
    action: 'configure',
    config: {
      consensusThreshold: 0.6,
      energyWeight: 0.5,
      zcrWeight: 0.3
    }
  }));
};

// Stream audio and receive VAD events
socket.onmessage = (event) => {
  const vadResult = JSON.parse(event.data);
  if (vadResult.type === 'voice_start') {
    console.log('Speech detected at:', vadResult.timestamp);
  } else if (vadResult.type === 'voice_end') {
    console.log('Silence detected at:', vadResult.timestamp);
  }
};

// Send audio data
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    // Process and send audio chunks to WebSocket
  });
```

**Research Use Case**: Conversation analysts and social psychologists can automatically segment recordings into speaking turns, measure silence patterns, and analyze turn-taking behavior without manual annotation, enabling large-scale discourse analysis studies.

### 5. **Audio Quality Metrics API** (Quality Analyzer)
**Function**: Measures audio quality using SNR, THD, clipping detection, and provides quality scores with improvement recommendations.

**Input**: Receives audio buffer data along with frequency domain data (FFT) and configuration parameters for quality thresholds.
**Output**: Returns quality scores (0-100), detailed metrics (SNR, THD, clipping), quality level classifications, and actionable improvement recommendations.
**API Type**: This is a monitoring API that provides both on-demand quality analysis and continuous monitoring with alert callbacks.

**Local Connection Example**:
```javascript
import { createRealTimeQualityMonitor } from './src/audio/audio-quality-metrics.js';

const monitor = createRealTimeQualityMonitor({
  onQualityAlert: (result) => console.log('Poor audio quality:', result.recommendations),
  qualityAlertThreshold: 30
});

monitor.startMonitoring();
const quality = monitor.processFrame(audioBuffer, fftData);
```

**Remote Connection Example**:
```javascript
// Send audio samples to remote quality monitoring service
const response = await fetch('https://synopticon-api.research-lab.edu/api/audio-quality', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    audioSamples: Array.from(audioBuffer),
    sampleRate: 44100,
    thresholds: {
      excellent: 85,
      good: 70,
      fair: 50
    }
  })
});

const qualityReport = await response.json();
console.log('Quality score:', qualityReport.overallQuality);
console.log('Recommendations:', qualityReport.recommendations);
```

**Research Use Case**: Field researchers conducting remote interviews or surveys can ensure consistent audio quality across participants, automatically flagging sessions that need re-recording and maintaining data reliability for acoustic analysis studies.

### 6. **Audio Preprocessing Pipeline API** (Preprocessing)
**Function**: Applies noise reduction, automatic gain control, and high-pass filtering to enhance audio quality before analysis.

**Input**: Takes raw audio buffer data along with processing configuration specifying which filters to apply and their parameters.
**Output**: Returns cleaned audio data with applied enhancements, processing statistics, and quality improvement metrics.
**API Type**: This is a data processing API that transforms input audio synchronously and returns enhanced results immediately.

**Local Connection Example**:
```javascript
import { createAudioPreprocessingPipeline } from './src/audio/audio-preprocessing-pipeline.js';

const preprocessor = createAudioPreprocessingPipeline({
  enableNoiseReduction: true,
  enableAGC: true,
  processingOrder: ['highpass', 'denoise', 'agc']
});

const result = preprocessor.processFrame(rawAudioBuffer, isQuietSegment);
const cleanAudio = result.processedAudio;
```

**Remote Connection Example**:
```javascript
// Send raw audio to remote preprocessing service
const formData = new FormData();
formData.append('audioData', new Blob([rawAudioBuffer]), 'audio.raw');
formData.append('config', JSON.stringify({
  enableNoiseReduction: true,
  enableAGC: true,
  processingOrder: ['highpass', 'denoise', 'agc'],
  sampleRate: 44100
}));

const response = await fetch('https://synopticon-api.research-lab.edu/api/preprocess-audio', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-api-token-here' },
  body: formData
});

const preprocessedResult = await response.json();
const cleanAudio = preprocessedResult.processedAudio;
const improvements = preprocessedResult.qualityMetrics;
```

**Research Use Case**: Researchers collecting data in uncontrolled environments (homes, offices, public spaces) can automatically clean audio recordings to ensure consistent analysis quality, removing environmental noise and normalizing volume levels across different recording conditions.

### 7. **Memory Pool Management API** (Enhanced Memory Pool)
**Function**: Optimizes memory usage through object pooling and reuse, achieving 95%+ efficiency for high-frequency audio/video processing.

**Input**: Takes object type requests and configuration parameters for pool sizes, cleanup intervals, and memory limits.
**Output**: Provides reusable objects from pools, memory usage statistics, efficiency metrics, and performance monitoring data.
**API Type**: This is a resource management API that maintains object pools internally and provides synchronous object allocation/deallocation services.

**Local Connection Example**:
```javascript
import { createEnhancedMemoryPool } from './src/utils/enhanced-memory-pool.js';

const pool = createEnhancedMemoryPool({ maxPoolSize: 1000 });
pool.initialize();

const faceResult = pool.acquire('FaceResult');
// Use object...
pool.release(faceResult); // Returns to pool for reuse
```

**Remote Connection Example**:
```javascript
// Query remote memory pool statistics and configure pool settings
const response = await fetch('https://synopticon-api.research-lab.edu/api/memory-pool', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer your-api-token-here' }
});
const poolStats = await response.json();
console.log('Memory efficiency:', poolStats.efficiency);

// Configure pool settings remotely
await fetch('https://synopticon-api.research-lab.edu/api/memory-pool/config', {
  method: 'PUT',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    maxPoolSize: 2000,
    cleanupInterval: 30000,
    enableMetrics: true
  })
});
```

**Research Use Case**: Large-scale behavioral studies processing thousands of hours of video/audio data can maintain stable memory usage and processing speed, enabling long-running analysis sessions without performance degradation or system crashes.

### 8. **Conversation Analytics API** (Analytics Engine)
**Function**: Analyzes conversation patterns, sentiment trends, topic extraction, and engagement metrics from processed speech data.

**Input**: Takes conversation text chunks with speaker identifiers, timestamps, and analysis configuration parameters.
**Output**: Returns comprehensive analytics including sentiment scores, topic clusters, engagement metrics, conversation flow patterns, and insights summaries.
**API Type**: This is a stateful analytics API that accumulates conversation data over time and provides both real-time updates and session-based analysis results.

**Local Connection Example**:
```javascript
import { createConversationAnalytics } from './src/speech-analysis/conversation-analytics.js';

const analytics = createConversationAnalytics();
analytics.startAnalysis();

analytics.addChunk({
  text: "I'm feeling much better today",
  timestamp: Date.now(),
  speaker: "participant_1"
});

const insights = analytics.getInsights();
```

**Remote Connection Example**:
```javascript
// Start a new conversation analysis session remotely
const sessionResponse = await fetch('https://synopticon-api.research-lab.edu/api/conversation-analytics/session', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    sessionId: 'therapy-session-001',
    participants: ['therapist', 'client'],
    analysisTypes: ['sentiment', 'topics', 'engagement']
  })
});
const session = await sessionResponse.json();

// Add conversation chunks to the session
await fetch(`https://synopticon-api.research-lab.edu/api/conversation-analytics/session/${session.sessionId}/chunk`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    text: "I'm feeling much better about this situation now",
    timestamp: Date.now(),
    speaker: "client"
  })
});

// Get real-time insights
const insights = await fetch(`https://synopticon-api.research-lab.edu/api/conversation-analytics/session/${session.sessionId}/insights`);
const analyticsResult = await insights.json();
```

**Research Use Case**: Clinical researchers studying therapeutic conversations can automatically track mood changes, topic shifts, and engagement levels throughout treatment sessions, identifying effective intervention moments and measuring therapeutic alliance development over time.

### 9. **Neon Eye Tracker API** (Eye Tracking System)
**Function**: Provides complete control and streaming capabilities for Pupil Labs Neon eye tracker devices including device discovery, calibration, and real-time gaze data streaming.

**Input**: Takes device connection parameters, calibration settings, recording configurations, and streaming preferences for eye tracking sessions.
**Output**: Returns real-time gaze coordinates (200Hz), device status information, calibration results, session management data, and behavioral analysis metrics.
**API Type**: This is a comprehensive device control API that combines REST endpoints for device management with persistent WebSocket connections for real-time gaze streaming.

**Local Connection Example**:
```javascript
import { createEyeTracker } from './src/eye-tracking/index.js';

const eyeTracker = createEyeTracker();

// Initialize system and discover devices
await eyeTracker.initialize();
const devices = await eyeTracker.discoverDevices();
await eyeTracker.connectToDevice(devices[0].id);

// Start real-time gaze streaming
eyeTracker.onGazeData((gazeData) => {
  console.log('Gaze position:', gazeData.x, gazeData.y);
  console.log('Confidence:', gazeData.confidence);
  console.log('Semantic data:', gazeData.semantics);
});

// Start recording session
await eyeTracker.startRecording(devices[0].id, { 
  experimentId: 'attention_study_001',
  participantId: 'P001'
});
```

**Remote Connection Example**:
```javascript
// Connect to remote Neon eye tracker service
const response = await fetch('https://synopticon-api.research-lab.edu/api/eye-tracker/discover', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer your-api-token-here' }
});
const devices = await response.json();

// Connect to first available device
await fetch('https://synopticon-api.research-lab.edu/api/eye-tracker/connect', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({ deviceId: devices[0].id })
});

// Start real-time streaming via WebSocket
const socket = new WebSocket('wss://synopticon-api.research-lab.edu/eye-tracker/stream');
socket.onopen = () => {
  socket.send(JSON.stringify({
    action: 'subscribe',
    deviceId: devices[0].id,
    streamTypes: ['gaze', 'eye_state', 'imu']
  }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'gaze') {
    console.log('Real-time gaze:', data.x, data.y, data.confidence);
  }
};

// Start recording session remotely
await fetch('https://synopticon-api.research-lab.edu/api/eye-tracker/recording/start', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    deviceId: devices[0].id,
    config: {
      experimentId: 'remote_study_001',
      sampleRate: 200,
      duration: 300000 // 5 minutes
    }
  })
});
```

**Research Use Case**: Vision researchers and human factors specialists can precisely track eye movements during reading tasks, interface interactions, or decision-making scenarios, measuring attention patterns, cognitive load, and visual search strategies with sub-degree accuracy at 200Hz sampling rate for detailed temporal analysis.

### 10. **Speaker Diarization API** (Speaker Identification System)
**Function**: Automatically identifies and segments different speakers in multi-speaker conversations using voice fingerprinting and speaker change detection algorithms.

**Input**: Takes audio buffer data with configuration for MFCC feature extraction, fingerprint similarity thresholds, and minimum speaker duration parameters.
**Output**: Returns speaker segment information with speaker IDs, confidence scores, time boundaries, voice fingerprints, and speaker change detection events.
**API Type**: This is a real-time processing API that maintains speaker models and provides both frame-by-frame speaker identification and segment-based diarization results.

**Local Connection Example**:
```javascript
import { createSpeakerDiarization } from './src/audio/speaker-diarization.js';

const diarization = createSpeakerDiarization({
  enableVoiceFingerprinting: true,
  enableChangeDetection: true,
  minSpeakerDuration: 2000 // ms
});

// Process audio frames
const result = diarization.processFrame(audioBuffer, timestamp);

if (result.speakerChanged) {
  console.log('New speaker detected:', result.speakerId);
  console.log('Confidence:', result.confidence);
}

// Get all speaker segments
const segments = diarization.getSegments();
const speakerInfo = diarization.getSpeakerInfo();

// Release result back to memory pool
diarization.releaseResult(result);
```

**Remote Connection Example**:
```javascript
// Start diarization session on remote server
const sessionResponse = await fetch('https://synopticon-api.research-lab.edu/api/speaker-diarization/session', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    sessionId: 'meeting_001',
    config: {
      minSpeakerDuration: 3000,
      mfccCoefficients: 13,
      updateThreshold: 0.8
    }
  })
});
const session = await sessionResponse.json();

// Stream audio for real-time diarization via WebSocket
const socket = new WebSocket('wss://synopticon-api.research-lab.edu/speaker-diarization/stream');
socket.onopen = () => {
  socket.send(JSON.stringify({ 
    action: 'start_diarization',
    sessionId: session.sessionId 
  }));
};

socket.onmessage = (event) => {
  const diarizationResult = JSON.parse(event.data);
  if (diarizationResult.speakerChanged) {
    console.log('Speaker change:', diarizationResult.speakerId);
    updateSpeakerUI(diarizationResult);
  }
};

// Send audio data chunks
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    // Process and send audio chunks to WebSocket
  });
```

**Research Use Case**: Conversation analysts and meeting researchers can automatically identify individual speakers in group discussions, enabling analysis of speaking time distribution, turn-taking patterns, and individual contribution metrics without manual speaker labeling, essential for workplace collaboration studies and therapeutic group session analysis.

### 11. **Emotion Detection API** (Voice Emotion Analysis)
**Function**: Analyzes emotional states from speech using prosodic feature extraction and emotion classification with support for both categorical emotions and dimensional arousal-valence models.

**Input**: Takes audio buffer data and extracts prosodic features including pitch, energy, timing, and spectral characteristics for emotion analysis.
**Output**: Returns detected emotions (happy, sad, angry, fearful, surprised, neutral), confidence scores, arousal-valence coordinates, and detailed prosodic feature measurements.
**API Type**: This is a continuous analysis API that processes audio frames in real-time and provides both immediate emotion detection and temporal emotion tracking over conversation timelines.

**Local Connection Example**:
```javascript
import { createEmotionDetection } from './src/audio/emotion-detection.js';

const emotionDetector = createEmotionDetection({
  emotionUpdateInterval: 500, // ms
  emotions: ['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised'],
  useArousalValence: true
});

// Process audio frames for emotion detection
const result = emotionDetector.processFrame(audioBuffer, timestamp);

if (result) {
  console.log('Detected emotion:', result.emotion);
  console.log('Confidence:', result.confidence);
  console.log('Arousal:', result.arousal, 'Valence:', result.valence);
  console.log('Prosodic features:', result.prosodicFeatures);
  
  // Release result back to memory pool
  emotionDetector.releaseResult(result);
}

// Get current emotion state
const currentEmotion = emotionDetector.getCurrentEmotion();

// Get emotion timeline over last 30 seconds
const emotionTimeline = emotionDetector.getEmotionTimeline(30000);
```

**Remote Connection Example**:
```javascript
// Start emotion analysis session
const response = await fetch('https://synopticon-api.research-lab.edu/api/emotion-detection/analyze', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-token-here'
  },
  body: JSON.stringify({
    sessionId: 'therapy_session_001',
    config: {
      emotionUpdateInterval: 1000,
      confidenceThreshold: 0.7,
      useArousalValence: true
    }
  })
});
const analysisSession = await response.json();

// Connect to real-time emotion streaming
const socket = new WebSocket('wss://synopticon-api.research-lab.edu/emotion-detection/stream');
socket.onopen = () => {
  socket.send(JSON.stringify({
    action: 'subscribe_emotions',
    sessionId: analysisSession.sessionId,
    streamTypes: ['emotions', 'prosodics', 'timeline']
  }));
};

socket.onmessage = (event) => {
  const emotionData = JSON.parse(event.data);
  if (emotionData.type === 'emotion_update') {
    console.log('Real-time emotion:', emotionData.emotion, emotionData.confidence);
    updateEmotionVisualization(emotionData);
  }
};

// Get emotion timeline analysis
const timeline = await fetch(`https://synopticon-api.research-lab.edu/api/emotion-detection/timeline/${analysisSession.sessionId}?window=60000`);
const emotionTimeline = await timeline.json();
```

**Research Use Case**: Clinical psychologists and behavioral researchers can objectively measure emotional states during therapy sessions, interviews, or experimental tasks, providing quantitative emotion data for treatment effectiveness assessment, stress level monitoring, and emotional response studies in human-computer interaction research.

### 12. **Synopticon API Server** (Complete HTTP API Server)
**Function**: Provides a comprehensive HTTP API server that exposes all Synopticon functionality through RESTful endpoints with authentication, rate limiting, and multi-client support.

**Input**: Takes HTTP requests with JSON payloads for various analysis tasks, file uploads for batch processing, and WebSocket connections for real-time streaming.
**Output**: Returns structured JSON responses with analysis results, status information, session management data, and real-time streaming capabilities.
**API Type**: This is a full-featured HTTP REST API server with WebSocket support that provides centralized access to all Synopticon analysis capabilities with production-ready features.

**Local Connection Example**:
```javascript
import { createSynopticonAPIServer } from './src/api/server.js';

// Create and start the API server
const server = createSynopticonAPIServer({
  port: 3000,
  enableAuth: true,
  enableRateLimit: true,
  maxClients: 100,
  enableWebSocket: true
});

await server.start();
console.log('Synopticon API Server running on http://localhost:3000');

// Server provides endpoints:
// POST /api/analyze - Speech analysis
// POST /api/face/detect - Face detection
// POST /api/audio/quality - Audio quality analysis  
// POST /api/speaker/diarize - Speaker diarization
// POST /api/emotion/detect - Emotion detection
// WebSocket /ws - Real-time streaming
```

**Remote Connection Example**:
```javascript
// Connect to remote Synopticon API server
const apiBase = 'https://synopticon-api.research-lab.edu';

// Authenticate and get access token
const authResponse = await fetch(`${apiBase}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'researcher@university.edu',
    password: 'secure_password',
    project: 'behavioral_study_2025'
  })
});
const auth = await authResponse.json();

// Use multiple API endpoints
const analysisPromises = [
  // Face detection
  fetch(`${apiBase}/api/face/detect`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imageData: base64Image })
  }),
  
  // Speech analysis
  fetch(`${apiBase}/api/analyze`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      transcript: "The participant seems engaged today",
      analysisType: "clinical_assessment"
    })
  }),
  
  // Audio quality check
  fetch(`${apiBase}/api/audio/quality`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      audioSamples: audioDataArray,
      sampleRate: 44100
    })
  })
];

const results = await Promise.all(analysisPromises);
```

**Research Use Case**: Research institutions can deploy centralized Synopticon analysis services accessible to multiple research teams, enabling collaborative behavioral studies with standardized analysis pipelines, centralized data management, and scalable processing for large-scale multi-site research projects.

## 🌐 WebSocket Integration Opportunities

### Current WebSocket Potential:
Our system could benefit from WebSocket integration for:

1. **Real-time Audio Streaming**: Stream live audio analysis results to dashboards
2. **Live Face Detection Updates**: Push face detection coordinates in real-time
3. **Quality Monitoring Alerts**: Instant notifications when audio quality drops
4. **Conversation Analytics**: Live conversation insights during ongoing sessions

### Example WebSocket Implementation:
```javascript
// Server-side WebSocket for real-time updates
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  // Subscribe to real-time audio analysis
  audioAnalyzer.onAnalysisUpdate((result) => {
    ws.send(JSON.stringify({
      type: 'audio_analysis',
      data: result
    }));
  });
  
  // Subscribe to face detection updates
  faceDetector.onFaceUpdate((faces) => {
    ws.send(JSON.stringify({
      type: 'face_detection',
      data: faces
    }));
  });
});

// Client-side connection
const socket = new WebSocket('ws://localhost:8080');
socket.onmessage = (event) => {
  const update = JSON.parse(event.data);
  if (update.type === 'audio_analysis') {
    updateAudioVisualization(update.data);
  }
};
```

### Complementary Transport Methods:

1. **Server-Sent Events**: For one-way updates (quality alerts, analysis results)
2. **WebRTC**: For peer-to-peer audio/video streaming between research participants
3. **MQTT**: For IoT sensor integration (heart rate, galvanic skin response)
4. **gRPC Streaming**: For high-performance, low-latency audio feature streaming

Our system's architecture supports hybrid transport methods, allowing researchers to choose the best communication method for their specific use case while maintaining consistent API interfaces.