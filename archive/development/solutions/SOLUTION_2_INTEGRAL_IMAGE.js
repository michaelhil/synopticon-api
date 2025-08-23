/**
 * Solution 2: Real Integral Image Computation
 * Replaces placeholder with actual GPU-based integral image computation
 */

const computeIntegralImage = (inputTexture) => {
  const gl = state.engine.gl;
  const width = gl.canvas.width;
  const height = gl.canvas.height;
  
  // Create intermediate textures for two-pass computation
  const horizontalTexture = state.engine.textures.createTexture(
    'integral_horizontal',
    width,
    height,
    gl.RGBA,
    state.engine.isWebGL2 ? gl.FLOAT : gl.UNSIGNED_BYTE,
    null
  );
  
  const finalTexture = state.engine.textures.createTexture(
    'integral_final',
    width,
    height,
    gl.RGBA,
    state.engine.isWebGL2 ? gl.FLOAT : gl.UNSIGNED_BYTE,
    null
  );
  
  // Create framebuffers for rendering
  const horizontalFB = gl.createFramebuffer();
  const finalFB = gl.createFramebuffer();
  
  try {
    // PASS 1: Horizontal integral computation
    gl.bindFramebuffer(gl.FRAMEBUFFER, horizontalFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, horizontalTexture, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Horizontal framebuffer not complete');
    }
    
    // Use horizontal integral shader
    const horizontalProgram = state.engine.useProgram('integral_horizontal');
    
    // Set uniforms
    gl.uniform1i(horizontalProgram.uniforms.u_image, 0);
    gl.uniform2f(horizontalProgram.uniforms.u_resolution, width, height);
    
    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    
    // Setup geometry (fullscreen quad)
    setupFullscreenQuad(horizontalProgram);
    
    // Render horizontal pass
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // PASS 2: Vertical integral computation
    gl.bindFramebuffer(gl.FRAMEBUFFER, finalFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, finalTexture, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Final framebuffer not complete');
    }
    
    // Use vertical integral shader
    const verticalProgram = state.engine.useProgram('integral_vertical');
    
    // Set uniforms
    gl.uniform1i(verticalProgram.uniforms.u_image, 0);
    gl.uniform2f(verticalProgram.uniforms.u_resolution, width, height);
    
    // Bind horizontal result as input
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, horizontalTexture);
    
    // Setup geometry for vertical pass
    setupFullscreenQuad(verticalProgram);
    
    // Render vertical pass
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // Reset state
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    return finalTexture;
    
  } finally {
    // Cleanup framebuffers
    gl.deleteFramebuffer(horizontalFB);
    gl.deleteFramebuffer(finalFB);
  }
};

/**
 * Create optimized horizontal integral image shader
 * Computes running sum across each row
 */
const createHorizontalIntegralShader = () => {
  return state.engine.isWebGL2 ? `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    float sum = 0.0;
    
    // Compute horizontal integral (sum from left edge to current position)
    // This is done in a single pass by summing all pixels to the left
    for (int x = 0; x <= int(v_texCoord.x * u_resolution.x); x++) {
        vec2 sampleCoord = vec2(float(x) * texel.x, v_texCoord.y);
        
        // Sample grayscale value (assume input is already grayscale in red channel)
        float pixelValue = texture(u_image, sampleCoord).r;
        sum += pixelValue;
    }
    
    // Store sum in red channel for next pass
    fragColor = vec4(sum, sum, sum, 1.0);
}` : `
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
    vec2 texel = 1.0 / u_resolution;
    float sum = 0.0;
    
    // WebGL1 version with fixed loop bounds
    int maxX = int(v_texCoord.x * u_resolution.x);
    
    for (int x = 0; x < 2048; x++) {
        if (x > maxX) break;
        
        vec2 sampleCoord = vec2(float(x) * texel.x, v_texCoord.y);
        float pixelValue = texture2D(u_image, sampleCoord).r;
        sum += pixelValue;
    }
    
    gl_FragColor = vec4(sum, sum, sum, 1.0);
}`;
};

/**
 * Create optimized vertical integral image shader  
 * Computes running sum down each column using horizontal results
 */
const createVerticalIntegralShader = () => {
  return state.engine.isWebGL2 ? `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    float sum = 0.0;
    
    // Compute vertical integral using horizontal results
    // Sum from top edge to current position
    for (int y = 0; y <= int(v_texCoord.y * u_resolution.y); y++) {
        vec2 sampleCoord = vec2(v_texCoord.x, float(y) * texel.y);
        
        // Sample horizontal integral result
        float horizontalSum = texture(u_image, sampleCoord).r;
        sum += horizontalSum;
    }
    
    // Store final integral image value
    fragColor = vec4(sum, sum, sum, 1.0);
}` : `
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
    vec2 texel = 1.0 / u_resolution;
    float sum = 0.0;
    
    // WebGL1 version with fixed loop bounds
    int maxY = int(v_texCoord.y * u_resolution.y);
    
    for (int y = 0; y < 2048; y++) {
        if (y > maxY) break;
        
        vec2 sampleCoord = vec2(v_texCoord.x, float(y) * texel.y);
        float horizontalSum = texture2D(u_image, sampleCoord).r;
        sum += horizontalSum;
    }
    
    gl_FragColor = vec4(sum, sum, sum, 1.0);
}`;
};

/**
 * Setup fullscreen quad geometry for integral image passes
 */
const setupFullscreenQuad = (programInfo) => {
  const gl = state.engine.gl;
  
  // Full-screen quad vertices with texture coordinates
  const vertices = new Float32Array([
    -1, -1,  0, 0,  // bottom-left
     1, -1,  1, 0,  // bottom-right  
    -1,  1,  0, 1,  // top-left
     1,  1,  1, 1   // top-right
  ]);
  
  // Create or get quad buffer
  const buffer = state.engine.buffers.getBuffer('integral_quad', vertices);
  
  // Setup vertex attributes
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
 * Initialize integral image shaders in the engine
 * Call this during detector initialization
 */
const initializeIntegralImageShaders = () => {
  const vertexShader = getShaderSource('vertex_fullscreen', state.engine.isWebGL2);
  
  // Create horizontal pass shader
  const horizontalFragmentShader = createHorizontalIntegralShader();
  state.engine.createShaderProgram(
    vertexShader,
    horizontalFragmentShader,
    'integral_horizontal'
  );
  
  // Create vertical pass shader  
  const verticalFragmentShader = createVerticalIntegralShader();
  state.engine.createShaderProgram(
    vertexShader,
    verticalFragmentShader,
    'integral_vertical'
  );
};