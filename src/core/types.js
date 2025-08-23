/**
 * Core types and interfaces for the face analysis pipeline system
 * Following functional programming patterns with factory functions
 */

// Capability types that pipelines can provide
export const Capability = {
  FACE_DETECTION: 'face_detection',
  POSE_ESTIMATION_3DOF: 'pose_3dof', 
  POSE_ESTIMATION_6DOF: 'pose_6dof',
  EYE_TRACKING: 'eye_tracking',
  EXPRESSION_ANALYSIS: 'expression',
  LANDMARK_DETECTION: 'landmarks',
  DEPTH_ESTIMATION: 'depth',
  AGE_ESTIMATION: 'age_estimation',
  GENDER_DETECTION: 'gender_detection',
  GAZE_ESTIMATION: 'gaze_estimation',
  DEVICE_CONTROL: 'device_control'
};

// Performance profile factory
export const createPerformanceProfile = (config) => ({
  fps: config.fps || 30,
  latency: config.latency || '50ms',
  modelSize: config.modelSize || 'unknown',
  cpuUsage: config.cpuUsage || 'medium',
  memoryUsage: config.memoryUsage || 'medium',
  batteryImpact: config.batteryImpact || 'medium'
});

// Health status factory
export const createHealthStatus = (config = {}) => ({
  status: config.status || 'healthy',
  lastCheck: config.lastCheck || Date.now(),
  errorCount: config.errorCount || 0,
  successRate: config.successRate || 1.0,
  averageLatency: config.averageLatency || 0,
  isCircuitOpen: config.isCircuitOpen || false
});

// Performance metrics factory
export const createPerformanceMetrics = (config = {}) => ({
  processedFrames: config.processedFrames || 0,
  averageProcessingTime: config.averageProcessingTime || 0,
  currentFPS: config.currentFPS || 0,
  memoryUsage: config.memoryUsage || 0,
  cpuUsage: config.cpuUsage || 0,
  timestamp: config.timestamp || Date.now()
});

// Analysis result factory
export const createAnalysisResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'unknown',
  faces: config.faces || [],
  eyes: config.eyes || null,
  pose: config.pose || null,
  expression: config.expression || null,
  confidence: config.confidence || 0,
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Face detection result factory
export const createFaceResult = (config = {}) => ({
  bbox: config.bbox || [0, 0, 0, 0],
  landmarks: config.landmarks || [],
  pose: config.pose || null,
  expression: config.expression || null,
  age: config.age || null,
  gender: config.gender || null,
  confidence: config.confidence || 0,
  id: config.id || null,
  eyes: config.eyes || null
});

// Pose result factory (3DOF)
export const createPose3DOF = (config = {}) => ({
  yaw: config.yaw || 0,
  pitch: config.pitch || 0,
  roll: config.roll || 0,
  confidence: config.confidence || 0
});

// Pose result factory (6DOF)
export const createPose6DOF = (config = {}) => ({
  rotation: {
    yaw: config.rotation?.yaw || 0,
    pitch: config.rotation?.pitch || 0,
    roll: config.rotation?.roll || 0
  },
  translation: {
    x: config.translation?.x || 0,
    y: config.translation?.y || 0,
    z: config.translation?.z || 0
  },
  confidence: config.confidence || 0
});

// Eye tracking result factory
export const createEyeResult = (config = {}) => ({
  left: {
    center: config.left?.center || [0, 0],
    pupil: config.left?.pupil || [0, 0],
    landmarks: config.left?.landmarks || [],
    gazeVector: config.left?.gazeVector || [0, 0, 0],
    openness: config.left?.openness || 1.0
  },
  right: {
    center: config.right?.center || [0, 0],
    pupil: config.right?.pupil || [0, 0],
    landmarks: config.right?.landmarks || [],
    gazeVector: config.right?.gazeVector || [0, 0, 0],
    openness: config.right?.openness || 1.0
  },
  convergencePoint: config.convergencePoint || null,
  gazeDirection: config.gazeDirection || [0, 0, 0],
  confidence: config.confidence || 0
});

