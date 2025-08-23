/**
 * Solution 3: Complete Haar Detection Pipeline
 * Replaces placeholder with actual GPU-based face detection execution
 */

const runDetection = (integralTexture, scale) => {
  const gl = state.engine.gl;
  const programInfo = state.engine.useProgram('haar_detection');
  
  // Create detection result texture
  const resultTexture = state.engine.textures.createTexture(
    `detection_result_${scale}`,
    gl.canvas.width,
    gl.canvas.height,
    gl.RGBA,
    state.engine.isWebGL2 ? gl.FLOAT : gl.UNSIGNED_BYTE,
    null
  );
  
  // Create framebuffer for detection rendering
  const detectionFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, detectionFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resultTexture, 0);
  
  // Verify framebuffer completeness
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(detectionFramebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    throw new Error('Detection framebuffer not complete');
  }
  
  try {
    // Set viewport for detection
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    // Clear detection buffer
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Set detection uniforms
    gl.uniform1i(programInfo.uniforms.u_integralImage, 0);
    gl.uniform2f(programInfo.uniforms.u_resolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(programInfo.uniforms.u_scale, scale);
    gl.uniform2f(programInfo.uniforms.u_windowSize, ...state.cascadeData.windowSize);
    gl.uniform1f(programInfo.uniforms.u_threshold, state.cascadeData.threshold);
    
    // Upload Haar feature data to GPU
    uploadHaarFeatureData(programInfo);
    
    // Bind integral image texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, integralTexture);
    
    // Setup detection geometry (fullscreen quad for sliding window)
    setupDetectionGeometry(programInfo);
    
    // Execute detection shader across all windows
    executeDetectionShader();
    
    return resultTexture;
    
  } finally {
    // Cleanup framebuffer
    gl.deleteFramebuffer(detectionFramebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
};

/**
 * Upload Haar cascade feature data to GPU uniforms
 * Handles both WebGL1 and WebGL2 uniform array limitations
 */
const uploadHaarFeatureData = (programInfo) => {
  const gl = state.engine.gl;
  const features = state.cascadeData.features;
  
  // Prepare feature data arrays
  const maxFeatures = state.engine.isWebGL2 ? 256 : 64; // WebGL1 has lower uniform limits
  const featureCount = Math.min(features.length, maxFeatures);
  
  const featureData = new Float32Array(featureCount * 4);
  const weightData = new Float32Array(featureCount);
  
  // Pack feature rectangles and weights
  for (let i = 0; i < featureCount; i++) {
    const feature = features[i];
    
    // Pack rectangle as (x, y, width, height)
    featureData[i * 4 + 0] = feature.x;
    featureData[i * 4 + 1] = feature.y;
    featureData[i * 4 + 2] = feature.width;
    featureData[i * 4 + 3] = feature.height;
    
    // Store weight
    weightData[i] = feature.weight;
  }
  
  // Upload to GPU uniforms
  if (programInfo.uniforms.u_features) {
    gl.uniform4fv(programInfo.uniforms.u_features, featureData);
  }
  
  if (programInfo.uniforms.u_weights) {
    gl.uniform1fv(programInfo.uniforms.u_weights, weightData);
  }
  
  if (programInfo.uniforms.u_numFeatures) {
    gl.uniform1i(programInfo.uniforms.u_numFeatures, featureCount);
  }
};

/**
 * Setup geometry for detection shader
 * Creates fullscreen quad for sliding window detection
 */
const setupDetectionGeometry = (programInfo) => {
  const gl = state.engine.gl;
  
  // Detection quad vertices (covers entire detection area)
  const vertices = new Float32Array([
    -1, -1,  0, 0,  // bottom-left
     1, -1,  1, 0,  // bottom-right
    -1,  1,  0, 1,  // top-left  
     1,  1,  1, 1   // top-right
  ]);
  
  // Create or get detection buffer
  const buffer = state.engine.buffers.getBuffer('detection_quad', vertices);
  
  // Bind vertex attributes
  const positionLoc = programInfo.attributes.a_position;
  const texCoordLoc = programInfo.attributes.a_texCoord;
  
  if (positionLoc !== -1) {
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
  }
  
  if (texCoordLoc !== -1) {
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);
  }
};

/**
 * Execute detection shader with optimized rendering
 * Performs sliding window detection across the entire image
 */
const executeDetectionShader = () => {
  const gl = state.engine.gl;
  
  // Configure OpenGL state for detection
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  
  // Execute detection across all windows in parallel
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  
  // Force GPU completion for accurate timing
  gl.finish();
};

/**
 * Enhanced detection shader for better accuracy
 * Replaces the existing createDetectionShader with optimized version
 */
const createOptimizedDetectionShader = () => {
  return state.engine.isWebGL2 ? `#version 300 es
precision highp float;

uniform sampler2D u_integralImage;
uniform vec2 u_resolution;
uniform float u_scale;
uniform vec2 u_windowSize;
uniform float u_threshold;

// Enhanced Haar feature support
uniform vec4 u_features[256]; // Increased capacity for WebGL2
uniform float u_weights[256];
uniform int u_numFeatures;

in vec2 v_texCoord;
out vec4 fragColor;

// Fast integral image rectangle sum using hardware interpolation
float integralRectSum(vec2 topLeft, vec2 bottomRight) {
    vec2 texel = 1.0 / u_resolution;
    
    // Sample integral image at rectangle corners
    float tl = texture(u_integralImage, topLeft).r;
    float tr = texture(u_integralImage, vec2(bottomRight.x, topLeft.y)).r;
    float bl = texture(u_integralImage, vec2(topLeft.x, bottomRight.y)).r;
    float br = texture(u_integralImage, bottomRight).r;
    
    // Compute rectangle sum using integral image formula
    return br - tr - bl + tl;
}

// Evaluate single Haar feature with sub-pixel precision
float evaluateHaarFeature(vec4 feature, vec2 windowPos, float scale) {
    vec2 texel = 1.0 / u_resolution;
    
    // Scale and position feature rectangle
    vec2 featureSize = feature.zw * scale * texel;
    vec2 featurePos = windowPos + feature.xy * scale * texel;
    
    // Ensure feature stays within bounds
    vec2 topLeft = featurePos;
    vec2 bottomRight = featurePos + featureSize;
    
    if (bottomRight.x > 1.0 || bottomRight.y > 1.0 ||
        topLeft.x < 0.0 || topLeft.y < 0.0) {
        return 0.0;
    }
    
    // Compute normalized feature response
    float rectSum = integralRectSum(topLeft, bottomRight);
    float area = featureSize.x * featureSize.y * u_resolution.x * u_resolution.y;
    
    return area > 0.0 ? rectSum / area : 0.0;
}

void main() {
    vec2 windowPos = v_texCoord;
    
    // Check if current position can fit scaled window
    vec2 texel = 1.0 / u_resolution;
    vec2 scaledWindowSize = u_windowSize * u_scale * texel;
    
    if (windowPos.x + scaledWindowSize.x > 1.0 || 
        windowPos.y + scaledWindowSize.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Evaluate all Haar features for this window
    float totalScore = 0.0;
    float featureCount = 0.0;
    
    for (int i = 0; i < u_numFeatures && i < 256; i++) {
        float featureResponse = evaluateHaarFeature(u_features[i], windowPos, u_scale);
        totalScore += featureResponse * u_weights[i];
        featureCount += 1.0;
    }
    
    // Normalize score by number of features
    float normalizedScore = featureCount > 0.0 ? totalScore / featureCount : 0.0;
    
    // Apply detection threshold with soft decision boundary
    float confidence = smoothstep(u_threshold - 0.1, u_threshold + 0.1, normalizedScore);
    
    // Pack detection result: 
    // R = detection flag (0 or 1)
    // G = confidence score (0-1)
    // B = normalized score (can be >1)
    // A = scale factor
    fragColor = vec4(
        confidence > 0.5 ? 1.0 : 0.0,  // Binary detection
        confidence,                     // Soft confidence
        normalizedScore,               // Raw score
        u_scale                        // Scale information
    );
}` : `
precision highp float;

uniform sampler2D u_integralImage;
uniform vec2 u_resolution;
uniform float u_scale;
uniform vec2 u_windowSize;
uniform float u_threshold;

// WebGL1 limitations
uniform vec4 u_features[64];
uniform float u_weights[64];
uniform int u_numFeatures;

varying vec2 v_texCoord;

float integralRectSum(vec2 topLeft, vec2 bottomRight) {
    float tl = texture2D(u_integralImage, topLeft).r;
    float tr = texture2D(u_integralImage, vec2(bottomRight.x, topLeft.y)).r;
    float bl = texture2D(u_integralImage, vec2(topLeft.x, bottomRight.y)).r;
    float br = texture2D(u_integralImage, bottomRight).r;
    
    return br - tr - bl + tl;
}

float evaluateHaarFeature(vec4 feature, vec2 windowPos, float scale) {
    vec2 texel = 1.0 / u_resolution;
    vec2 featureSize = feature.zw * scale * texel;
    vec2 featurePos = windowPos + feature.xy * scale * texel;
    
    vec2 topLeft = featurePos;
    vec2 bottomRight = featurePos + featureSize;
    
    if (bottomRight.x > 1.0 || bottomRight.y > 1.0 ||
        topLeft.x < 0.0 || topLeft.y < 0.0) {
        return 0.0;
    }
    
    float rectSum = integralRectSum(topLeft, bottomRight);
    float area = featureSize.x * featureSize.y * u_resolution.x * u_resolution.y;
    
    return area > 0.0 ? rectSum / area : 0.0;
}

void main() {
    vec2 windowPos = v_texCoord;
    vec2 texel = 1.0 / u_resolution;
    vec2 scaledWindowSize = u_windowSize * u_scale * texel;
    
    if (windowPos.x + scaledWindowSize.x > 1.0 || 
        windowPos.y + scaledWindowSize.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    float totalScore = 0.0;
    
    // Fixed loop for WebGL1 compatibility
    for (int i = 0; i < 64; i++) {
        if (i >= u_numFeatures) break;
        
        float featureResponse = evaluateHaarFeature(u_features[i], windowPos, u_scale);
        totalScore += featureResponse * u_weights[i];
    }
    
    float normalizedScore = totalScore / max(1.0, float(u_numFeatures));
    float confidence = step(u_threshold, normalizedScore);
    
    gl_FragColor = vec4(
        confidence,
        normalizedScore,
        0.0,
        u_scale
    );
}`;
};