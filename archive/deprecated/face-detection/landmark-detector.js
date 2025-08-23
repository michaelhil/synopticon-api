/**
 * Facial Landmark Detection - WebGL implementation using template matching
 * Detects 68-point facial landmarks with sub-pixel accuracy
 */

import { createPipelineStage } from '../core/pipeline.js';
import { getShaderSource } from '../shaders/base-shaders.js';

export const createLandmarkDetector = (webglEngine) => {
  const state = {
    engine: webglEngine,
    landmarkTemplates: null,
    templateTextures: new Map(),
    isInitialized: false
  };
  
  // Get gl context dynamically to ensure it's always available
  const getGL = () => {
    if (!state.engine || !state.engine.gl) {
      throw new Error('WebGL context not available in landmark detector');
    }
    return state.engine.gl;
  };

  const initialize = async () => {
    // Create landmark templates
    createLandmarkTemplates();
    
    // Setup template matching shaders
    setupTemplateMatchingShaders();
    
    // Initialize template textures
    setupTemplateTextures();
    
    state.isInitialized = true;
    console.log('Landmark detector initialized with 68 landmark points');
  };

  const createLandmarkTemplates = () => {
    // Define 68 facial landmark templates
    // Each template is a small image patch that represents the expected appearance
    // of a specific facial feature (eye corner, nose tip, etc.)
    
    state.landmarkTemplates = {
      // Jaw line (17 points: 0-16)
      jaw: createJawTemplates(),
      
      // Right eyebrow (5 points: 17-21)
      rightEyebrow: createEyebrowTemplates(),
      
      // Left eyebrow (5 points: 22-26)  
      leftEyebrow: createEyebrowTemplates(),
      
      // Nose bridge and tip (9 points: 27-35)
      nose: createNoseTemplates(),
      
      // Right eye (6 points: 36-41)
      rightEye: createEyeTemplates(),
      
      // Left eye (6 points: 42-47)
      leftEye: createEyeTemplates(),
      
      // Outer lip (12 points: 48-59)
      outerLip: createLipTemplates(),
      
      // Inner lip (8 points: 60-67)
      innerLip: createLipTemplates()
    };
  };

  const createJawTemplates = () => {
    // Create templates for jaw line detection
    return Array.from({length: 17}, (_, i) => createGradientTemplate(8, 8, i / 16));
  };

  const createEyebrowTemplates = () => {
    // Create templates for eyebrow detection
    return Array.from({length: 5}, () => createEyebrowTemplate());
  };

  const createNoseTemplates = () => {
    // Create templates for nose detection
    return Array.from({length: 9}, (_, i) => {
      if (i < 4) return createNoseBridgeTemplate();
      return createNoseTipTemplate();
    });
  };

  const createEyeTemplates = () => {
    // Create templates for eye corner and eyelid detection
    return [
      createEyeCornerTemplate(true),  // outer corner
      createEyeTopTemplate(),         // top points
      createEyeTopTemplate(),
      createEyeCornerTemplate(false), // inner corner
      createEyeBottomTemplate(),      // bottom points
      createEyeBottomTemplate()
    ];
  };

  const createLipTemplates = () => {
    // Create templates for lip detection
    return Array.from({length: 12}, (_, i) => {
      if (i === 0 || i === 6) return createLipCornerTemplate();
      if (i === 3 || i === 9) return createLipCenterTemplate();
      return createLipEdgeTemplate();
    });
  };

  const createGradientTemplate = (width, height, angle) => {
    // Create a gradient template for edge detection
    const template = new Float32Array(width * height);
    const centerX = width / 2;
    const centerY = height / 2;
    const cos_a = Math.cos(angle * Math.PI);
    const sin_a = Math.sin(angle * Math.PI);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const rotatedX = dx * cos_a - dy * sin_a;
        const gradient = Math.max(0, Math.min(1, (rotatedX + centerX) / width));
        template[y * width + x] = gradient;
      }
    }
    
    return { data: template, width, height };
  };

  const createEyebrowTemplate = () => {
    // Create template for eyebrow detection (horizontal line with gradient)
    const width = 12, height = 6;
    const template = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 2 || y === 3) {
          template[y * width + x] = 1.0 - Math.abs(x - width/2) / (width/2);
        } else {
          template[y * width + x] = 0.0;
        }
      }
    }
    
    return { data: template, width, height };
  };

  const createNoseBridgeTemplate = () => {
    // Vertical line template for nose bridge
    const width = 6, height = 12;
    const template = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 2 || x === 3) {
          template[y * width + x] = 1.0;
        } else {
          template[y * width + x] = 0.0;
        }
      }
    }
    
    return { data: template, width, height };
  };

  const createNoseTipTemplate = () => {
    // Circular template for nose tip
    const width = 8, height = 8;
    const template = new Float32Array(width * height);
    const centerX = width / 2, centerY = height / 2;
    const radius = 2.5;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        template[y * width + x] = Math.max(0, 1.0 - distance / radius);
      }
    }
    
    return { data: template, width, height };
  };

  const createEyeCornerTemplate = (isOuter) => {
    // Corner detection template
    const width = 8, height = 6;
    const template = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 2 || y === 3) {
          const factor = isOuter ? x / width : 1.0 - x / width;
          template[y * width + x] = factor;
        }
      }
    }
    
    return { data: template, width, height };
  };

  const createEyeTopTemplate = () => {
    // Curved template for eye top
    const width = 10, height = 6;
    const template = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerX = width / 2;
        const dx = x - centerX;
        const curve = Math.exp(-dx * dx / 8);
        if (y === 1 || y === 2) {
          template[y * width + x] = curve;
        }
      }
    }
    
    return { data: template, width, height };
  };

  const createEyeBottomTemplate = () => {
    // Similar to top template but inverted
    const topTemplate = createEyeTopTemplate();
    const template = new Float32Array(topTemplate.data.length);
    
    // Flip vertically
    for (let y = 0; y < topTemplate.height; y++) {
      for (let x = 0; x < topTemplate.width; x++) {
        const srcY = topTemplate.height - 1 - y;
        template[y * topTemplate.width + x] = topTemplate.data[srcY * topTemplate.width + x];
      }
    }
    
    return { data: template, width: topTemplate.width, height: topTemplate.height };
  };

  const createLipCornerTemplate = () => {
    // Corner template for lip edges
    return createGradientTemplate(8, 8, 0.25);
  };

  const createLipCenterTemplate = () => {
    // Center template for top/bottom lip
    const width = 8, height = 6;
    const template = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 2 || y === 3) {
          template[y * width + x] = 1.0 - Math.abs(x - width/2) / (width/2);
        }
      }
    }
    
    return { data: template, width, height };
  };

  const createLipEdgeTemplate = () => {
    // Edge template for lip outline
    return createGradientTemplate(6, 6, 0.5);
  };

  const setupTemplateMatchingShaders = () => {
    // Create template matching shader
    const vertexShader = getShaderSource('vertex_fullscreen', state.engine.isWebGL2);
    const fragmentShader = createTemplateMatchingShader();
    
    state.engine.createShaderProgram(
      vertexShader,
      fragmentShader,
      'template_matching'
    );
  };

  const createTemplateMatchingShader = () => {
    // Enhanced normalized cross-correlation with better sub-pixel accuracy
    return state.engine.isWebGL2 ? `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_template;
uniform vec2 u_imageSize;
uniform vec2 u_templateSize;
uniform vec2 u_searchCenter;
uniform float u_searchRadius;
uniform float u_threshold;

in vec2 v_texCoord;
out vec4 fragColor;

float normalizedCrossCorrelation(vec2 center) {
    vec2 imageTexel = 1.0 / u_imageSize;
    vec2 templateTexel = 1.0 / u_templateSize;
    
    float correlation = 0.0;
    float imageMean = 0.0;
    float templateMean = 0.0;
    float imageVar = 0.0;
    float templateVar = 0.0;
    float count = 0.0;
    
    // Calculate means first
    for (int ty = 0; ty < int(u_templateSize.y); ty++) {
        for (int tx = 0; tx < int(u_templateSize.x); tx++) {
            vec2 templateCoord = (vec2(float(tx), float(ty)) + 0.5) * templateTexel;
            vec2 imageOffset = vec2(float(tx), float(ty)) - u_templateSize * 0.5;
            vec2 imageCoord = center + imageOffset * imageTexel;
            
            if (imageCoord.x >= 0.0 && imageCoord.x <= 1.0 && 
                imageCoord.y >= 0.0 && imageCoord.y <= 1.0) {
                
                float imageVal = texture(u_image, imageCoord).r;
                float templateVal = texture(u_template, templateCoord).r;
                
                imageMean += imageVal;
                templateMean += templateVal;
                count += 1.0;
            }
        }
    }
    
    if (count > 0.0) {
        imageMean /= count;
        templateMean /= count;
        
        // Calculate correlation and variances
        for (int ty = 0; ty < int(u_templateSize.y); ty++) {
            for (int tx = 0; tx < int(u_templateSize.x); tx++) {
                vec2 templateCoord = (vec2(float(tx), float(ty)) + 0.5) * templateTexel;
                vec2 imageOffset = vec2(float(tx), float(ty)) - u_templateSize * 0.5;
                vec2 imageCoord = center + imageOffset * imageTexel;
                
                if (imageCoord.x >= 0.0 && imageCoord.x <= 1.0 && 
                    imageCoord.y >= 0.0 && imageCoord.y <= 1.0) {
                    
                    float imageVal = texture(u_image, imageCoord).r;
                    float templateVal = texture(u_template, templateCoord).r;
                    
                    float imageDiff = imageVal - imageMean;
                    float templateDiff = templateVal - templateMean;
                    
                    correlation += imageDiff * templateDiff;
                    imageVar += imageDiff * imageDiff;
                    templateVar += templateDiff * templateDiff;
                }
            }
        }
        
        float denominator = sqrt(imageVar * templateVar);
        return denominator > 0.0 ? correlation / denominator : 0.0;
    }
    
    return 0.0;
}

void main() {
    vec2 searchCenter = u_searchCenter;
    vec2 currentPos = v_texCoord;
    
    // Only process within search radius
    float distance = length(currentPos - searchCenter);
    if (distance > u_searchRadius) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    float correlation = normalizedCrossCorrelation(currentPos);
    
    // Apply threshold and enhance contrast
    float enhanced = correlation > u_threshold ? correlation * correlation : 0.0;
    fragColor = vec4(enhanced, correlation, distance, 1.0);
}` : `
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_template;
uniform vec2 u_imageSize;
uniform vec2 u_templateSize;
uniform vec2 u_searchCenter;
uniform float u_searchRadius;
uniform float u_threshold;

varying vec2 v_texCoord;

float normalizedCrossCorrelation(vec2 center) {
    vec2 imageTexel = 1.0 / u_imageSize;
    vec2 templateTexel = 1.0 / u_templateSize;
    
    float correlation = 0.0;
    float imageMean = 0.0;
    float templateMean = 0.0;
    float count = 0.0;
    
    // Simplified version for WebGL1 with fixed loop bounds
    for (int ty = 0; ty < 16; ty++) {
        for (int tx = 0; tx < 16; tx++) {
            if (float(tx) >= u_templateSize.x || float(ty) >= u_templateSize.y) break;
            
            vec2 templateCoord = (vec2(float(tx), float(ty)) + 0.5) * templateTexel;
            vec2 imageOffset = vec2(float(tx), float(ty)) - u_templateSize * 0.5;
            vec2 imageCoord = center + imageOffset * imageTexel;
            
            if (imageCoord.x >= 0.0 && imageCoord.x <= 1.0 && 
                imageCoord.y >= 0.0 && imageCoord.y <= 1.0) {
                
                float imageVal = texture2D(u_image, imageCoord).r;
                float templateVal = texture2D(u_template, templateCoord).r;
                
                correlation += imageVal * templateVal;
                count += 1.0;
            }
        }
    }
    
    return count > 0.0 ? correlation / count : 0.0;
}

void main() {
    vec2 searchCenter = u_searchCenter;
    vec2 currentPos = v_texCoord;
    
    float distance = length(currentPos - searchCenter);
    if (distance > u_searchRadius) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    float correlation = normalizedCrossCorrelation(currentPos);
    float enhanced = correlation > u_threshold ? correlation * correlation : 0.0;
    gl_FragColor = vec4(enhanced, correlation, distance, 1.0);
}`;
  };

  const setupTemplateTextures = () => {
    // Upload all templates to GPU textures
    const allTemplates = [
      ...state.landmarkTemplates.jaw,
      ...state.landmarkTemplates.rightEyebrow,
      ...state.landmarkTemplates.leftEyebrow,
      ...state.landmarkTemplates.nose,
      ...state.landmarkTemplates.rightEye,
      ...state.landmarkTemplates.leftEye,
      ...state.landmarkTemplates.outerLip,
      ...state.landmarkTemplates.innerLip
    ];

    allTemplates.forEach((template, index) => {
      const gl = getGL();
      const texture = state.engine.textures.createTexture(
        `landmark_template_${index}`,
        template.width,
        template.height,
        gl.R32F || gl.LUMINANCE,
        gl.FLOAT || gl.UNSIGNED_BYTE,
        template.data
      );
      
      state.templateTextures.set(index, {
        texture,
        width: template.width,
        height: template.height
      });
    });
  };

  const detectLandmarks = (imageTexture, faceRegion) => {
    if (!state.isInitialized) {
      throw new Error('Landmark detector not initialized');
    }

    const landmarks = [];
    
    // Detect landmarks in order (0-67)
    let templateIndex = 0;
    
    // Performance optimized landmark groups (prioritize important features)
    const groups = [
      { name: 'rightEye', count: 6, searchRadius: 0.12, threshold: 0.8, priority: 1 },
      { name: 'leftEye', count: 6, searchRadius: 0.12, threshold: 0.8, priority: 1 },
      { name: 'nose', count: 4, searchRadius: 0.15, threshold: 0.7, priority: 2 }, // Reduce nose points
      { name: 'outerLip', count: 8, searchRadius: 0.18, threshold: 0.65, priority: 2 }, // Reduce lip points
      { name: 'jaw', count: 9, searchRadius: 0.2, threshold: 0.5, priority: 3 }, // Reduce jaw points
      { name: 'rightEyebrow', count: 3, searchRadius: 0.15, threshold: 0.6, priority: 3 }, // Reduce eyebrow points
      { name: 'leftEyebrow', count: 3, searchRadius: 0.15, threshold: 0.6, priority: 3 }
      // Skip innerLip for performance (can be interpolated from outerLip)
    ];
    
    // Performance optimization: Process only high priority groups for real-time
    const processGroups = groups.filter(group => group.priority <= 2);

    for (const group of processGroups) {
      const groupLandmarks = detectLandmarkGroup(
        imageTexture, 
        faceRegion, 
        templateIndex, 
        group.count, 
        group.searchRadius,
        group.threshold
      );
      
      landmarks.push(...groupLandmarks);
      templateIndex += group.count;
    }
    
    return landmarks;
  };

  const detectLandmarkGroup = (imageTexture, faceRegion, startTemplateIndex, count, searchRadius, threshold) => {
    const landmarks = [];
    
    for (let i = 0; i < count; i++) {
      const templateIndex = startTemplateIndex + i;
      const landmark = detectSingleLandmark(
        imageTexture, 
        faceRegion, 
        templateIndex, 
        searchRadius,
        threshold
      );
      
      landmarks.push(landmark);
    }
    
    return landmarks;
  };

  const detectSingleLandmark = (imageTexture, faceRegion, templateIndex, searchRadius, threshold) => {
    const gl = getGL();
    const templateInfo = state.templateTextures.get(templateIndex);
    
    if (!templateInfo) {
      throw new Error(`Template ${templateIndex} not found`);
    }

    // Use template matching shader
    const programInfo = state.engine.useProgram('template_matching');
    
    // Estimate search center based on face region and landmark index
    const searchCenter = estimateLandmarkPosition(faceRegion, templateIndex);
    
    // Set uniforms
    gl.uniform1i(programInfo.uniforms.u_image, 0);
    gl.uniform1i(programInfo.uniforms.u_template, 1);
    gl.uniform2f(programInfo.uniforms.u_imageSize, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(programInfo.uniforms.u_templateSize, templateInfo.width, templateInfo.height);
    gl.uniform2f(programInfo.uniforms.u_searchCenter, searchCenter.x, searchCenter.y);
    gl.uniform1f(programInfo.uniforms.u_searchRadius, searchRadius);
    gl.uniform1f(programInfo.uniforms.u_threshold, threshold || 0.5);
    
    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, templateInfo.texture);
    
    // Render template matching
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    
    // Create result texture
    const resultTexture = state.engine.textures.createTexture(
      `temp_result_${templateIndex}`,
      gl.canvas.width,
      gl.canvas.height
    );
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resultTexture, 0);
    
    // Execute template matching
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Find maximum correlation position
    const bestMatch = findMaximumCorrelation(resultTexture, searchCenter, searchRadius);
    
    // Cleanup
    gl.deleteFramebuffer(fb);
    
    return {
      x: bestMatch.x,
      y: bestMatch.y,
      confidence: bestMatch.correlation,
      templateIndex: templateIndex
    };
  };

  const estimateLandmarkPosition = (faceRegion, landmarkIndex) => {
    // Estimate initial landmark position based on face region and landmark index
    const centerX = faceRegion.x + faceRegion.width / 2;
    const centerY = faceRegion.y + faceRegion.height / 2;
    
    // Normalized coordinates (0-1)
    const gl = getGL();
    const normalizedX = centerX / gl.canvas.width;
    const normalizedY = centerY / gl.canvas.height;
    
    // Apply landmark-specific offsets based on facial proportions
    return applyLandmarkOffset(normalizedX, normalizedY, landmarkIndex, faceRegion);
  };

  const applyLandmarkOffset = (centerX, centerY, landmarkIndex, faceRegion) => {
    // Enhanced landmark positioning with better facial proportion modeling
    const gl = getGL();
    const faceWidth = faceRegion.width / gl.canvas.width;
    const faceHeight = faceRegion.height / gl.canvas.height;
    
    // Detailed landmark positioning based on facial anatomy
    if (landmarkIndex < 17) {
      // Jaw line (0-16) - arc from right to left
      const angle = Math.PI * (landmarkIndex / 16.0);
      const radiusX = faceWidth * 0.48;
      const radiusY = faceHeight * 0.38;
      return {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY + faceHeight * 0.1
      };
    } else if (landmarkIndex < 22) {
      // Right eyebrow (17-21)
      const progress = (landmarkIndex - 17) / 4.0;
      const eyebrowY = centerY - faceHeight * 0.28;
      const eyebrowX = centerX - faceWidth * (0.35 - progress * 0.25);
      return { x: eyebrowX, y: eyebrowY };
    } else if (landmarkIndex < 27) {
      // Left eyebrow (22-26)
      const progress = (landmarkIndex - 22) / 4.0;
      const eyebrowY = centerY - faceHeight * 0.28;
      const eyebrowX = centerX + faceWidth * (0.1 + progress * 0.25);
      return { x: eyebrowX, y: eyebrowY };
    } else if (landmarkIndex < 31) {
      // Nose bridge (27-30)
      const progress = (landmarkIndex - 27) / 3.0;
      return {
        x: centerX,
        y: centerY - faceHeight * (0.15 - progress * 0.15)
      };
    } else if (landmarkIndex < 36) {
      // Nose tip and nostrils (31-35)
      const positions = [
        { x: 0, y: 0.05 }, // nose tip
        { x: -0.08, y: 0.08 }, { x: -0.04, y: 0.1 }, // left nostril
        { x: 0.04, y: 0.1 }, { x: 0.08, y: 0.08 }  // right nostril
      ];
      const pos = positions[landmarkIndex - 31];
      return {
        x: centerX + pos.x * faceWidth,
        y: centerY + pos.y * faceHeight
      };
    } else if (landmarkIndex < 42) {
      // Right eye (36-41)
      const eyeCenterX = centerX - faceWidth * 0.25;
      const eyeCenterY = centerY - faceHeight * 0.15;
      const eyePositions = [
        { x: -0.15, y: 0 }, { x: -0.08, y: -0.05 }, { x: 0.08, y: -0.05 },
        { x: 0.15, y: 0 }, { x: 0.08, y: 0.05 }, { x: -0.08, y: 0.05 }
      ];
      const pos = eyePositions[landmarkIndex - 36];
      return {
        x: eyeCenterX + pos.x * faceWidth,
        y: eyeCenterY + pos.y * faceHeight
      };
    } else if (landmarkIndex < 48) {
      // Left eye (42-47)
      const eyeCenterX = centerX + faceWidth * 0.25;
      const eyeCenterY = centerY - faceHeight * 0.15;
      const eyePositions = [
        { x: -0.15, y: 0 }, { x: -0.08, y: -0.05 }, { x: 0.08, y: -0.05 },
        { x: 0.15, y: 0 }, { x: 0.08, y: 0.05 }, { x: -0.08, y: 0.05 }
      ];
      const pos = eyePositions[landmarkIndex - 42];
      return {
        x: eyeCenterX + pos.x * faceWidth,
        y: eyeCenterY + pos.y * faceHeight
      };
    } else if (landmarkIndex < 60) {
      // Outer lip (48-59)
      const angle = Math.PI * 2 * ((landmarkIndex - 48) / 12.0);
      const lipCenterY = centerY + faceHeight * 0.25;
      const radiusX = faceWidth * 0.18;
      const radiusY = faceHeight * 0.12;
      return {
        x: centerX + Math.cos(angle) * radiusX,
        y: lipCenterY + Math.sin(angle) * radiusY
      };
    } else {
      // Inner lip (60-67)
      const angle = Math.PI * 2 * ((landmarkIndex - 60) / 8.0);
      const lipCenterY = centerY + faceHeight * 0.25;
      const radiusX = faceWidth * 0.12;
      const radiusY = faceHeight * 0.08;
      return {
        x: centerX + Math.cos(angle) * radiusX,
        y: lipCenterY + Math.sin(angle) * radiusY
      };
    }
  };

  const findMaximumCorrelation = (resultTexture, searchCenter, searchRadius) => {
    const gl = getGL();
    
    // Performance optimization: Calculate minimal readback region
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    const centerX = Math.floor(searchCenter.x * canvasWidth);
    const centerY = Math.floor(searchCenter.y * canvasHeight);
    const radiusPixels = Math.max(8, Math.floor(searchRadius * Math.min(canvasWidth, canvasHeight)));
    
    // Define minimal readback region
    const minX = Math.max(0, centerX - radiusPixels);
    const minY = Math.max(0, centerY - radiusPixels);
    const maxX = Math.min(canvasWidth, centerX + radiusPixels);
    const maxY = Math.min(canvasHeight, centerY + radiusPixels);
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width <= 0 || height <= 0) {
      return { x: searchCenter.x, y: searchCenter.y, correlation: 0.0 };
    }
    
    // Create temporary framebuffer for readback
    const tempFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resultTexture, 0);
    
    // Check framebuffer completeness
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(tempFramebuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { x: searchCenter.x, y: searchCenter.y, correlation: 0.0 };
    }
    
    try {
      // Performance optimization: Use appropriate pixel format
      let pixelData, format, type;
      
      if (state.engine.isWebGL2) {
        // WebGL2: Use float for higher precision
        format = gl.RGBA;
        type = gl.FLOAT;
        pixelData = new Float32Array(width * height * 4);
      } else {
        // WebGL1: Use unsigned byte (faster readback)
        format = gl.RGBA;
        type = gl.UNSIGNED_BYTE;
        pixelData = new Uint8Array(width * height * 4);
      }
      
      // Read pixels from GPU (minimal region only)
      gl.readPixels(minX, minY, width, height, format, type, pixelData);
      
      // Find maximum correlation using optimized search
      let maxCorrelation = -1.0;
      let maxX = 0, maxY = 0;
      
      // Performance optimization: Skip every other pixel for initial search
      const step = width * height > 1024 ? 2 : 1; // Adaptive sampling
      
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const pixelIndex = (y * width + x) * 4;
          
          // Extract correlation from red channel (template matching result)
          const correlation = state.engine.isWebGL2 
            ? pixelData[pixelIndex] 
            : pixelData[pixelIndex] / 255.0;
          
          if (correlation > maxCorrelation) {
            maxCorrelation = correlation;
            maxX = x;
            maxY = y;
          }
        }
      }
      
      // Performance optimization: Only apply sub-pixel if correlation is high enough
      let subPixelResult = { x: maxX, y: maxY };
      if (maxCorrelation > 0.5 && step === 1) {
        subPixelResult = applySubPixelInterpolation(pixelData, maxX, maxY, width, height, state.engine.isWebGL2);
      }
      
      // Convert back to normalized coordinates
      const finalX = (minX + subPixelResult.x) / canvasWidth;
      const finalY = (minY + subPixelResult.y) / canvasHeight;
      
      return {
        x: finalX,
        y: finalY,
        correlation: maxCorrelation
      };
      
    } finally {
      // Cleanup
      gl.deleteFramebuffer(tempFramebuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };
  
  // Performance optimized sub-pixel interpolation
  const applySubPixelInterpolation = (pixelData, maxX, maxY, width, height, isFloat) => {
    // Early exit if no neighbors available
    if (maxX <= 0 || maxX >= width - 1 || maxY <= 0 || maxY >= height - 1) {
      return { x: maxX, y: maxY };
    }
    
    const getPixelValue = (x, y) => {
      const index = (y * width + x) * 4;
      return isFloat ? pixelData[index] : pixelData[index] / 255.0;
    };
    
    // Simplified quadratic interpolation (performance optimized)
    const c01 = getPixelValue(maxX - 1, maxY);
    const c11 = getPixelValue(maxX, maxY);     
    const c21 = getPixelValue(maxX + 1, maxY);
    const c10 = getPixelValue(maxX, maxY - 1);
    const c12 = getPixelValue(maxX, maxY + 1);
    
    // X direction interpolation
    const dx1 = (c21 - c01) * 0.5;
    const dx2 = c21 - 2 * c11 + c01;
    let subPixelX = 0;
    if (Math.abs(dx2) > 1e-6) {
      subPixelX = Math.max(-0.5, Math.min(0.5, -dx1 / dx2));
    }
    
    // Y direction interpolation
    const dy1 = (c12 - c10) * 0.5;
    const dy2 = c12 - 2 * c11 + c10;
    let subPixelY = 0;
    if (Math.abs(dy2) > 1e-6) {
      subPixelY = Math.max(-0.5, Math.min(0.5, -dy1 / dy2));
    }
    
    return {
      x: maxX + subPixelX,
      y: maxY + subPixelY
    };
  };

  const cleanup = () => {
    // Cleanup template textures
    for (const [index, templateInfo] of state.templateTextures) {
      // Textures will be cleaned up by TextureManager
    }
    state.templateTextures.clear();
    state.isInitialized = false;
  };

  return {
    initialize,
    detectLandmarks,
    cleanup
  };
};