// Emotion analysis result factory
export const createEmotionResult = (config = {}) => ({
  emotion: config.emotion || 'neutral',
  confidence: config.confidence || 0,
  probabilities: {
    neutral: config.probabilities?.neutral || 0,
    happy: config.probabilities?.happy || 0,
    sad: config.probabilities?.sad || 0,
    angry: config.probabilities?.angry || 0,
    fearful: config.probabilities?.fearful || 0,
    disgusted: config.probabilities?.disgusted || 0,
    surprised: config.probabilities?.surprised || 0
  },
  arousal: config.arousal || 0,      // Emotional arousal level (-1 to 1)
  valence: config.valence || 0       // Emotional valence/pleasantness (-1 to 1)
});

// Age estimation result factory
export const createAgeResult = (config = {}) => ({
  estimatedAge: config.estimatedAge || 0,
  ageRange: {
    min: config.ageRange?.min || 0,
    max: config.ageRange?.max || 100
  },
  confidence: config.confidence || 0,
  ageCategory: config.ageCategory || 'adult' // child, teen, adult, senior
});

// Gender detection result factory
export const createGenderResult = (config = {}) => ({
  gender: config.gender || 'unknown',
  confidence: config.confidence || 0,
  probabilities: {
    male: config.probabilities?.male || 0,
    female: config.probabilities?.female || 0
  }
});

// Analysis requirements factory
export const createAnalysisRequirements = (config = {}) => ({
  capabilities: config.capabilities || [],
  strategy: config.strategy || 'performance_first',
  maxLatency: config.maxLatency || 100,
  targetFPS: config.targetFPS || 30,
  minAccuracy: config.minAccuracy || 5,
  batteryOptimized: config.batteryOptimized || false,
  realtime: config.realtime || true
});

// Pipeline configuration factory
export const createPipelineConfig = (config = {}) => ({
  modelUrl: config.modelUrl || null,
  modelConfig: config.modelConfig || {},
  capabilities: config.capabilities || [],
  performance: createPerformanceProfile(config.performance || {}),
  options: config.options || {},
  debug: config.debug || false
});

// Error result factory for consistent error handling
export const createErrorResult = (error, source = 'unknown') => ({
  timestamp: Date.now(),
  source,
  error: {
    message: error.message,
    type: error.constructor.name,
    stack: error.stack
  },
  faces: [],
  success: false
});

// === MULTIMODAL DATA TYPES ===

// Extended capability types for multimodal streams
export const StreamCapability = {
  // Existing face analysis capabilities
  ...Capability,
  
  // Audio capabilities
  SPEECH_RECOGNITION: 'speech_recognition',
  SPEECH_FEATURES: 'speech_features',
  VOICE_ACTIVITY: 'voice_activity',
  EMOTION_AUDIO: 'emotion_audio',
  
  // Motion capabilities
  MOTION_CAPTURE: 'motion_capture',
  GESTURE_RECOGNITION: 'gesture_recognition',
  ACTIVITY_RECOGNITION: 'activity_recognition',
  
  // Sensor capabilities
  PHYSIOLOGICAL: 'physiological',
  ENVIRONMENTAL: 'environmental',
  IMU_TRACKING: 'imu_tracking',
  
  // Simulator capabilities
  SIMULATION_DATA: 'simulation_data',
  TELEMETRY: 'telemetry',
  EVENTS: 'events'
};

