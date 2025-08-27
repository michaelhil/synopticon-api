/**
 * Capability Types and Constants
 * Defines pipeline capabilities and related type definitions
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
  DEVICE_CONTROL: 'device_control',
  SPEECH_RECOGNITION: 'speech_recognition',
  SPEECH_ANALYSIS: 'speech_analysis',
  CONVERSATION_CONTEXT: 'conversation_context',
  MULTI_PROMPT_ANALYSIS: 'multi_prompt_analysis',
  REAL_TIME_TRANSCRIPTION: 'real_time_transcription'
} as const;

export type CapabilityType = typeof Capability[keyof typeof Capability];