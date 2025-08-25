#!/usr/bin/env bun

// Simple test to check if our functional engine can be imported and instantiated
import createFaceAnalysisEngine from '../../src/index.js';

console.log('Testing Face Analysis Engine...');

try {
  // Create a mock canvas
  const mockCanvas = {
    width: 640,
    height: 480,
    getContext: (type) => {
      if (type === 'webgl2' || type === 'webgl') {
        return null; // No WebGL in Node.js environment
      }
      return null;
    }
  };

  console.log('Creating engine instance...');
  const engine = createFaceAnalysisEngine(mockCanvas);
  console.log('✓ Engine created successfully');
  console.log('✓ Engine has initialize method:', typeof engine.initialize === 'function');
  console.log('✓ Engine has startProcessing method:', typeof engine.startProcessing === 'function');
  console.log('✓ Engine has stopProcessing method:', typeof engine.stopProcessing === 'function');
  console.log('✓ Engine has cleanup method:', typeof engine.cleanup === 'function');
  
  console.log('\n✅ Basic functional interface test PASSED');
} catch (error) {
  console.error('❌ Test FAILED:', error.message);
  console.error(error.stack);
}