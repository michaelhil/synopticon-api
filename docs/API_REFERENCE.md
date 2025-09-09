# Synopticon API Reference

## Overview

The Synopticon API is a comprehensive multi-modal behavioral analysis platform built with Bun.js and TypeScript. It provides real-time processing capabilities for face detection, emotion analysis, eye tracking, speech analysis, and cognitive advisory systems.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API operates without authentication in development mode. Production deployments should implement proper API key management.

## Core Endpoints

### System Status

#### GET /api/health
Returns system health and status information.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.6.2",
  "timestamp": 1725880800000,
  "uptime": 3600,
  "components": {
    "face_detection": "active",
    "emotion_analysis": "active",
    "eye_tracking": "active",
    "speech_analysis": "active",
    "cognitive_advisory": "active"
  }
}
```

#### GET /api/system/stats
Returns detailed system statistics and performance metrics.

**Response:**
```json
{
  "memory": {
    "used": "45.2MB",
    "available": "512MB",
    "pressure": 0.12
  },
  "processing": {
    "active_sessions": 3,
    "requests_per_second": 15.7,
    "average_latency": "23ms"
  },
  "features": {
    "face_detection": {
      "active": true,
      "processed_frames": 1234,
      "average_fps": 30
    },
    "emotion_analysis": {
      "active": true,
      "confidence_threshold": 0.7,
      "processed_emotions": 567
    }
  }
}
```

### Face Detection

#### POST /api/analysis/face-detection
Processes image data for face detection and returns detected faces with landmarks.

**Request Body:**
```json
{
  "image": "base64_encoded_image_data",
  "options": {
    "detect_landmarks": true,
    "confidence_threshold": 0.5,
    "max_faces": 10
  }
}
```

**Response:**
```json
{
  "faces": [
    {
      "id": "face_001",
      "confidence": 0.95,
      "bounding_box": {
        "x": 100,
        "y": 150,
        "width": 120,
        "height": 140
      },
      "landmarks": [
        {"x": 140, "y": 180, "type": "left_eye"},
        {"x": 160, "y": 180, "type": "right_eye"},
        {"x": 150, "y": 190, "type": "nose"},
        {"x": 150, "y": 200, "type": "mouth"}
      ],
      "pose": {
        "yaw": -5.2,
        "pitch": 2.1,
        "roll": 0.8
      }
    }
  ],
  "processing_time_ms": 45,
  "timestamp": 1725880800000
}
```

### Emotion Analysis

#### POST /api/analysis/emotion
Analyzes facial expressions for emotion recognition.

**Request Body:**
```json
{
  "image": "base64_encoded_image_data",
  "faces": [
    {
      "bounding_box": {
        "x": 100, "y": 150, "width": 120, "height": 140
      }
    }
  ],
  "options": {
    "confidence_threshold": 0.6,
    "enable_valence_arousal": true
  }
}
```

**Response:**
```json
{
  "emotions": [
    {
      "face_id": "face_001",
      "primary_emotion": "happiness",
      "confidence": 0.87,
      "emotion_scores": {
        "happiness": 0.87,
        "neutral": 0.08,
        "surprise": 0.03,
        "sadness": 0.01,
        "anger": 0.01,
        "fear": 0.00,
        "disgust": 0.00
      },
      "valence": 0.75,
      "arousal": 0.62,
      "dominance": 0.68
    }
  ],
  "processing_time_ms": 32,
  "timestamp": 1725880800000
}
```

### Eye Tracking

#### GET /api/eye-tracking/devices
Lists available eye tracking devices.

**Response:**
```json
{
  "devices": [
    {
      "id": "tobii5_001",
      "name": "Tobii Eye Tracker 5",
      "type": "tobii-5",
      "status": "connected",
      "capabilities": [
        "gaze-tracking",
        "head-tracking",
        "presence-detection"
      ],
      "sampling_rate": 120
    }
  ]
}
```

#### POST /api/eye-tracking/start-session
Starts an eye tracking session.

**Request Body:**
```json
{
  "device_id": "tobii5_001",
  "session_config": {
    "sampling_rate": 120,
    "calibration_points": 9,
    "record_data": true
  }
}
```

**Response:**
```json
{
  "session_id": "et_session_001",
  "status": "active",
  "device_id": "tobii5_001",
  "calibration_required": true,
  "websocket_url": "ws://localhost:3000/ws"
}
```

### Speech Analysis

#### POST /api/analysis/speech
Processes audio data for speech analysis including emotion detection and quality assessment.

**Request Body:**
```json
{
  "audio": "base64_encoded_audio_data",
  "options": {
    "enable_emotion_detection": true,
    "enable_pace_analysis": true,
    "enable_quality_assessment": true,
    "language": "en-US"
  }
}
```

**Response:**
```json
{
  "transcript": "Hello, how are you doing today?",
  "confidence": 0.92,
  "emotions": {
    "primary": "neutral",
    "scores": {
      "neutral": 0.68,
      "happiness": 0.25,
      "curiosity": 0.07
    }
  },
  "pace_analysis": {
    "words_per_minute": 165,
    "speaking_rate": "normal",
    "pause_frequency": 0.15,
    "fluency_score": 0.89
  },
  "quality_metrics": {
    "clarity": 0.85,
    "volume": 0.72,
    "background_noise": 0.12,
    "signal_to_noise_ratio": 18.5
  }
}
```

### Cognitive Advisory

#### POST /api/cognitive/advisory
Generates AI-powered recommendations based on multi-modal analysis.

**Request Body:**
```json
{
  "context": {
    "scenario": "flight_training",
    "current_state": {
      "attention_level": 0.75,
      "stress_level": 0.45,
      "workload": 0.62
    },
    "sensor_data": {
      "gaze_pattern": "scanning",
      "speech_clarity": 0.88,
      "facial_expression": "focused"
    }
  },
  "advisory_level": "tactical"
}
```

**Response:**
```json
{
  "advisory": {
    "level": "tactical",
    "confidence": 0.89,
    "recommendations": [
      "Consider reducing information density on primary display",
      "Attention scan pattern indicates good situational awareness",
      "Speech clarity suggests clear communication capability"
    ],
    "risk_factors": [
      "Moderate stress level detected - monitor for escalation"
    ],
    "action_items": [
      "Continue current approach",
      "Monitor stress indicators"
    ]
  },
  "processing_time_ms": 67,
  "timestamp": 1725880800000
}
```

### Media Streaming

#### GET /api/media/devices
Lists available media capture devices.

**Response:**
```json
{
  "devices": [
    {
      "id": "camera_001",
      "name": "USB Camera",
      "type": "video",
      "supported_resolutions": [
        {"width": 1920, "height": 1080, "fps": 30},
        {"width": 1280, "height": 720, "fps": 60}
      ],
      "status": "available"
    }
  ]
}
```

#### POST /api/media/start-stream
Starts a media streaming session.

**Request Body:**
```json
{
  "device_id": "camera_001",
  "stream_config": {
    "resolution": {"width": 1280, "height": 720},
    "fps": 30,
    "quality": "high",
    "enable_analysis": true
  }
}
```

## WebSocket API

### Connection

Connect to: `ws://localhost:3000/ws`