// Audio stream result factory
export const createAudioResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'audio_stream',
  
  // Raw audio data
  audioData: config.audioData || null,
  sampleRate: config.sampleRate || 16000,
  channels: config.channels || 1,
  
  // Processed features
  features: config.features || {
    mfcc: null,
    spectral: null,
    temporal: null
  },
  
  // Speech recognition
  transcription: config.transcription || {
    text: null,
    words: [],
    confidence: 0
  },
  
  // Voice activity detection
  vad: config.vad || {
    isSpeech: false,
    confidence: 0,
    energy: 0
  },
  
  // Audio metrics
  volume: config.volume || 0,
  pitch: config.pitch || null,
  
  // Emotion detection from audio
  emotion: config.emotion || {
    valence: 0,
    arousal: 0,
    categories: {},
    confidence: 0
  },
  
  confidence: config.confidence || 0,
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Motion/pose result factory (extends existing pose types)
export const createMotionResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'motion_stream',
  
  // 6DOF pose (can reuse existing createPose6DOF)
  pose: config.pose || null,
  
  // Joint positions and rotations
  joints: config.joints || [],
  
  // Motion derivatives
  velocity: config.velocity || {
    linear: { x: 0, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0 }
  },
  
  acceleration: config.acceleration || {
    linear: { x: 0, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0 }
  },
  
  // Gesture recognition
  gestures: config.gestures || [],
  
  // Activity classification
  activity: config.activity || {
    type: 'unknown',
    confidence: 0,
    duration: 0
  },
  
  confidence: config.confidence || 0,
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Sensor data result factory
export const createSensorResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'sensor_stream',
  
  // Generic sensor data
  sensorType: config.sensorType || 'unknown',
  values: config.values || [],
  units: config.units || [],
  
  // Calibration info
  calibration: config.calibration || {
    isCalibrated: false,
    offset: 0,
    scale: 1.0,
    lastCalibration: null
  },
  
  // Physiological data (if applicable)
  physiological: config.physiological || {
    heartRate: null,
    skinConductance: null,
    temperature: null,
    bloodPressure: null
  },
  
  // IMU data (if applicable)  
  imu: config.imu || {
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 },
    orientation: { w: 1, x: 0, y: 0, z: 0 }
  },
  
  confidence: config.confidence || 1.0,
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Simulator data result factory
export const createSimulatorResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'simulator_stream',
  
  // Simulation state
  state: config.state || {},
  
  // Events from simulator
  events: config.events || [],
  
  // Telemetry data
  telemetry: config.telemetry || {},
  
  // Environment data
  environment: config.environment || {
    scene: null,
    weather: null,
    lighting: null,
    objects: []
  },
  
  // User/avatar data
  avatar: config.avatar || {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    status: 'idle'
  },
  
  confidence: config.confidence || 1.0,
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Multimodal result factory for synchronized data
export const createMultimodalResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'multimodal_orchestrator',
  
  // Individual stream results
  streams: config.streams || {},
  
  // Cross-modal analysis results
  fusion: config.fusion || {
    correlations: {},
    alignment: {},
    features: {},
    confidence: 0
  },
  
  // Synchronization quality metrics
  synchronization: config.synchronization || {
    quality: 1.0,
    latency: 0,
    jitter: 0,
    droppedSamples: 0
  },
  
  // Processing performance
  totalProcessingTime: config.totalProcessingTime || 0,
  streamCount: config.streamCount || Object.keys(config.streams || {}).length,
  
  metadata: config.metadata || {}
});

// Stream configuration factory
export const createStreamConfig = (config = {}) => ({
  // Stream identification
  id: config.id || crypto.randomUUID(),
  type: config.type || 'generic',
  name: config.name || config.type,
  
  // Stream parameters
  sampleRate: config.sampleRate || 30,
  bufferSize: config.bufferSize || 1000,
  windowMs: config.windowMs || 5000,
  
  // Processing configuration
  processors: config.processors || [],
  capabilities: config.capabilities || [],
  
  // Transport configuration
  transport: config.transport || {
    protocol: 'websocket',
    endpoint: null,
    options: {}
  },
  
  // Synchronization requirements
  synchronization: config.synchronization || {
    required: false,
    tolerance: 50, // ms
    strategy: 'buffer_based'
  },
  
  // Quality settings
  quality: config.quality || {
    target: 'balanced',
    maxLatency: 100,
    minAccuracy: 0.8
  },
  
  metadata: config.metadata || {}
});

// Stream requirements factory (extends existing analysis requirements)
export const createStreamRequirements = (config = {}) => ({
  // Extend existing analysis requirements
  ...createAnalysisRequirements(config),
  
  // Stream-specific requirements
  streamTypes: config.streamTypes || [],
  synchronization: config.synchronization || 'none',
  fusion: config.fusion || null,
  
  // Multimodal requirements
  crossModal: config.crossModal || {
    enabled: false,
    correlations: [],
    alignments: []
  },
  
  // Real-time constraints
  realtime: config.realtime !== undefined ? config.realtime : true,
  maxLatency: config.maxLatency || 100,
  bufferSize: config.bufferSize || 1000
});

