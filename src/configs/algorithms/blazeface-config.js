/**
 * BlazeFace Algorithm Configuration
 * Optimized configurations for different use cases
 */

export const blazeFaceConfigs = {
  // Fast processing - minimal accuracy trade-off for speed
  fast: {
    inputResolution: 128,
    maxFaces: 1,
    scoreThreshold: 0.8,
    iouThreshold: 0.3,
    returnTensors: false,
    flipHorizontal: false
  },

  // Balanced processing - good speed/accuracy trade-off  
  balanced: {
    inputResolution: 256,
    maxFaces: 3,
    scoreThreshold: 0.75,
    iouThreshold: 0.3,
    returnTensors: false,
    flipHorizontal: false
  },

  // Accurate processing - higher accuracy, slower speed
  accurate: {
    inputResolution: 256,
    maxFaces: 5,
    scoreThreshold: 0.6,
    iouThreshold: 0.2,
    returnTensors: false,
    flipHorizontal: false
  },

  // API optimized - server processing
  api: {
    inputResolution: 256,
    maxFaces: 10,
    scoreThreshold: 0.75,
    iouThreshold: 0.3,
    returnTensors: false,
    flipHorizontal: false
  },

  // Mobile optimized - resource constrained environments
  mobile: {
    inputResolution: 128,
    maxFaces: 2,
    scoreThreshold: 0.8,
    iouThreshold: 0.4,
    returnTensors: false,
    flipHorizontal: false
  }
};

export const getBlazeFaceConfig = (profile = 'balanced') => {
  return blazeFaceConfigs[profile] || blazeFaceConfigs.balanced;
};