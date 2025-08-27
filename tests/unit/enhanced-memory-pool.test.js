/**
 * Enhanced Memory Pool Tests
 * Testing the improved memory pooling system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEnhancedMemoryPool } from '../../src/shared/utils/enhanced-memory-pool.js';

describe('Enhanced Memory Pool', () => {
  let memoryPool;
  
  beforeEach(() => {
    memoryPool = createEnhancedMemoryPool({
      maxPoolSize: 10,
      maxObjectAge: 1000,
      cleanupInterval: 0, // Disable automatic cleanup for tests
      enableTracking: true,
      enableMetrics: true
    });
    
    memoryPool.initialize();
  });
  
  afterEach(() => {
    if (memoryPool) {
      memoryPool.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default factories', () => {
      expect(memoryPool).toBeDefined();
      expect(memoryPool.initialize).toBeTypeOf('function');
      expect(memoryPool.acquire).toBeTypeOf('function');
      expect(memoryPool.release).toBeTypeOf('function');
    });

    it('should register custom factories', () => {
      const customFactory = (size) => new Array(size);
      memoryPool.registerFactory('CustomArray', customFactory);
      
      const obj = memoryPool.acquire('CustomArray', 5);
      expect(Array.isArray(obj)).toBe(true);
      expect(obj.length).toBe(5);
      
      memoryPool.release(obj);
    });
  });

  describe('Object Pooling', () => {
    it('should create and reuse FaceResult objects', () => {
      const face1 = memoryPool.acquire('FaceResult');
      expect(face1).toBeDefined();
      expect(face1._pooled).toBe(true);
      expect(face1.confidence).toBe(0);
      
      // Modify object
      face1.confidence = 0.95;
      face1.id = 'face_123';
      
      // Release back to pool
      memoryPool.release(face1);
      
      // Acquire again - should be same object but reset
      const face2 = memoryPool.acquire('FaceResult');
      expect(face2).toBe(face1); // Same object reference
      expect(face2.confidence).toBe(0); // Reset to initial state
      expect(face2.id).toBeNull(); // Reset to initial state
      
      memoryPool.release(face2);
    });

    it('should create and reuse TranscriptResult objects', () => {
      const transcript1 = memoryPool.acquire('TranscriptResult');
      expect(transcript1).toBeDefined();
      expect(transcript1._pooled).toBe(true);
      expect(transcript1.text).toBe('');
      
      transcript1.text = 'Hello world';
      transcript1.confidence = 0.9;
      
      memoryPool.release(transcript1);
      
      const transcript2 = memoryPool.acquire('TranscriptResult');
      expect(transcript2).toBe(transcript1);
      expect(transcript2.text).toBe(''); // Reset
      expect(transcript2.confidence).toBe(0); // Reset
      
      memoryPool.release(transcript2);
    });

    it('should track reuse statistics', () => {
      const initialStats = memoryPool.getStats();
      expect(initialStats.allocations).toBe(0);
      expect(initialStats.reuseHits).toBe(0);
      
      // First acquisition - creates new object
      const obj1 = memoryPool.acquire('FaceResult');
      let stats = memoryPool.getStats();
      expect(stats.allocations).toBe(1);
      expect(stats.reuseHits).toBe(0);
      
      memoryPool.release(obj1);
      
      // Second acquisition - reuses object
      const obj2 = memoryPool.acquire('FaceResult');
      stats = memoryPool.getStats();
      expect(stats.allocations).toBe(1); // Still 1
      expect(stats.reuseHits).toBe(1); // Now 1
      expect(stats.efficiency).toBe('100.0%');
      
      memoryPool.release(obj2);
    });
  });

  describe('Typed Array Pooling', () => {
    it('should pool Float32Array objects', () => {
      const array1 = memoryPool.acquireArray('Float32Array', 1024);
      expect(array1).toBeInstanceOf(Float32Array);
      expect(array1.length).toBe(1024);
      
      // Fill with data
      array1.fill(42);
      expect(array1[0]).toBe(42);
      
      memoryPool.releaseArray(array1);
      
      // Reacquire - should be same array but cleared
      const array2 = memoryPool.acquireArray('Float32Array', 1024);
      expect(array2).toBe(array1);
      expect(array2[0]).toBe(0); // Should be cleared
      
      memoryPool.releaseArray(array2);
    });

    it('should pool different array types', () => {
      const float32 = memoryPool.acquireArray('Float32Array', 100);
      const uint8 = memoryPool.acquireArray('Uint8Array', 200);
      const uint16 = memoryPool.acquireArray('Uint16Array', 300);
      
      expect(float32).toBeInstanceOf(Float32Array);
      expect(uint8).toBeInstanceOf(Uint8Array);
      expect(uint16).toBeInstanceOf(Uint16Array);
      
      expect(float32.length).toBe(100);
      expect(uint8.length).toBe(200);
      expect(uint16.length).toBe(300);
      
      memoryPool.releaseArray(float32);
      memoryPool.releaseArray(uint8);
      memoryPool.releaseArray(uint16);
    });
  });

  describe('Canvas Pooling', () => {
    it('should pool canvas objects in browser environment', () => {
      // Mock DOM for testing
      global.document = {
        createElement: (tag) => {
          if (tag === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: (type) => ({
                clearRect: () => {}
              })
            };
          }
        }
      };
      
      const canvas1 = memoryPool.acquireCanvas(640, 480);
      expect(canvas1).toBeDefined();
      expect(canvas1.width).toBe(640);
      expect(canvas1.height).toBe(480);
      
      memoryPool.releaseCanvas(canvas1);
      
      const canvas2 = memoryPool.acquireCanvas(640, 480);
      expect(canvas2).toBe(canvas1); // Reused
      
      memoryPool.releaseCanvas(canvas2);
      
      // Different size should create new canvas
      const canvas3 = memoryPool.acquireCanvas(800, 600);
      expect(canvas3).not.toBe(canvas1);
      
      memoryPool.releaseCanvas(canvas3);
    });
  });

  describe('Memory Management', () => {
    it('should respect pool size limits', () => {
      const pool = createEnhancedMemoryPool({
        maxPoolSize: 2
      });
      pool.initialize();
      
      // Create and release 5 objects
      const objects = [];
      for (let i = 0; i < 5; i++) {
        objects.push(pool.acquire('FaceResult'));
      }
      
      objects.forEach(obj => pool.release(obj));
      
      // Pool should only keep 2 objects
      const stats = pool.getStats();
      expect(stats.totalPoolSize).toBeLessThanOrEqual(2);
      
      pool.cleanup();
    });

    it('should perform cleanup of aged objects', async () => {
      const pool = createEnhancedMemoryPool({
        maxObjectAge: 50, // 50ms
        cleanupInterval: 0
      });
      pool.initialize();
      
      const obj = pool.acquire('FaceResult');
      pool.release(obj);
      
      let stats = pool.getStats();
      expect(stats.totalPoolSize).toBe(1);
      
      // Wait for object to age
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Manual cleanup
      pool.performCleanup();
      
      stats = pool.getStats();
      expect(stats.totalPoolSize).toBe(0); // Aged object removed
      
      pool.cleanup();
    });

    it('should clear pools when requested', () => {
      // Create multiple objects
      const objs = [];
      for (let i = 0; i < 5; i++) {
        objs.push(memoryPool.acquire('FaceResult'));
        objs.push(memoryPool.acquireArray('Float32Array', 100));
      }
      
      // Release all
      objs.forEach((obj, i) => {
        if (i % 2 === 0) {
          memoryPool.release(obj);
        } else {
          memoryPool.releaseArray(obj);
        }
      });
      
      let stats = memoryPool.getStats();
      expect(stats.totalPoolSize).toBeGreaterThan(0);
      
      // Clear 50% of pools
      memoryPool.clearPools(0.5);
      
      const newSize = memoryPool.getTotalPoolSize();
      expect(newSize).toBeLessThan(stats.totalPoolSize);
      
      // Clear all pools
      memoryPool.clearPools(1.0);
      expect(memoryPool.getTotalPoolSize()).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track detailed statistics', () => {
      // Create mix of objects
      const face = memoryPool.acquire('FaceResult');
      const transcript = memoryPool.acquire('TranscriptResult');
      const array = memoryPool.acquireArray('Float32Array', 512);
      
      const stats = memoryPool.getStats();
      
      expect(stats.allocations).toBe(3);
      expect(stats.reuseHits).toBe(0);
      expect(stats.totalPoolSize).toBe(0); // Nothing released yet
      expect(stats.efficiency).toBe('0.0%');
      expect(stats.poolSizes).toBeDefined();
      
      // Release and reacquire
      memoryPool.release(face);
      memoryPool.release(transcript);
      memoryPool.releaseArray(array);
      
      const face2 = memoryPool.acquire('FaceResult');
      const finalStats = memoryPool.getStats();
      
      expect(finalStats.reuseHits).toBe(1);
      expect(finalStats.efficiency).toBe('33.3%'); // 1 reuse out of 3 total acquisitions
      
      memoryPool.release(face2);
    });

    it('should provide pool size breakdown', () => {
      memoryPool.acquire('FaceResult');
      memoryPool.acquire('TranscriptResult'); 
      memoryPool.acquireArray('Float32Array', 256);
      memoryPool.acquireCanvas(320, 240);
      
      const obj1 = memoryPool.acquire('FaceResult');
      const obj2 = memoryPool.acquire('TranscriptResult');
      const array1 = memoryPool.acquireArray('Float32Array', 256);
      const canvas1 = memoryPool.acquireCanvas(320, 240);
      
      memoryPool.release(obj1);
      memoryPool.release(obj2);
      memoryPool.releaseArray(array1);
      memoryPool.releaseCanvas(canvas1);
      
      const stats = memoryPool.getStats();
      expect(stats.poolSizes).toBeDefined();
      
      // Should have entries for each pool type
      const poolKeys = Object.keys(stats.poolSizes);
      expect(poolKeys.length).toBeGreaterThan(0);
      
      // Each pool entry should have type and size
      Object.values(stats.poolSizes).forEach(poolInfo => {
        expect(poolInfo).toHaveProperty('type');
        expect(poolInfo).toHaveProperty('size');
        expect(typeof poolInfo.size).toBe('number');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown object types', () => {
      expect(() => {
        memoryPool.acquire('UnknownType');
      }).toThrow('No factory registered for type: UnknownType');
    });

    it('should handle releasing untracked objects gracefully', () => {
      const mockObj = { test: true };
      
      // Should not throw but should warn
      expect(() => {
        memoryPool.release(mockObj);
      }).not.toThrow();
    });

    it('should handle releasing untracked arrays gracefully', () => {
      const mockArray = new Float32Array(10);
      
      expect(() => {
        memoryPool.releaseArray(mockArray);
      }).not.toThrow();
    });
  });

  describe('Default Memory Pool', () => {
    it('should provide a default instance', () => {
      expect(defaultMemoryPool).toBeDefined();
      expect(defaultMemoryPool.acquire).toBeTypeOf('function');
      expect(defaultMemoryPool.release).toBeTypeOf('function');
    });
  });
});