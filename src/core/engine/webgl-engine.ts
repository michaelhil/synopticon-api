/**
 * Core WebGL2 Engine - Zero dependency WebGL management system
 * Handles context initialization, shader compilation, and resource management
 */

export interface WebGLContextAttributes {
  alpha: boolean;
  antialias: boolean;
  depth: boolean;
  stencil: boolean;
  preserveDrawingBuffer: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
}

export interface ShaderProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
}

export interface BufferInfo {
  buffer: WebGLBuffer;
  [key: string]: unknown;
}

export interface TextureInfo {
  texture: WebGLTexture;
  width: number;
  height: number;
  format: number;
  type: number;
}

export interface WebGLContextInfo {
  version: number;
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  extensions: {
    textureFloat: boolean;
    textureHalfFloat: boolean;
  };
}

export interface BufferManager {
  getBuffer: (name: string) => WebGLBuffer | null;
  cleanup: () => void;
}

export interface TextureManager {
  createTexture: (
    name: string,
    width: number,
    height: number,
    format?: number | null,
    type?: number | null,
    data?: ArrayBufferView | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | null
  ) => WebGLTexture;
  updateTexture: (
    name: string,
    data: ArrayBufferView | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    width?: number | null,
    height?: number | null
  ) => void;
  bindTexture: (name: string, unit?: number) => number;
  getTexture: (name: string) => TextureInfo | undefined;
  cleanup: () => void;
}

export interface WebGLEngineInterface {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  isWebGL2: boolean;
  isInitialized: boolean;
  
  // Shader program management
  compileShader: (type: number, source: string) => WebGLShader;
  createShaderProgram: (vertexShaderSource: string, fragmentShaderSource: string, name?: string) => ShaderProgramInfo;
  getProgram: (name: string) => ShaderProgramInfo | undefined;
  useProgram: (name: string) => ShaderProgramInfo;
  
  // Resource managers
  buffers: BufferManager;
  textures: TextureManager;
  
  // Context information
  getContextInfo: () => WebGLContextInfo;
}

interface WebGLEngineState {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  programs: Map<string, ShaderProgramInfo>;
  buffers: BufferManager | null;
  textures: TextureManager | null;
  isInitialized: boolean;
  isWebGL2: boolean;
  ext_texture_float: OES_texture_float | null;
  ext_texture_half_float: OES_texture_half_float | null;
}

interface BufferManagerState {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  buffers: Map<string, BufferInfo>;
}

interface TextureManagerState {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  textures: Map<string, TextureInfo>;
  activeTextureUnit: number;
}

