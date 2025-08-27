# Synopticon MCP API Reference

## Overview

This document provides detailed reference information for all available Synopticon MCP tools, their parameters, return values, and usage examples.

## Tool Categories

### System Tools

These tools provide system-level information and health checks.

#### `synopticon_health_check`

**Description**: Check system health and verify API connectivity

**Parameters**: None

**Returns**:
```json
{
  "status": "healthy",
  "apiConnectivity": "ok", 
  "capabilities": {
    "face_detection": true,
    "emotion_analysis": true,
    "media_streaming": true,
    "eye_tracking": false,
    "speech_analysis": false,
    "version": "0.5.6"
  },
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Check Synopticon system health"
- "Is Synopticon working properly?"
- "Verify the connection to Synopticon"

#### `synopticon_get_status`

**Description**: Get detailed system status including active pipelines

**Parameters**: None

**Returns**:
```json
{
  "system": {
    "version": "0.5.6",
    "uptime": "available",
    "timestamp": "2025-08-27T10:30:00.000Z"
  },
  "capabilities": {
    "faceDetection": true,
    "emotionAnalysis": true,
    "eyeTracking": false,
    "mediaStreaming": true,
    "speechAnalysis": false
  },
  "pipelines": [
    {
      "name": "face-analysis",
      "status": "running",
      "startTime": "2025-08-27T10:25:00.000Z"
    }
  ]
}
```

**Example Usage**:
- "What's the current system status?"
- "Show me all active pipelines"
- "What analysis processes are currently running?"

#### `synopticon_get_capabilities`

**Description**: List all available analysis capabilities and their current status

**Parameters**: None

**Returns**:
```json
{
  "analysis": {
    "faceDetection": {
      "available": true,
      "description": "Real-time face detection with landmark analysis",
      "features": ["face_landmarks", "bounding_boxes", "confidence_scores"]
    },
    "emotionAnalysis": {
      "available": true,
      "description": "Emotion recognition from facial expressions",
      "features": ["emotion_classification", "valence_arousal", "confidence_scores"]
    }
  },
  "media": {
    "streaming": {
      "available": true,
      "description": "Real-time media capture and streaming",
      "features": ["video_capture", "audio_capture", "quality_control"]
    }
  },
  "devices": {
    "cameras": [
      {"id": "camera_0", "label": "Built-in Camera", "type": "webcam"}
    ],
    "microphones": [
      {"id": "mic_0", "label": "Built-in Microphone", "type": "internal"}
    ]
  },
  "version": "0.5.6"
}
```

**Example Usage**:
- "What capabilities does Synopticon have?"
- "List all available analysis features"
- "What devices are available for analysis?"

### Face Analysis Tools

Tools for face detection, landmark analysis, and facial recognition.

#### `synopticon_start_face_analysis`

**Description**: Start real-time face detection and landmark analysis

**Parameters**:
- `device` (string, optional): Camera device ID (default: "default")
  - Pattern: `^[a-zA-Z0-9_-]+$`
- `quality` (string, optional): Analysis quality level (default: "medium")
  - Values: "low", "medium", "high"

**Returns**:
```json
{
  "action": "face_analysis_started",
  "sessionId": "face_session_12345",
  "parameters": {
    "device": "default",
    "quality": "medium"
  },
  "message": "Face analysis has been started. Use synopticon_get_face_results to retrieve detection data.",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Start face analysis on my webcam"
- "Begin face detection with high quality"
- "Start face analysis on camera_1"

#### `synopticon_get_face_results`

**Description**: Get current face detection results including landmarks and bounding boxes

**Parameters**: None

**Returns**:
```json
{
  "status": "faces_detected",
  "faceCount": 2,
  "faces": [
    {
      "id": "face_1",
      "confidence": 0.95,
      "boundingBox": {"x": 100, "y": 50, "width": 200, "height": 250},
      "landmarkCount": 68,
      "landmarks": [
        {"x": 150.5, "y": 75.2},
        {"x": 175.1, "y": 80.3}
      ]
    }
  ],
  "timestamp": "2025-08-27T10:30:00.000Z",
  "message": "Detected 2 faces in current frame"
}
```

**Example Usage**:
- "How many faces are currently detected?"
- "Show me the face detection results"
- "What are the current face landmarks?"

#### `synopticon_stop_face_analysis`

**Description**: Stop the currently running face analysis session

**Parameters**: None

**Returns**:
```json
{
  "action": "face_analysis_stopped",
  "success": true,
  "message": "Face analysis has been stopped",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Stop face analysis"
- "End face detection"
- "Turn off face analysis"

#### `synopticon_configure_face_detection`

**Description**: Configure face detection parameters and thresholds

**Parameters**:
- `confidence_threshold` (number, optional): Minimum confidence for detection (0.0-1.0, default: 0.7)
- `max_faces` (number, optional): Maximum faces to detect (1-20, default: 10)

**Returns**:
```json
{
  "action": "face_detection_configured",
  "configuration": {
    "confidence_threshold": 0.8,
    "max_faces": 5
  },
  "message": "Face detection configuration updated",
  "note": "Configuration will take effect for new analysis sessions",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Set face detection confidence to 0.8"
- "Configure face detection for maximum 5 faces"
- "Adjust face detection sensitivity"

### Emotion Analysis Tools

Tools for emotion detection and sentiment analysis from facial expressions.

#### `synopticon_start_emotion_analysis`

**Description**: Start real-time emotion detection from facial expressions

**Parameters**:
- `device` (string, optional): Camera device ID (default: "default")
- `threshold` (number, optional): Minimum confidence threshold (0.0-1.0, default: 0.6)

**Returns**:
```json
{
  "action": "emotion_analysis_started",
  "sessionId": "emotion_session_12345",
  "parameters": {
    "device": "default",
    "threshold": 0.6
  },
  "message": "Emotion analysis has been started. Use synopticon_get_emotion_results to retrieve emotion data.",
  "supportedEmotions": [
    "happiness", "sadness", "anger", "fear", "surprise", "disgust", "neutral"
  ],
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Start emotion analysis"
- "Begin emotion detection with threshold 0.7"
- "Start analyzing emotions on camera_0"

#### `synopticon_get_emotion_results`

**Description**: Get current emotion analysis results including classifications and confidence scores

**Parameters**: None

**Returns**:
```json
{
  "status": "emotions_detected",
  "dominantEmotion": {
    "emotion": "happiness",
    "confidence": 0.87,
    "valence": 0.65,
    "arousal": 0.42
  },
  "allEmotions": [
    {"emotion": "happiness", "confidence": 0.87, "valence": 0.65, "arousal": 0.42},
    {"emotion": "neutral", "confidence": 0.13, "valence": 0.02, "arousal": 0.05}
  ],
  "emotionalState": {
    "valence": "positive",
    "arousal": "medium", 
    "intensity": 0.87
  },
  "timestamp": "2025-08-27T10:30:00.000Z",
  "message": "Detected happiness (87% confidence)"
}
```

**Example Usage**:
- "What emotions are currently detected?"
- "Show me the emotion analysis results"
- "What's the dominant emotion right now?"

#### `synopticon_stop_emotion_analysis`

**Description**: Stop the currently running emotion analysis session

**Parameters**: None

**Returns**:
```json
{
  "action": "emotion_analysis_stopped",
  "success": true,
  "message": "Emotion analysis has been stopped",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Stop emotion analysis"
- "End emotion detection"
- "Turn off emotion analysis"

#### `synopticon_set_emotion_thresholds`

**Description**: Configure emotion detection thresholds and sensitivity

**Parameters**:
- `confidence_threshold` (number, optional): Minimum confidence threshold (0.0-1.0, default: 0.6)
- `valence_sensitivity` (number, optional): Valence detection sensitivity (0.0-1.0, default: 0.5)
- `arousal_sensitivity` (number, optional): Arousal detection sensitivity (0.0-1.0, default: 0.5)

**Returns**:
```json
{
  "action": "emotion_thresholds_configured",
  "configuration": {
    "confidence_threshold": 0.7,
    "valence_sensitivity": 0.6,
    "arousal_sensitivity": 0.5
  },
  "effects": {
    "confidence": "Emotions below 0.7 confidence will be filtered out",
    "valence": "Valence changes below 0.6 will be smoothed",
    "arousal": "Arousal changes below 0.5 will be smoothed"
  },
  "message": "Emotion detection thresholds updated",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Set emotion confidence threshold to 0.7"
- "Configure emotion sensitivity settings"
- "Adjust emotion detection parameters"

### Media Streaming Tools

Tools for media capture, streaming, and device management.

#### `synopticon_start_media_stream`

**Description**: Start media streaming with specified devices and quality settings

**Parameters**:
- `devices` (array, optional): Array of device IDs to use (default: ["default"])
- `quality` (string, optional): Streaming quality level (default: "medium")
  - Values: "low", "medium", "high"

**Returns**:
```json
{
  "action": "media_stream_started",
  "streamId": "stream_12345",
  "endpoints": [
    "ws://localhost:3000/stream/video",
    "ws://localhost:3000/stream/audio"
  ],
  "parameters": {
    "devices": ["camera_0", "mic_0"],
    "quality": "high"
  },
  "message": "Media streaming has been started. Use synopticon_get_stream_status to monitor stream health.",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Start media streaming with high quality"
- "Begin streaming from camera_1 and mic_1"
- "Start default media stream"

#### `synopticon_get_stream_status`

**Description**: Get current status of all active media streams

**Parameters**: None

**Returns**:
```json
{
  "status": "active",
  "activeStreams": 2,
  "streamsByType": {
    "video": 1,
    "audio": 1
  },
  "streams": [
    {
      "id": "video_stream_1",
      "type": "video",
      "status": "running",
      "device": "camera_0",
      "health": "healthy"
    },
    {
      "id": "audio_stream_1", 
      "type": "audio",
      "status": "running",
      "device": "mic_0",
      "health": "healthy"
    }
  ],
  "message": "2 streams active",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "What's the status of media streams?"
- "How many streams are currently active?"
- "Check streaming health"

#### `synopticon_stop_media_stream`

**Description**: Stop all currently active media streams

**Parameters**: None

**Returns**:
```json
{
  "action": "media_stream_stopped",
  "success": true,
  "message": "All media streams have been stopped",
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "Stop all media streams"
- "End streaming"
- "Turn off media streaming"

#### `synopticon_list_devices`

**Description**: List all available cameras and microphones for media capture

**Parameters**: None

**Returns**:
```json
{
  "status": "devices_available",
  "totalDevices": 3,
  "cameras": [
    {
      "id": "camera_0",
      "label": "Built-in Camera",
      "type": "webcam",
      "available": true
    }
  ],
  "microphones": [
    {
      "id": "mic_0",
      "label": "Built-in Microphone", 
      "type": "internal",
      "available": true
    },
    {
      "id": "mic_1",
      "label": "USB Microphone",
      "type": "usb",
      "available": true
    }
  ],
  "deviceSummary": {
    "cameras": 1,
    "microphones": 2,
    "total": 3
  },
  "message": "Found 3 available devices",
  "usage": {
    "note": "Use device IDs with other streaming tools",
    "example": "synopticon_start_media_stream with devices: [\"camera_0\", \"mic_1\"]"
  },
  "timestamp": "2025-08-27T10:30:00.000Z"
}
```

**Example Usage**:
- "List available cameras and microphones"
- "What devices can I use for streaming?"
- "Show me available media devices"

## Error Handling

All tools return structured error information when issues occur:

```json
{
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Face analysis failed to start",
    "data": {
      "originalError": "Camera device not found",
      "context": {"device": "invalid_camera"}
    }
  }
}
```

**Common Error Codes**:
- `SYNOPTICON_UNAVAILABLE`: Cannot connect to Synopticon API
- `INVALID_TOOL_CALL`: Invalid tool name or parameters
- `TOOL_EXECUTION_FAILED`: Tool execution failed
- `NETWORK_ERROR`: Network connectivity issues
- `TIMEOUT_ERROR`: Request timed out
- `VALIDATION_ERROR`: Parameter validation failed

## Usage Patterns

### Sequential Analysis
```
1. synopticon_health_check
2. synopticon_start_face_analysis
3. synopticon_start_emotion_analysis
4. synopticon_get_face_results
5. synopticon_get_emotion_results
```

### Multi-Modal Analysis
```
1. synopticon_list_devices
2. synopticon_start_media_stream
3. synopticon_start_face_analysis
4. synopticon_start_emotion_analysis
5. Monitor results with get_*_results tools
```

### Configuration Workflow
```
1. synopticon_get_capabilities
2. synopticon_configure_face_detection
3. synopticon_set_emotion_thresholds
4. Start analysis with configured parameters
```

## Best Practices

1. **Always check health first**: Use `synopticon_health_check` before starting analysis
2. **List devices**: Use `synopticon_list_devices` to see available hardware
3. **Monitor status**: Regularly check `synopticon_get_status` for system health
4. **Clean shutdown**: Always stop analysis sessions when done
5. **Handle errors**: Check for error responses and handle appropriately
6. **Use appropriate quality**: Choose quality levels based on performance needs