// === EYE TRACKING DATA TYPES ===

// Eye tracking gaze data factory
export const createGazeData = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracker',
  
  // Normalized gaze coordinates (0-1)
  x: config.x || 0,
  y: config.y || 0,
  confidence: config.confidence || 0,
  
  // Device state
  worn: config.worn !== undefined ? config.worn : true,
  
  // Raw eye measurements
  eyeStates: config.eyeStates || {
    left: null,
    right: null
  },
  
  // Semantic enhancement (optional)
  semantic: config.semantic || null,
  
  // Processing metadata
  processingTime: config.processingTime || 0,
  metadata: config.metadata || {}
});

// Eye state data factory
export const createEyeState = (config = {}) => ({
  // Pupil measurements
  pupilDiameter: config.pupilDiameter || 0,
  pupilCenter: {
    x: config.pupilCenter?.x || 0,
    y: config.pupilCenter?.y || 0
  },
  
  // Eyeball position in 3D space (mm)
  eyeballCenter: {
    x: config.eyeballCenter?.x || 0,
    y: config.eyeballCenter?.y || 0,
    z: config.eyeballCenter?.z || 0
  },
  
  // Optical axis direction
  opticalAxis: {
    x: config.opticalAxis?.x || 0,
    y: config.opticalAxis?.y || 0,
    z: config.opticalAxis?.z || 0
  },
  
  // Detection quality
  confidence: config.confidence || 0,
  timestamp: config.timestamp || Date.now()
});

// IMU data factory for head movement
export const createIMUData = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracker_imu',
  
  // Orientation quaternion [w, x, y, z]
  quaternion: config.quaternion || [1, 0, 0, 0],
  
  // Linear acceleration [x, y, z] in m/s²
  accelerometer: config.accelerometer || [0, 0, 0],
  
  // Angular velocity [x, y, z] in rad/s
  gyroscope: config.gyroscope || [0, 0, 0],
  
  // Optional magnetometer [x, y, z]
  magnetometer: config.magnetometer || null,
  
  // Data quality
  confidence: config.confidence || 1.0,
  metadata: config.metadata || {}
});

// Eye tracking event factories
export const createBlinkEvent = (config = {}) => ({
  type: config.type || 'blink',
  eventType: config.eventType || 'start', // 'start' | 'end'
  timestamp: config.timestamp || Date.now(),
  duration: config.duration || null, // only for 'end' events
  confidence: config.confidence || 0,
  eye: config.eye || 'both' // 'left' | 'right' | 'both'
});

export const createFixationEvent = (config = {}) => ({
  type: config.type || 'fixation',
  eventType: config.eventType || 'start', // 'start' | 'end'
  timestamp: config.timestamp || Date.now(),
  
  // Fixation location
  x: config.x || 0,
  y: config.y || 0,
  
  // Only for 'end' events
  duration: config.duration || null,
  dispersion: config.dispersion || null, // in pixels
  
  confidence: config.confidence || 0
});

export const createSaccadeEvent = (config = {}) => ({
  type: config.type || 'saccade',
  timestamp: config.timestamp || Date.now(),
  
  // Start and end positions
  startX: config.startX || 0,
  startY: config.startY || 0,
  endX: config.endX || 0,
  endY: config.endY || 0,
  
  // Saccade characteristics
  duration: config.duration || 0,
  amplitude: config.amplitude || 0, // in degrees
  peakVelocity: config.peakVelocity || 0, // in degrees/second
  
  confidence: config.confidence || 0
});

// Device status factory
export const createEyeTrackerStatus = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracker_device',
  
  // Connection state
  connectionState: config.connectionState || 'disconnected',
  
  // Device health
  batteryLevel: config.batteryLevel || 0, // 0-100
  isCharging: config.isCharging || false,
  isWorn: config.isWorn || false,
  
  // Calibration status
  calibration: {
    isCalibrated: config.calibration?.isCalibrated || false,
    quality: config.calibration?.quality || 'unknown',
    lastCalibration: config.calibration?.lastCalibration || null
  },
  
  // Tracking quality
  trackingQuality: config.trackingQuality || 'unknown',
  
  // Hardware info
  deviceInfo: {
    serialNumber: config.deviceInfo?.serialNumber || null,
    firmwareVersion: config.deviceInfo?.firmwareVersion || null,
    hardwareVersion: config.deviceInfo?.hardwareVersion || null
  },
  
  // Performance metrics
  streamingRate: config.streamingRate || 0,
  droppedFrames: config.droppedFrames || 0,
  
  metadata: config.metadata || {}
});

