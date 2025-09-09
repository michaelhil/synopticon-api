/**
 * Buffer Resource Management
 * Handles image buffers and typed arrays pooling
 */

export type TypedArrayType = 
  | 'Int8Array' 
  | 'Uint8Array' 
  | 'Uint8ClampedArray' 
  | 'Int16Array' 
  | 'Uint16Array' 
  | 'Int32Array' 
  | 'Uint32Array' 
  | 'Float32Array' 
  | 'Float64Array';

export type TypedArray = 
  | Int8Array 
  | Uint8Array 
  | Uint8ClampedArray 
  | Int16Array 
  | Uint16Array 
  | Int32Array 
  | Uint32Array 
  | Float32Array 
  | Float64Array;

export interface BufferPoolState {
  imageBufferPool: Map<string, Uint8Array[]>;
  typedArrayPool: Map<string, TypedArray[]>;
  metricsData: {
    buffersCreated: number;
    buffersReused: number;
    totalAllocations: number;
    totalDeallocations: number;
    [key: string]: number;
  };
}

export interface BufferPoolConfig {
  maxImageBuffers: number;
  maxTypedArrays: number;
  [key: string]: unknown;
}

export interface BufferManager {
  getImageBuffer: (width: number, height: number, channels?: number) => Uint8Array;
  returnImageBuffer: (buffer: Uint8Array, width: number, height: number, channels?: number) => void;
  getTypedArray: (type: TypedArrayType, size: number) => TypedArray;
  returnTypedArray: (array: TypedArray, type: TypedArrayType) => void;
}

export const createBufferManager = (
  state: BufferPoolState, 
  poolConfig: BufferPoolConfig
): BufferManager => {
  const getImageBuffer = (width: number, height: number, channels: number = 4): Uint8Array => {
    const size = width * height * channels;
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    let buffer = bufferPool.pop();
    
    if (!buffer) {
      buffer = new Uint8Array(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear buffer data
      buffer.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return buffer;
  };
  
  const returnImageBuffer = (
    buffer: Uint8Array, 
    width: number, 
    height: number, 
    channels: number = 4
  ): void => {
    if (!buffer) return;
    
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    if (bufferPool.length < poolConfig.maxImageBuffers) {
      bufferPool.push(buffer);
      state.imageBufferPool.set(sizeKey, bufferPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  const getTypedArray = (type: TypedArrayType, size: number): TypedArray => {
    const poolKey = `${type}_${size}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    let array = arrayPool.pop();
    
    if (!array) {
      const ArrayConstructor = globalThis[type] as any;
      if (!ArrayConstructor) {
        throw new Error(`Unknown typed array type: ${type}`);
      }
      array = new ArrayConstructor(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear array data
      array.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return array;
  };
  
  const returnTypedArray = (array: TypedArray, type: TypedArrayType): void => {
    if (!array) return;
    
    const poolKey = `${type}_${array.length}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    if (arrayPool.length < poolConfig.maxTypedArrays) {
      arrayPool.push(array);
      state.typedArrayPool.set(poolKey, arrayPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  return { 
    getImageBuffer, 
    returnImageBuffer, 
    getTypedArray, 
    returnTypedArray 
  };
};