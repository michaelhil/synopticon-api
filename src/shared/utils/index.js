/**
 * Pipelines Barrel Export
 * Centralized exports for all pipeline factories
 */

// Face analysis pipelines
export { createAgeEstimationPipeline, AgeUtils } from './age-estimation-pipeline.js';
export { createEmotionAnalysisPipeline, EmotionUtils, getEmotionColor } from './emotion-analysis-pipeline.js';
export { createMediaPipeFacePipeline, createHybridMediaPipeFacePipeline } from './mediapipe-face-pipeline.js';
export { createMediaPipeFaceMeshPipeline, createMediaPipePipeline, createMediaPipeIrisPipeline } from './mediapipe-pipeline.js';

// Eye tracking pipelines
export { createIrisTrackingPipeline, createEyeTrackingFilter, estimateScreenGazePoint } from '../../features/eye-tracking/devices/webcam/pipeline.js';
export { createEyeTrackingPipeline } from '../../features/eye-tracking/devices/neon/pipeline.js';

// Speech analysis pipelines
export { createSpeechAnalysisPipeline } from './speech-analysis-pipeline-hybrid.js';
export { createSpeechAnalysisPipeline as createClientServerSpeechPipeline } from './speech-analysis-pipeline-client-server.js';