// Calibration result factory
export const createCalibrationResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracker_calibration',
  
  // Calibration status
  status: config.status || 'unknown', // 'completed' | 'failed' | 'in_progress'
  quality: config.quality || 'unknown', // 'excellent' | 'good' | 'moderate' | 'poor'
  
  // Calibration points
  points: config.points || [],
  
  // Quality metrics
  accuracy: config.accuracy || null, // average error in degrees
  precision: config.precision || null, // standard deviation in degrees
  
  // Per-eye quality (if available)
  leftEye: {
    accuracy: config.leftEye?.accuracy || null,
    precision: config.leftEye?.precision || null,
    quality: config.leftEye?.quality || 'unknown'
  },
  
  rightEye: {
    accuracy: config.rightEye?.accuracy || null,
    precision: config.rightEye?.precision || null,
    quality: config.rightEye?.quality || 'unknown'
  },
  
  // Recommendations
  recommendations: config.recommendations || [],
  
  metadata: config.metadata || {}
});

// Eye tracking result factory (main container)
export const createEyeTrackingResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracker',
  
  // Primary gaze data
  gaze: config.gaze || null,
  
  // Individual eye states
  leftEye: config.leftEye || null,
  rightEye: config.rightEye || null,
  
  // Head movement data
  imu: config.imu || null,
  
  // Events
  events: config.events || [],
  
  // Device status
  deviceStatus: config.deviceStatus || null,
  
  // Semantic interpretation
  semantic: config.semantic || {
    gazeRegion: 'unknown',
    attentionLevel: 'unknown',
    gazePattern: 'unknown',
    quality: 'unknown'
  },
  
  // Processing performance
  processingTime: config.processingTime || 0,
  confidence: config.confidence || 0,
  
  metadata: config.metadata || {}
});

// Semantic gaze enhancement factory
export const createGazeSemantics = (config = {}) => ({
  // Human-readable descriptions
  description: config.description || 'Gaze location unknown',
  region: config.region || 'unknown', // 'upper_left', 'center', 'lower_right', etc.
  quality: config.quality || 'unknown', // 'high_confidence', 'moderate', 'low'
  interpretation: config.interpretation || 'unknown', // 'focused_attention', 'scanning', etc.
  
  // Behavioral classification
  behaviorType: config.behaviorType || 'unknown', // 'fixation', 'saccade', 'smooth_pursuit'
  attentionLevel: config.attentionLevel || 'unknown', // 'high', 'medium', 'low'
  gazePattern: config.gazePattern || 'unknown', // 'reading', 'searching', 'focused'
  
  // Context information
  context: {
    calibrationQuality: config.context?.calibrationQuality || 'unknown',
    trackingStability: config.context?.trackingStability || 'unknown',
    deviceHealth: config.context?.deviceHealth || 'unknown',
    environmentalConditions: config.context?.environmentalConditions || 'unknown'
  },
  
  // Derived calculations
  derived: {
    screenCoordinates: config.derived?.screenCoordinates || null,
    confidenceLevel: config.derived?.confidenceLevel || 'unknown',
    gazeVelocity: config.derived?.gazeVelocity || null
  }
});

// Device status factory for eye tracking devices
export const createDeviceStatus = (config = {}) => ({
  deviceId: config.deviceId || null,
  connectionState: config.connectionState || 'disconnected',
  lastHeartbeat: config.lastHeartbeat || null,
  connectedAt: config.connectedAt || null,
  deviceInfo: config.deviceInfo || {},
  battery: config.battery || null,
  charging: config.charging || false,
  temperature: config.temperature || null,
  timestamp: config.timestamp || Date.now()
});