# Synopticon API - Pipelines & APIs Reference

**synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization**

## 🔧 **Available Pipelines (6)**

### **1. BlazeFace Pipeline** (`blazeface-pipeline.js`)
**Description**: TensorFlow.js BlazeFace model for fast real-time face detection and landmarks
**Capabilities**: Face detection, 3DOF pose estimation, basic facial landmarks
**Performance**: 60 FPS, 10-20ms latency, 1.2MB model size

### **2. MediaPipe Face Mesh Pipeline** (`mediapipe-pipeline.js`)  
**Description**: MediaPipe Face Mesh with 468 landmarks and 6DOF pose estimation
**Capabilities**: 468-point landmarks, 6DOF pose, eye tracking integration
**Performance**: 30 FPS, 30-50ms latency, 11MB model size

### **3. Eye Tracking Pipeline** (`eye-tracking-pipeline.js`)
**Description**: Pupil Labs Neon hardware integration with calibration and recording capabilities
**Capabilities**: Hardware eye tracking, device control, calibration, recording sessions
**Performance**: 30 FPS, 5-15ms latency, no model (hardware-based)

### **4. Iris Tracking Pipeline** (`iris-tracking-pipeline.js`)
**Description**: MediaPipe Iris for high-precision eye tracking and gaze estimation
**Capabilities**: Iris detection, precise gaze vectors, eye openness analysis
**Performance**: 30 FPS, 25-40ms latency, 3MB model size

### **5. Emotion Analysis Pipeline** (`emotion-analysis-pipeline.js`)
**Description**: Custom CNN for 7-emotion classification with valence arousal analysis
**Capabilities**: 7 emotions (happy, sad, angry, fearful, disgusted, surprised, neutral)
**Performance**: 30 FPS, 15-25ms latency, 2.5MB model size

### **6. Age Estimation Pipeline** (`age-estimation-pipeline.js`)
**Description**: Facial feature analysis for age estimation and gender detection
**Capabilities**: Age estimation with confidence ranges, gender classification, age categories
**Performance**: 25 FPS, 20-35ms latency, 1.8MB model size

---

## 🌐 **API Endpoints (9)**

### **System Management**

#### **1. Health Check** - `GET /api/health`
**Description**: System health check with pipeline status and performance metrics
**Response**: Health status, pipeline availability, system metrics, uptime information

#### **2. Configuration Info** - `GET /api/config`
**Description**: Current system configuration and available capabilities
**Response**: Active pipelines, supported capabilities, configuration parameters, version info

#### **3. Pipeline Listing** - `GET /api/pipelines`
**Description**: List all available analysis pipelines with capabilities
**Response**: Pipeline details, capability matrix, performance profiles, availability status

#### **4. Strategy Listing** - `GET /api/strategies`
**Description**: Available processing strategies and configurations
**Response**: Strategy types (performance_first, accuracy_first, hybrid), optimization settings

### **Analysis Processing**

#### **5. Single Image Detection** - `POST /api/v1/detect`
**Description**: Single image face detection and analysis
**Input**: Image data (base64/binary), capability requirements, processing options
**Response**: Face detection results, analysis data, processing metrics

#### **6. Batch Processing** - `POST /api/v1/batch`
**Description**: Batch processing for multiple images with optimized throughput
**Input**: Array of images, shared processing requirements, batch options
**Response**: Array of analysis results, batch processing metrics, error handling

#### **7. Frame Processing** - `POST /api/process`
**Description**: Process frame through configured pipeline combination
**Input**: Frame data, capability requirements, strategy selection
**Response**: Multi-modal analysis results, orchestration metadata, performance data

### **Configuration & Management**

#### **8. Orchestrator Configuration** - `POST /api/configure`
**Description**: Configure orchestrator with analysis requirements and strategy
**Input**: Analysis requirements, processing strategy, pipeline preferences
**Response**: Configuration confirmation, applied settings, pipeline selection results

#### **9. Pipeline Registration** - `POST /api/pipelines/register`
**Description**: Register new pipeline with orchestrator for dynamic loading
**Input**: Pipeline factory function, capability definitions, performance profile
**Response**: Registration status, pipeline ID, integration confirmation

---

## 📋 **Quick Reference**

### **Pipeline Import Paths**
```javascript
import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';
import { createMediaPipeFaceMeshPipeline } from './src/pipelines/mediapipe-pipeline.js';  
import { createEyeTrackingPipeline } from './src/pipelines/eye-tracking-pipeline.js';
import { createIrisTrackingPipeline } from './src/pipelines/iris-tracking-pipeline.js';
import { createEmotionAnalysisPipeline } from './src/pipelines/emotion-analysis-pipeline.js';
import { createAgeEstimationPipeline } from './src/pipelines/age-estimation-pipeline.js';
```

### **API Base URLs**
```javascript
// Local development
const API_BASE = 'http://localhost:3001/api';

// Production endpoints
GET    /api/health          // System health
GET    /api/config          // Configuration  
GET    /api/pipelines       // Available pipelines
GET    /api/strategies      // Processing strategies
POST   /api/v1/detect       // Single detection
POST   /api/v1/batch        // Batch processing
POST   /api/process         // Frame processing
POST   /api/configure       // Configure system
POST   /api/pipelines/register // Register pipeline
```

### **Capability Types**
```javascript
import { Capability } from './src/core/types.js';

// Available capabilities
Capability.FACE_DETECTION      // Face detection
Capability.LANDMARK_DETECTION  // Facial landmarks
Capability.POSE_ESTIMATION_3DOF // 3DOF head pose
Capability.POSE_ESTIMATION_6DOF // 6DOF head pose  
Capability.EYE_TRACKING        // Eye tracking
Capability.GAZE_ESTIMATION     // Gaze direction
Capability.EXPRESSION_ANALYSIS // Emotion detection
Capability.AGE_ESTIMATION      // Age estimation
Capability.GENDER_DETECTION    // Gender classification
Capability.DEVICE_CONTROL      // Hardware control
```

---

**Total**: 6 Production-Ready Pipelines + 9 RESTful API Endpoints  
**Status**: ✅ All systems operational and documented  
**Last Updated**: 2025-01-23