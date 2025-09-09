/**
 * Object factory registration and management for memory pool
 */

export const createFactoryManager = (state) => {
  
  // Register default object factories
  const registerDefaultFactories = () => {
    // Float32Array factory
    state.factories.set('Float32Array', (size) => new Float32Array(size));
    
    // Uint8Array factory
    state.factories.set('Uint8Array', (size) => new Uint8Array(size));
    
    // Canvas factory
    state.factories.set('Canvas', (width, height) => {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      }
      return null;
    });
    
    // ImageData factory
    state.factories.set('ImageData', (width, height) => {
      if (typeof ImageData !== 'undefined') {
        return new ImageData(width, height);
      }
      // Fallback for Node.js or unsupported environments
      return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      };
    });
    
    // OffscreenCanvas factory (if available)
    if (typeof OffscreenCanvas !== 'undefined') {
      state.factories.set('OffscreenCanvas', (width, height) => 
        new OffscreenCanvas(width, height)
      );
    }
    
    // Generic object factory
    state.factories.set('Object', (template) => ({ ...template }));
    
    // Buffer factory
    state.factories.set('ArrayBuffer', (size) => new ArrayBuffer(size));
  };
  
  // Register custom factory
  const registerFactory = (type, factory) => {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for type '${type}' must be a function`);
    }
    
    state.factories.set(type, factory);
    console.log(`📦 Registered factory for type: ${type}`);
  };
  
  // Get factory for type
  const getFactory = (type) => {
    return state.factories.get(type);
  };
  
  // Get all registered factories
  const getRegisteredTypes = () => {
    return Array.from(state.factories.keys());
  };
  
  return {
    registerDefaultFactories,
    registerFactory,
    getFactory,
    getRegisteredTypes
  };
};
