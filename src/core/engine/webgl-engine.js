/**
 * Core WebGL2 Engine - Zero dependency WebGL management system
 * Handles context initialization, shader compilation, and resource management
 */

export const createWebGLEngine = (canvas) => {
  const state = {
    canvas,
    gl: null,
    programs: new Map(),
    buffers: null,
    textures: null,
    isInitialized: false,
    isWebGL2: false,
    ext_texture_float: null,
    ext_texture_half_float: null
  };

  const init = () => {
    // Try WebGL2 first, fallback to WebGL1
    state.gl = state.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });

    if (!state.gl) {
      // Fallback to WebGL1
      state.gl = state.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });
      
      if (!state.gl) {
        throw new Error('WebGL not supported');
      }
      
      state.isWebGL2 = false;
    } else {
      state.isWebGL2 = true;
    }

    // Get extensions
    state.ext_texture_float = state.gl.getExtension('OES_texture_float');
    state.ext_texture_half_float = state.gl.getExtension('OES_texture_half_float');

    state.isInitialized = true;
    return state.gl;
  };

  const compileShader = (type, source) => {
    const shader = state.gl.createShader(type);
    state.gl.shaderSource(shader, source);
    state.gl.compileShader(shader);

    if (!state.gl.getShaderParameter(shader, state.gl.COMPILE_STATUS)) {
      const error = state.gl.getShaderInfoLog(shader);
      state.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  };

  const createShaderProgram = (vertexShaderSource, fragmentShaderSource, name) => {
    const vertexShader = compileShader(state.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(state.gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = state.gl.createProgram();
    state.gl.attachShader(program, vertexShader);
    state.gl.attachShader(program, fragmentShader);
    state.gl.linkProgram(program);

    if (!state.gl.getProgramParameter(program, state.gl.LINK_STATUS)) {
      throw new Error(`Program linking failed: ${  state.gl.getProgramInfoLog(program)}`);
    }

    const uniforms = getUniformLocations(program);
    const attributes = getAttributeLocations(program);

    const programInfo = {
      program,
      uniforms,
      attributes
    };

    if (name) {
      state.programs.set(name, programInfo);
    }

    // Cleanup
    state.gl.deleteShader(vertexShader);
    state.gl.deleteShader(fragmentShader);

    return programInfo;
  };

  const getUniformLocations = (program) => {
    const {gl} = state;
    const uniforms = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      const location = gl.getUniformLocation(program, uniformInfo.name);
      uniforms[uniformInfo.name] = location;
    }
    
    return uniforms;
  };

  const getAttributeLocations = (program) => {
    const {gl} = state;
    const attributes = {};
    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    
    for (let i = 0; i < attributeCount; i++) {
      const attributeInfo = gl.getActiveAttrib(program, i);
      const location = gl.getAttribLocation(program, attributeInfo.name);
      attributes[attributeInfo.name] = location;
    }
    
    return attributes;
  };

  const getProgram = (name) => {
    return state.programs.get(name);
  };

  const useProgram = (name) => {
    const programInfo = state.programs.get(name);
    if (!programInfo) {
      throw new Error(`Shader program '${name}' not found`);
    }
    
    state.gl.useProgram(programInfo.program);
    return programInfo;
  };

  // Initialize the engine
  init();

  return {
    gl: state.gl,
    canvas: state.canvas,
    isWebGL2: state.isWebGL2,
    isInitialized: state.isInitialized,
    
    // Shader program management
    compileShader,
    createShaderProgram,
    getProgram,
    useProgram,
    
    // Resource managers
    buffers: createBufferManager(state.gl),
    textures: createTextureManager(state.gl),
    
    // Context information
    getContextInfo: () => ({
      version: state.isWebGL2 ? 2 : 1,
      vendor: state.gl.getParameter(state.gl.VENDOR),
      renderer: state.gl.getParameter(state.gl.RENDERER),
      maxTextureSize: state.gl.getParameter(state.gl.MAX_TEXTURE_SIZE),
      extensions: {
        textureFloat: !!state.ext_texture_float,
        textureHalfFloat: !!state.ext_texture_half_float
      }
    })
  };
};

/**
 * Buffer Manager - Efficient buffer creation and management
 */
const createBufferManager = (gl) => {
  const state = {
    gl,
    buffers: new Map()
  };

  const getBuffer = (name) => {
    const bufferInfo = state.buffers.get(name);
    return bufferInfo ? bufferInfo.buffer : null;
  };

  const cleanup = () => {
    for (const [, bufferInfo] of state.buffers) {
      gl.deleteBuffer(bufferInfo.buffer);
    }
    state.buffers.clear();
  };

  return {
    getBuffer,
    cleanup
  };
};

/**
 * Texture Manager - Efficient texture creation and management
 */
const createTextureManager = (gl) => {
  const state = {
    gl,
    textures: new Map(),
    activeTextureUnit: 0
  };

  const createTexture = (name, width, height, format = null, type = null, data = null) => {
    const glContext = state.gl;
    
    // Set defaults based on WebGL version
    if (!format) {
      format = glContext.RGBA;
    }
    if (!type) {
      type = glContext.UNSIGNED_BYTE;
    }

    const texture = glContext.createTexture();
    glContext.bindTexture(glContext.TEXTURE_2D, texture);
    
    // Set texture parameters for computer vision (no filtering)
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
    
    // Upload texture data
    glContext.texImage2D(glContext.TEXTURE_2D, 0, format, width, height, 0, format, type, data);
    
    state.textures.set(name, {
      texture,
      width,
      height,
      format,
      type
    });
    
    return texture;
  };

  const updateTexture = (name, data, width = null, height = null) => {
    const textureInfo = state.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture '${name}' not found`);
    }
    
    const glContext = state.gl;
    glContext.bindTexture(glContext.TEXTURE_2D, textureInfo.texture);
    
    const w = width || textureInfo.width;
    const h = height || textureInfo.height;
    
    glContext.texSubImage2D(glContext.TEXTURE_2D, 0, 0, 0, w, h, textureInfo.format, textureInfo.type, data);
  };

  const bindTexture = (name, unit = 0) => {
    const textureInfo = state.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture '${name}' not found`);
    }
    
    const glContext = state.gl;
    glContext.activeTexture(glContext.TEXTURE0 + unit);
    glContext.bindTexture(glContext.TEXTURE_2D, textureInfo.texture);
    state.activeTextureUnit = unit;
    
    return unit;
  };

  const getTexture = (name) => {
    return state.textures.get(name);
  };

  const cleanup = () => {
    for (const [, textureInfo] of state.textures) {
      state.gl.deleteTexture(textureInfo.texture);
    }
    state.textures.clear();
  };

  return {
    createTexture,
    updateTexture,
    bindTexture,
    getTexture,
    cleanup
  };
};