/**
 * WebGL Context Resource Management
 * Handles WebGL context pooling and lifecycle management
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';

export const createWebGLManager = (state, poolConfig, canvasManager) => {
  const getWebGLContext = (type = 'webgl2', width = 640, height = 480) => {
    const contextPool = state.webglContextPool.get(type) || [];
    let contextInfo = null;
    
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
      const context = canvas.getContext(type) || canvas.getContext('webgl');
      
      if (!context) {
        canvasManager.returnCanvas(canvas);
        throw new Error(`Failed to create ${type} context`);
      }
      
      contextInfo = {
        context,
        canvas,
        type,
        inUse: true,
        created: Date.now()
      };
      
      state.metricsData.contextsCreated++;
    }
    
    state.metricsData.totalAllocations++;
    return contextInfo;
  };
  
  const returnWebGLContext = (contextInfo) => {
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
        `Error returning WebGL context to pool: ${error.message}`,
        ErrorCategory.WEBGL,
        ErrorSeverity.WARNING
      );
    }
  };
  
  return { getWebGLContext, returnWebGLContext };
};