export const createWebGLEngine = (canvas: HTMLCanvasElement): WebGLEngineInterface => {
  const state: WebGLEngineState = {
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

  const init = (): WebGLRenderingContext | WebGL2RenderingContext => {
    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    };

    // Try WebGL2 first, fallback to WebGL1
    state.gl = state.canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext;

    if (!state.gl) {
      // Fallback to WebGL1
      state.gl = state.canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext;
      
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

  const compileShader = (type: number, source: string): WebGLShader => {
    const shader = state.gl!.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    state.gl!.shaderSource(shader, source);
    state.gl!.compileShader(shader);

    if (!state.gl!.getShaderParameter(shader, state.gl!.COMPILE_STATUS)) {
      const error = state.gl!.getShaderInfoLog(shader);
      state.gl!.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  };

  const createShaderProgram = (
    vertexShaderSource: string,
    fragmentShaderSource: string,
    name?: string
  ): ShaderProgramInfo => {
    const vertexShader = compileShader(state.gl!.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(state.gl!.FRAGMENT_SHADER, fragmentShaderSource);

    const program = state.gl!.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    state.gl!.attachShader(program, vertexShader);
    state.gl!.attachShader(program, fragmentShader);
    state.gl!.linkProgram(program);

    if (!state.gl!.getProgramParameter(program, state.gl!.LINK_STATUS)) {
      throw new Error(`Program linking failed: ${state.gl!.getProgramInfoLog(program)}`);
    }

    const uniforms = getUniformLocations(program);
    const attributes = getAttributeLocations(program);

    const programInfo: ShaderProgramInfo = {
      program,
      uniforms,
      attributes
    };

    if (name) {
      state.programs.set(name, programInfo);
    }

    // Cleanup
    state.gl!.deleteShader(vertexShader);
    state.gl!.deleteShader(fragmentShader);

    return programInfo;
  };

  const getUniformLocations = (program: WebGLProgram): Record<string, WebGLUniformLocation | null> => {
    const gl = state.gl!;
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = gl.getActiveUniform(program, i);
      if (uniformInfo) {
        const location = gl.getUniformLocation(program, uniformInfo.name);
        uniforms[uniformInfo.name] = location;
      }
    }
    
    return uniforms;
  };

  const getAttributeLocations = (program: WebGLProgram): Record<string, number> => {
    const gl = state.gl!;
    const attributes: Record<string, number> = {};
    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;
    
    for (let i = 0; i < attributeCount; i++) {
      const attributeInfo = gl.getActiveAttrib(program, i);
      if (attributeInfo) {
        const location = gl.getAttribLocation(program, attributeInfo.name);
        attributes[attributeInfo.name] = location;
      }
    }
    
    return attributes;
  };

  const getProgram = (name: string): ShaderProgramInfo | undefined => {
    return state.programs.get(name);
  };

  const useProgram = (name: string): ShaderProgramInfo => {
    const programInfo = state.programs.get(name);
    if (!programInfo) {
      throw new Error(`Shader program '${name}' not found`);
    }
    
    state.gl!.useProgram(programInfo.program);
    return programInfo;
  };

  // Initialize the engine
  const gl = init();

  // Create resource managers
  state.buffers = createBufferManager(gl);
  state.textures = createTextureManager(gl);

  return {
    gl: state.gl!,
    canvas: state.canvas,
    isWebGL2: state.isWebGL2,
    isInitialized: state.isInitialized,
    
    // Shader program management
    compileShader,
    createShaderProgram,
    getProgram,
    useProgram,
    
    // Resource managers
    buffers: state.buffers,
    textures: state.textures,
    
    // Context information
    getContextInfo: (): WebGLContextInfo => ({
      version: state.isWebGL2 ? 2 : 1,
      vendor: state.gl!.getParameter(state.gl!.VENDOR) as string,
      renderer: state.gl!.getParameter(state.gl!.RENDERER) as string,
      maxTextureSize: state.gl!.getParameter(state.gl!.MAX_TEXTURE_SIZE) as number,
      extensions: {
        textureFloat: Boolean(state.ext_texture_float),
        textureHalfFloat: Boolean(state.ext_texture_half_float)
      }
    })
  };
};

/**
 * Buffer Manager - Efficient buffer creation and management
 */
const createBufferManager = (gl: WebGLRenderingContext | WebGL2RenderingContext): BufferManager => {
  const state: BufferManagerState = {
    gl,
    buffers: new Map()
  };

  const getBuffer = (name: string): WebGLBuffer | null => {
    const bufferInfo = state.buffers.get(name);
    return bufferInfo ? bufferInfo.buffer : null;
  };

  const cleanup = (): void => {
    for (const [, bufferInfo] of state.buffers) {
      state.gl.deleteBuffer(bufferInfo.buffer);
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
const createTextureManager = (gl: WebGLRenderingContext | WebGL2RenderingContext): TextureManager => {
  const state: TextureManagerState = {
    gl,
    textures: new Map(),
    activeTextureUnit: 0
  };

  const createTexture = (
    name: string,
    width: number,
    height: number,
    format: number | null = null,
    type: number | null = null,
    data: ArrayBufferView | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | null = null
  ): WebGLTexture => {
    const glContext = state.gl;
    
    // Set defaults based on WebGL version
    const textureFormat = format ?? glContext.RGBA;
    const textureType = type ?? glContext.UNSIGNED_BYTE;

    const texture = glContext.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    glContext.bindTexture(glContext.TEXTURE_2D, texture);
    
    // Set texture parameters for computer vision (no filtering)
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
    
    // Upload texture data
    glContext.texImage2D(glContext.TEXTURE_2D, 0, textureFormat, width, height, 0, textureFormat, textureType, data);
    
    state.textures.set(name, {
      texture,
      width,
      height,
      format: textureFormat,
      type: textureType
    });
    
    return texture;
  };

  const updateTexture = (
    name: string,
    data: ArrayBufferView | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    width: number | null = null,
    height: number | null = null
  ): void => {
    const textureInfo = state.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture '${name}' not found`);
    }
    
    const glContext = state.gl;
    glContext.bindTexture(glContext.TEXTURE_2D, textureInfo.texture);
    
    const w = width ?? textureInfo.width;
    const h = height ?? textureInfo.height;
    
    glContext.texSubImage2D(glContext.TEXTURE_2D, 0, 0, 0, w, h, textureInfo.format, textureInfo.type, data);
  };

  const bindTexture = (name: string, unit: number = 0): number => {
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

  const getTexture = (name: string): TextureInfo | undefined => {
    return state.textures.get(name);
  };

  const cleanup = (): void => {
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