### Message Format

All WebSocket messages follow this structure:

```json
{
  "type": "message_type",
  "data": {},
  "timestamp": 1725880800000,
  "session_id": "session_001"
}
```

### Real-time Face Detection

**Subscribe:**
```json
{
  "type": "subscribe",
  "channel": "face_detection",
  "options": {
    "confidence_threshold": 0.5
  }
}
```

**Data Stream:**
```json
{
  "type": "face_detection",
  "data": {
    "faces": [...],
    "frame_id": "frame_001"
  },
  "timestamp": 1725880800000
}
```

### Real-time Eye Tracking

**Subscribe:**
```json
{
  "type": "subscribe",
  "channel": "eye_tracking",
  "device_id": "tobii5_001"
}
```

**Data Stream:**
```json
{
  "type": "gaze_data",
  "data": {
    "gaze_point": {"x": 0.5, "y": 0.3},
    "confidence": 0.95,
    "head_pose": {"yaw": -2.1, "pitch": 5.3, "roll": 0.8},
    "pupil_diameter": {"left": 3.2, "right": 3.1}
  },
  "timestamp": 1725880800000
}
```

## Error Handling

All API endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid image format provided",
    "details": {
      "field": "image",
      "expected": "base64 encoded image data"
    }
  },
  "timestamp": 1725880800000
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid input parameters
- `PROCESSING_ERROR`: Error during analysis processing
- `DEVICE_ERROR`: Hardware device unavailable or error
- `RESOURCE_ERROR`: Insufficient system resources
- `TIMEOUT_ERROR`: Processing timeout exceeded
- `INTERNAL_ERROR`: Unexpected server error

## Rate Limiting

The API implements adaptive rate limiting:
- Default: 100 requests per minute per IP
- Burst allowance: 20 requests in 10 seconds
- WebSocket connections: 10 concurrent per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1725880860
```

## Performance Considerations

- Images should be resized to maximum 1920x1080 for optimal performance
- Audio samples should be 16kHz, 16-bit PCM for best results  
- WebSocket connections automatically optimize based on processing capacity
- Batch processing available for multiple faces/analysis requests
- Response times typically under 50ms for face detection, 100ms for emotion analysis

## SDK and Integration

### JavaScript/TypeScript Client

```javascript
import { SynopticonClient } from '@synopticon/client';

const client = new SynopticonClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key' // if authentication enabled
});

// Face detection
const faces = await client.detectFaces(imageData);

// Real-time streaming
const stream = await client.startWebSocketStream();
stream.subscribe('face_detection', (data) => {
  console.log('Detected faces:', data.faces);
});
```

### Model Context Protocol (MCP)

Synopticon supports MCP for LLM integration:

```bash
# Start MCP server
bun mcp

# Available MCP tools:
# - analyze_face_image
# - detect_emotions  
# - start_eye_tracking
# - get_system_status
```

## Examples and Demos

See the `/examples` directory for complete working examples:

- `face-detection-demo.html` - Basic face detection
- `emotion-analysis-demo.html` - Real-time emotion analysis
- `tobii5-demo/` - Eye tracking integration
- `cognitive-advisory-demo.html` - AI advisory system
- `speech-analysis-demo.html` - Audio processing

## Support and Documentation

- GitHub Repository: [Synopticon API](https://github.com/synopticon/synopticon-api)
- Issues: Report bugs and request features
- Documentation: Additional guides in `/docs` directory
- Examples: Working code samples in `/examples` directory