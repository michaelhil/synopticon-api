/**
 * Solution 1: Real GPU Readback for Landmark Detection
 * Replaces placeholder findMaximumCorrelation() with actual GPU texture readback
 */

const findMaximumCorrelation = (resultTexture, searchCenter, searchRadius) => {
  const gl = state.gl;
  
  // Calculate search area bounds in pixels
  const canvasWidth = gl.canvas.width;
  const canvasHeight = gl.canvas.height;
  const centerX = Math.floor(searchCenter.x * canvasWidth);
  const centerY = Math.floor(searchCenter.y * canvasHeight);
  const radiusPixels = Math.floor(searchRadius * Math.min(canvasWidth, canvasHeight));
  
  // Define readback region
  const minX = Math.max(0, centerX - radiusPixels);
  const minY = Math.max(0, centerY - radiusPixels);
  const maxX = Math.min(canvasWidth, centerX + radiusPixels);
  const maxY = Math.min(canvasHeight, centerY + radiusPixels);
  const width = maxX - minX;
  const height = maxY - minY;
  
  if (width <= 0 || height <= 0) {
    return {
      x: searchCenter.x,
      y: searchCenter.y,
      correlation: 0.0
    };
  }
  
  // Create temporary framebuffer to read from result texture
  const tempFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, tempFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resultTexture, 0);
  
  // Check framebuffer completeness
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(tempFramebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    throw new Error('Framebuffer not complete for correlation readback');
  }
  
  // Allocate pixel buffer - handle WebGL1 vs WebGL2 differences
  let pixelData;
  let format = gl.RGBA;
  let type = gl.UNSIGNED_BYTE;
  
  if (state.engine.isWebGL2) {
    // WebGL2 supports more formats for readPixels
    format = gl.RGBA;
    type = gl.FLOAT;
    pixelData = new Float32Array(width * height * 4);
  } else {
    // WebGL1 requires RGBA/UNSIGNED_BYTE for readPixels
    format = gl.RGBA;
    type = gl.UNSIGNED_BYTE;
    pixelData = new Uint8Array(width * height * 4);
  }
  
  // Read pixels from GPU
  gl.readPixels(minX, minY, width, height, format, type, pixelData);
  
  // Clean up framebuffer
  gl.deleteFramebuffer(tempFramebuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  
  // Find maximum correlation in CPU
  let maxCorrelation = -1.0;
  let maxX = 0, maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      
      // Extract correlation value from red channel
      let correlation;
      if (state.engine.isWebGL2) {
        correlation = pixelData[pixelIndex]; // Direct float value
      } else {
        // Convert from 0-255 to 0-1 range
        correlation = pixelData[pixelIndex] / 255.0;
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        maxX = x;
        maxY = y;
      }
    }
  }
  
  // Apply sub-pixel interpolation for higher accuracy
  const subPixelResult = applySubPixelInterpolation(pixelData, maxX, maxY, width, height, state.engine.isWebGL2);
  
  // Convert back to normalized coordinates
  const finalX = (minX + subPixelResult.x) / canvasWidth;
  const finalY = (minY + subPixelResult.y) / canvasHeight;
  
  return {
    x: finalX,
    y: finalY,
    correlation: maxCorrelation
  };
};

/**
 * Apply sub-pixel interpolation using quadratic fitting
 * Improves landmark accuracy beyond pixel-level precision
 */
const applySubPixelInterpolation = (pixelData, maxX, maxY, width, height, isFloat) => {
  // Ensure we have neighbors for interpolation
  if (maxX === 0 || maxX === width - 1 || maxY === 0 || maxY === height - 1) {
    return { x: maxX, y: maxY };
  }
  
  // Get neighboring correlation values
  const getPixelValue = (x, y) => {
    const index = (y * width + x) * 4;
    return isFloat ? pixelData[index] : pixelData[index] / 255.0;
  };
  
  // 3x3 neighborhood around maximum
  const c00 = getPixelValue(maxX - 1, maxY - 1);
  const c10 = getPixelValue(maxX, maxY - 1);
  const c20 = getPixelValue(maxX + 1, maxY - 1);
  const c01 = getPixelValue(maxX - 1, maxY);
  const c11 = getPixelValue(maxX, maxY);     // Center (maximum)
  const c21 = getPixelValue(maxX + 1, maxY);
  const c02 = getPixelValue(maxX - 1, maxY + 1);
  const c12 = getPixelValue(maxX, maxY + 1);
  const c22 = getPixelValue(maxX + 1, maxY + 1);
  
  // Quadratic interpolation in X direction
  const dx1 = (c21 - c01) * 0.5;  // First derivative
  const dx2 = c21 - 2 * c11 + c01; // Second derivative
  let subPixelX = 0;
  if (Math.abs(dx2) > 1e-6) {
    subPixelX = -dx1 / dx2;
    // Clamp to reasonable range
    subPixelX = Math.max(-0.5, Math.min(0.5, subPixelX));
  }
  
  // Quadratic interpolation in Y direction
  const dy1 = (c12 - c10) * 0.5;  // First derivative
  const dy2 = c12 - 2 * c11 + c10; // Second derivative
  let subPixelY = 0;
  if (Math.abs(dy2) > 1e-6) {
    subPixelY = -dy1 / dy2;
    // Clamp to reasonable range
    subPixelY = Math.max(-0.5, Math.min(0.5, subPixelY));
  }
  
  return {
    x: maxX + subPixelX,
    y: maxY + subPixelY
  };
};