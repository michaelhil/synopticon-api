/**
 * MCP Tool Registry
 * Central registry for all available Synopticon MCP tools
 */

export interface ToolDefinition {
  /** Tool identifier */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** Input parameter schema */
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Whether tool is enabled */
  enabled: boolean;
  /** Tool category for organization */
  category: string;
}

export interface ToolCategory {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Whether category is enabled */
  enabled: boolean;
  /** Tool names in this category */
  tools: string[];
}

/**
 * Registry of all available MCP tool categories
 * Categories can be enabled/disabled based on Synopticon capabilities
 */
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  system: {
    name: 'System',
    description: 'System health, status, and capability tools',
    enabled: true,
    tools: [
      'synopticon_health_check',
      'synopticon_get_status', 
      'synopticon_get_capabilities'
    ]
  },
  
  face: {
    name: 'Face Analysis',
    description: 'Face detection, landmark analysis, and recognition tools',
    enabled: true,
    tools: [
      'synopticon_start_face_analysis',
      'synopticon_get_face_results',
      'synopticon_stop_face_analysis',
      'synopticon_configure_face_detection'
    ]
  },
  
  emotion: {
    name: 'Emotion Analysis', 
    description: 'Emotion detection and sentiment analysis tools',
    enabled: true,
    tools: [
      'synopticon_start_emotion_analysis',
      'synopticon_get_emotion_results',
      'synopticon_stop_emotion_analysis',
      'synopticon_set_emotion_thresholds'
    ]
  },
  
  media: {
    name: 'Media Streaming',
    description: 'Media capture, streaming, and device management tools',
    enabled: true,
    tools: [
      'synopticon_start_media_stream',
      'synopticon_get_stream_status',
      'synopticon_stop_media_stream',
      'synopticon_list_devices'
    ]
  },

  cognitive: {
    name: 'Cognitive Advisory',
    description: 'Human-machine teaming, performance analysis, and intelligent decision support',
    enabled: true,
    tools: [
      'get_cognitive_system_status',
      'update_human_state',
      'analyze_performance',
      'get_cognitive_advisory',
      'trigger_emergency_response',
      'get_fusion_results',
      'get_temporal_analysis',
      'update_environmental_data'
    ]
  },
  
  // Future categories (disabled by default)
  eye_tracking: {
    name: 'Eye Tracking',
    description: 'Gaze tracking, calibration, and eye movement analysis',
    enabled: false,
    tools: [
      'synopticon_start_eye_tracking',
      'synopticon_calibrate_eye_tracker',
      'synopticon_get_gaze_data'
    ]
  },
  
  speech: {
    name: 'Speech Analysis',
    description: 'Speech recognition, transcription, and audio analysis',
    enabled: false,
    tools: [
      'synopticon_start_speech_analysis',
      'synopticon_get_transcript',
      'synopticon_analyze_audio_quality'
    ]
  }
};

/**
 * Get all enabled tool categories
 */
export const getEnabledCategories = (): Record<string, ToolCategory> => {
  return Object.fromEntries(
    Object.entries(TOOL_CATEGORIES).filter(([_, category]) => category.enabled)
  );
};

/**
 * Get all enabled tool names across categories
 */
export const getEnabledTools = (): string[] => {
  return Object.values(getEnabledCategories())
    .flatMap(category => category.tools);
};

/**
 * Enable/disable a tool category
 */
export const setToolCategoryEnabled = (categoryName: string, enabled: boolean): void => {
  if (TOOL_CATEGORIES[categoryName]) {
    TOOL_CATEGORIES[categoryName].enabled = enabled;
  }
};

/**
 * Check if a specific tool is enabled
 */
export const isToolEnabled = (toolName: string): boolean => {
  return Object.values(getEnabledCategories())
    .some(category => category.tools.includes(toolName));
};
