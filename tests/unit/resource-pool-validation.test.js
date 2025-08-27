/**
 * Resource Pool Validation Test
 * Ensures the existing resource pool still functions correctly
 */

import { describe, test, expect } from 'bun:test';

describe('Resource Pool Validation', () => {
  test('should maintain backward compatibility', async () => {
    const { createResourcePool } = await import('../../src/core/performance/resource-pool.js');
    
    const pool = createResourcePool({
      maxCanvasInstances: 10,
      maxWebGLContexts: 3
    });
    
    expect(pool).toBeDefined();
    expect(pool.getCanvas).toBeInstanceOf(Function);
    expect(pool.returnCanvas).toBeInstanceOf(Function);
    expect(pool.getWebGLContext).toBeInstanceOf(Function);
    expect(pool.returnWebGLContext).toBeInstanceOf(Function);
    
    // Test canvas pooling
    const canvas1 = pool.getCanvas(640, 480);
    expect(canvas1).toBeDefined();
    expect(canvas1.width).toBe(640);
    expect(canvas1.height).toBe(480);
    
    pool.returnCanvas(canvas1);
    
    // Should get the same canvas back
    const canvas2 = pool.getCanvas(640, 480);
    expect(canvas2).toBe(canvas1);
    
    // Test buffer pooling
    const buffer = pool.getImageBuffer(100, 100, 4);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBe(40000);
    
    pool.returnImageBuffer(buffer);
    
    // Cleanup
    pool.cleanup();
  });

  test('should integrate with new resource manager', async () => {
    const { getGlobalResourcePool } = await import('../../src/core/performance/resource-pool.js');
    const { getGlobalResourceManager } = await import('../../src/core/resources/resource-manager.js');
    
    const pool = getGlobalResourcePool();
    const manager = getGlobalResourceManager();
    
    expect(pool).toBeDefined();
    expect(manager).toBeDefined();
    expect(manager.resourcePool).toBeDefined();
    
    // Resource pool should be accessible through manager
    const canvas = manager.resourcePool.getCanvas(320, 240);
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    
    manager.resourcePool.returnCanvas(canvas);
  });
});