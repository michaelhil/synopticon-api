/**
 * Shader Pipeline - High-performance processing pipeline for computer vision operations
 * Manages sequential WebGL operations with optimized state management
 */

export const createShaderPipeline = (webglEngine) => {
  const state = {
    engine: webglEngine,
    gl: webglEngine.gl,
    stages: [],
    framebuffers: new Map(),
    currentStage: 0
  };

  const addStage = (stage) => {
    state.stages.push(stage);
    return { addStage, createFramebuffer, execute, getFramebuffer, cleanup };
  };

  const createFramebuffer = (name, width, height) => {
    const gl = state.gl;
    
    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    
    // Create color attachment texture
    const colorTexture = state.engine.textures.createTexture(
      `${name}_color`,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    
    // Attach texture to framebuffer
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      colorTexture,
      0
    );
    
    // Check framebuffer completeness
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer '${name}' is not complete`);
    }
    
    // Store framebuffer info
    state.framebuffers.set(name, {
      framebuffer,
      colorTexture,
      width,
      height
    });
    
    // Reset to default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    return framebuffer;
  };

  const execute = (inputData, outputTarget = null) => {
    const gl = state.gl;
    
    // Setup initial state
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    
    let currentInput = inputData;
    
    // Execute each stage in sequence
    for (let i = 0; i < state.stages.length; i++) {
      state.currentStage = i;
      const stage = state.stages[i];
      
      // Set render target
      if (i === state.stages.length - 1 && !outputTarget) {
        // Final stage, render to canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      } else {
        // Intermediate stage, render to framebuffer
        const targetName = stage.outputTarget || `stage_${i}`;
        const fbInfo = state.framebuffers.get(targetName);
        
        if (!fbInfo) {
          throw new Error(`Output target '${targetName}' not found for stage ${i}`);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbInfo.framebuffer);
        gl.viewport(0, 0, fbInfo.width, fbInfo.height);
      }
      
      // Execute stage
      currentInput = stage.execute(currentInput, { gl: state.gl, engine: state.engine });
    }
    
    return currentInput;
  };

  const getFramebuffer = (name) => {
    return state.framebuffers.get(name);
  };

  const cleanup = () => {
    // Cleanup framebuffers
    for (const [name, fbInfo] of state.framebuffers) {
      state.gl.deleteFramebuffer(fbInfo.framebuffer);
      // Textures are cleaned up by TextureManager
    }
    state.framebuffers.clear();
    
    // Cleanup stages
    state.stages.forEach(stage => {
      if (stage.cleanup) {
        stage.cleanup();
      }
    });
    state.stages = [];
  };

  return {
    addStage,
    createFramebuffer,
    execute,
    getFramebuffer,
    cleanup
  };
};

/**
 * Base pipeline stage factory function
 */
export const createPipelineStage = (name, programName) => {
  const state = {
    name,
    programName,
    uniforms: {},
    outputTarget: null
  };

  const setUniform = (name, value) => {
    state.uniforms[name] = value;
    return { setUniform, setOutputTarget, execute, cleanup };
  };

  const setOutputTarget = (target) => {
    state.outputTarget = target;
    return { setUniform, setOutputTarget, execute, cleanup };
  };

  const execute = (input, pipeline) => {
    const gl = pipeline.gl;
    const engine = pipeline.engine;
    
    // Use shader program
    const programInfo = engine.useProgram(state.programName);
    
    // Set uniforms
    setUniforms(programInfo, pipeline);
    
    // Setup geometry (full-screen quad)
    setupGeometry(programInfo, engine);
    
    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    return getOutput(pipeline);
  };

  const setUniforms = (programInfo, pipeline) => {
    const gl = pipeline.gl;
    
    // Set custom uniforms
    for (const [name, value] of Object.entries(state.uniforms)) {
      const location = programInfo.uniforms[name];
      if (location === undefined) continue;
      
      if (typeof value === 'number') {
        gl.uniform1f(location, value);
      } else if (value instanceof Array) {
        if (value.length === 2) {
          gl.uniform2fv(location, value);
        } else if (value.length === 3) {
          gl.uniform3fv(location, value);
        } else if (value.length === 4) {
          gl.uniform4fv(location, value);
        }
      }
    }
  };

  const setupGeometry = (programInfo, engine) => {
    const gl = engine.gl;
    
    // Full-screen quad vertices
    const vertices = new Float32Array([
      -1, -1,  0, 0,  // bottom-left
       1, -1,  1, 0,  // bottom-right
      -1,  1,  0, 1,  // top-left
       1,  1,  1, 1   // top-right
    ]);
    
    // Create or get quad buffer
    const buffer = engine.buffers.getBuffer('fullscreen_quad', vertices);
    
    // Setup attributes
    const positionLoc = programInfo.attributes.a_position;
    const texCoordLoc = programInfo.attributes.a_texCoord;
    
    if (positionLoc !== undefined) {
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
    }
    
    if (texCoordLoc !== undefined) {
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);
    }
  };

  const getOutput = (pipeline) => {
    // Default: return current framebuffer texture
    if (state.outputTarget) {
      const fbInfo = pipeline.getFramebuffer ? pipeline.getFramebuffer(state.outputTarget) : null;
      return fbInfo ? fbInfo.colorTexture : null;
    }
    return null;
  };

  const cleanup = () => {
    // Override in specific stage implementations if needed
  };

  return {
    name: state.name,
    programName: state.programName,
    setUniform,
    setOutputTarget,
    execute,
    cleanup
  };
};