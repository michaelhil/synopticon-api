/**
 * WebGL Context Resource Management
 * Handles WebGL context pooling and lifecycle management
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'
import type { CanvasManager, MockCanvas } from './resource-pool-canvas.js'

export type WebGLContextType = 'webgl' | 'webgl2';

export interface WebGLContextInfo {
  context: WebGLRenderingContext | WebGL2RenderingContext;
  canvas: HTMLCanvasElement | MockCanvas;
  type: WebGLContextType;
  inUse: boolean;
  created: number;
}

export interface WebGLPoolState {
  webglContextPool: Map<WebGLContextType, WebGLContextInfo[]>;
  metricsData: {
    contextsCreated: number;
    contextsReused: number;
    totalAllocations: number;
    totalDeallocations: number;
    [key: string]: number;
  };
}

export interface WebGLPoolConfig {
  maxWebGLContexts: number;
  [key: string]: unknown;
}

export interface WebGLManager {
  getWebGLContext: (type?: WebGLContextType, width?: number, height?: number) => WebGLContextInfo;
  returnWebGLContext: (contextInfo: WebGLContextInfo) => void;
}

export const createWebGLManager = (
  state: WebGLPoolState, 
  poolConfig: WebGLPoolConfig, 
  canvasManager: CanvasManager
): WebGLManager => {
  const getWebGLContext = (
    type: WebGLContextType = 'webgl2', 
    width: number = 640, 
    height: number = 480
  ): WebGLContextInfo => {
    const contextPool = state.webglContextPool.get(type) || [];
    let contextInfo: WebGLContextInfo | null = null;
    
    // Try to reuse existing context
    for (let i = 0; i < contextPool.length; i++) {
      const pooledInfo = contextPool[i];
      if (!pooledInfo.inUse && 
          pooledInfo.canvas.width >= width && 
          pooledInfo.canvas.height >= height) {
        contextInfo = contextPool.splice(i, 1)[0];
        contextInfo.inUse = true;
        
        // Resize canvas if needed
        if (contextInfo.canvas.width !== width || contextInfo.canvas.height !== height) {
          contextInfo.canvas.width = width;
          contextInfo.canvas.height = height;
          contextInfo.context.viewport(0, 0, width, height);
        }
        
        state.metricsData.contextsReused++;
        break;
      }
    }
    
    // Create new context if none available
    if (!contextInfo) {
      const canvas = canvasManager.getCanvas(width, height);
      
      // For HTMLCanvasElement
      if ('getContext' in canvas && typeof canvas.getContext === 'function') {
        const context = (canvas as HTMLCanvasElement).getContext(type) || 
                       (canvas as HTMLCanvasElement).getContext('webgl');
        
        if (!context) {
          canvasManager.returnCanvas(canvas);
          throw new Error(`Failed to create ${type} context`);
        }
        
        contextInfo = {
          context: context as WebGLRenderingContext | WebGL2RenderingContext,
          canvas,
          type,
          inUse: true,
          created: Date.now()
        };
      } else {
        // Mock canvas - not supported for WebGL
        canvasManager.returnCanvas(canvas);
        throw new Error('WebGL contexts require real canvas elements');
      }
      
      state.metricsData.contextsCreated++;
    }
    
    state.metricsData.totalAllocations++;
    return contextInfo;
  };
  
  const returnWebGLContext = (contextInfo: WebGLContextInfo): void => {
    if (!contextInfo) return;
    
    try {
      // Clear WebGL state
      const gl = contextInfo.context;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      contextInfo.inUse = false;
      
      // Return to pool if under limit
      const contextPool = state.webglContextPool.get(contextInfo.type) || [];
      if (contextPool.length < poolConfig.maxWebGLContexts) {
        contextPool.push(contextInfo);
        state.webglContextPool.set(contextInfo.type, contextPool);
      } else {
        // Pool full, clean up resources
        canvasManager.returnCanvas(contextInfo.canvas);
      }
      
      state.metricsData.totalDeallocations++;
    } catch (error) {
      handleError(
        `Error returning WebGL context to pool: ${(error as Error).message}`,
        ErrorCategory.WEBGL,
        ErrorSeverity.WARNING
      );
    }
  };
  
  return { getWebGLContext, returnWebGLContext };
};