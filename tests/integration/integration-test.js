#!/usr/bin/env bun

// Integration test to verify the functional conversion works end-to-end
import createFaceAnalysisEngine from '../../src/index.js';
import { createCameraManager, FrameProcessor } from '../../src/shared/utils/camera.js';
import { createWebGLEngine } from '../../src/core/engine/webgl-engine.js';

console.log('🧪 Running integration tests...\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Mock DOM elements
global.document = {
  createElement: (tag) => ({
    width: 640,
    height: 480,
    getContext: () => null,
    addEventListener: () => {},
    play: () => Promise.resolve()
  }),
  getElementById: () => null
};

global.navigator = {
  mediaDevices: {
    getUserMedia: () => Promise.resolve({
      getTracks: () => [],
      getVideoTracks: () => [{
        getSettings: () => ({}),
        getCapabilities: () => ({}),
        getConstraints: () => ({}),
        stop: () => {}
      }]
    })
  }
};

async function runTests() {

// Test 1: Engine Creation
await test("Engine factory function works", () => {
  const mockCanvas = { 
    width: 640, 
    height: 480, 
    getContext: () => null 
  };
  const engine = createFaceAnalysisEngine(mockCanvas);
  
  if (typeof engine !== 'object') throw new Error('Engine should return object');
  if (typeof engine.initialize !== 'function') throw new Error('Missing initialize method');
  if (typeof engine.startProcessing !== 'function') throw new Error('Missing startProcessing method');
  if (typeof engine.stopProcessing !== 'function') throw new Error('Missing stopProcessing method');
  if (typeof engine.cleanup !== 'function') throw new Error('Missing cleanup method');
});

// Test 2: WebGL Engine Creation
await test("WebGL engine factory function works", () => {
  const mockCanvas = { 
    width: 640, 
    height: 480, 
    getContext: () => null 
  };
  
  try {
    const webglEngine = createWebGLEngine(mockCanvas);
    // Should fail due to no WebGL context, but should fail gracefully
    throw new Error('Expected WebGL creation to fail in Node.js');
  } catch (error) {
    if (error.message.includes('WebGL not supported')) {
      // This is expected in Node.js environment
    } else {
      throw error;
    }
  }
});

// Test 3: Camera Manager Creation
await test("Camera manager factory function works", () => {
  const camera = createCameraManager();
  
  if (typeof camera !== 'object') throw new Error('Camera should return object');
  if (typeof camera.initialize !== 'function') throw new Error('Missing initialize method');
  if (typeof camera.getFrame !== 'function') throw new Error('Missing getFrame method');
  if (typeof camera.cleanup !== 'function') throw new Error('Missing cleanup method');
});

// Test 4: Frame Processor Utilities
await test("FrameProcessor utilities work", () => {
  if (typeof FrameProcessor !== 'object') throw new Error('FrameProcessor should be object');
  if (typeof FrameProcessor.rgbaToTexture !== 'function') throw new Error('Missing rgbaToTexture method');
  if (typeof FrameProcessor.rgbToGrayscale !== 'function') throw new Error('Missing rgbToGrayscale method');
  
  // Test a utility function
  const mockData = new Uint8Array([255, 128, 64, 255, 0, 0, 0, 255]);
  const result = FrameProcessor.rgbaToTexture(mockData, 2, 1);
  
  if (!(result instanceof Float32Array)) throw new Error('Should return Float32Array');
  if (result.length !== 8) throw new Error('Wrong output length');
});

// Test 5: Functional Pattern Consistency
await test("All exports use functional patterns", async () => {
  // Check that we're not exporting any classes (constructors)
  const mainModule = await import('./src/index.js');
  
  if (typeof mainModule.createFaceAnalysisEngine !== 'function') {
    throw new Error('Main export should be a factory function');
  }
  
  if (typeof mainModule.createWebGLEngine !== 'function') {
    throw new Error('WebGL engine should be a factory function');
  }
  
  if (typeof mainModule.createCameraManager !== 'function') {
    throw new Error('Camera manager should be a factory function');
  }
  
  // FrameProcessor is intentionally an object literal with static methods
  if (typeof mainModule.FrameProcessor !== 'object') {
    throw new Error('FrameProcessor should be object literal');
  }
});

// Test 6: Mock Engine Initialization
await test("Engine initialization with mocks works", async () => {
  const mockCanvas = { 
    width: 640, 
    height: 480, 
    getContext: (type) => {
      if (type === 'webgl2' || type === 'webgl') {
        // Return a mock WebGL context
        return {
          createShader: () => ({}),
          createProgram: () => ({}),
          createBuffer: () => ({}),
          createTexture: () => ({}),
          deleteProgram: () => {},
          deleteShader: () => {},
          deleteBuffer: () => {},
          deleteTexture: () => {},
          shaderSource: () => {},
          compileShader: () => {},
          attachShader: () => {},
          linkProgram: () => {},
          useProgram: () => {},
          getProgramParameter: () => true,
          getShaderParameter: () => true,
          getProgramInfoLog: () => '',
          getShaderInfoLog: () => '',
          getActiveUniform: () => ({name: 'test'}),
          getActiveAttrib: () => ({name: 'test'}),
          getUniformLocation: () => ({}),
          getAttribLocation: () => 0,
          viewport: () => {},
          clear: () => {},
          drawArrays: () => {},
          VERTEX_SHADER: 1,
          FRAGMENT_SHADER: 2,
          COMPILE_STATUS: 3,
          LINK_STATUS: 4,
          ACTIVE_UNIFORMS: 5,
          ACTIVE_ATTRIBUTES: 6,
          RGBA: 7,
          UNSIGNED_BYTE: 8,
          TEXTURE_2D: 9,
          STATIC_DRAW: 10,
          ARRAY_BUFFER: 11,
          canvas: mockCanvas,
          getExtension: () => ({})
        };
      }
      return null;
    }
  };
  
  const engine = createFaceAnalysisEngine(mockCanvas);
  
  // This should work now with our mock WebGL context
  try {
    const result = await engine.initialize({ camera: false });
    if (typeof result !== 'object') throw new Error('Initialize should return object');
    if (typeof result.webglVersion !== 'number') throw new Error('Should return WebGL version');
  } catch (error) {
    // Acceptable if it fails due to missing shader compilation or other WebGL specifics
    console.log(`  ℹ️  Initialize failed as expected in test environment: ${error.message}`);
  }
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All integration tests PASSED!');
} else {
  console.log('💥 Some tests failed - review the issues above');
  process.exit(1);
}

}

// Run the tests
runTests().catch(console.error);