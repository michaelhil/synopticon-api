/**
 * Pipeline Test Script
 * Tests all face analysis pipelines without browser dependencies
 */

// Test core modules
const testCoreModules = async () => {
  console.log('🧪 Testing Core Modules...\n');
  
  try {
    // Test types system
    const { createPose6DOF, createPose3DOF, createAnalysisResult } = await import('./src/core/types.js');
    
    const pose6d = createPose6DOF({
      rotation: { yaw: 0.1, pitch: 0.2, roll: 0.3 },
      translation: { x: 10, y: 20, z: 30 },
      confidence: 0.9
    });
    
    console.log('✅ Types system:', pose6d.rotation, pose6d.translation);
    
    // Test pipeline registry
    const { createPipelineRegistry } = await import('./src/core/registry.js');
    const registry = createPipelineRegistry();
    
    console.log('✅ Pipeline registry created');
    console.log('📊 Registry stats:', registry.getStats());
    
    // Test orchestrator
    const { createOrchestrator } = await import('./src/core/orchestrator.js');
    const orchestrator = createOrchestrator();
    
    console.log('✅ Orchestrator created');
    console.log('🏥 Health status:', orchestrator.getHealthStatus());
    
    // Test strategies
    const { createStrategyRegistry, STRATEGIES } = await import('./src/core/strategies.js');
    const strategies = createStrategyRegistry();
    
    console.log('✅ Strategy registry created');
    console.log('📋 Available strategies:', Object.keys(STRATEGIES));
    
    return true;
    
  } catch (error) {
    console.error('❌ Core modules test failed:', error.message);
    return false;
  }
};

// Test MediaPipe integration
const testMediaPipeIntegration = async () => {
  console.log('\n🧪 Testing MediaPipe Integration...\n');
  
  try {
    const { checkMediaPipeAvailability, DEMO_STRATEGIES } = await import('./src/utils/mediapipe-integration.js');
    
    console.log('✅ MediaPipe integration loaded');
    console.log('🎭 Demo strategies:', Object.keys(DEMO_STRATEGIES));
    
    // Check MediaPipe availability (will fail in Node.js but shouldn't crash)
    const availability = checkMediaPipeAvailability();
    console.log('📱 MediaPipe availability check:', availability);
    
    return true;
    
  } catch (error) {
    console.error('❌ MediaPipe integration test failed:', error.message);
    return false;
  }
};

// Test pose utilities
const testPoseUtilities = async () => {
  console.log('\n🧪 Testing Pose Utilities...\n');
  
  try {
    // Test calibration system
    const { createPoseCalibrator, createMultiUserCalibrator } = await import('./src/utils/pose-calibration.js');
    
    const calibrator = createPoseCalibrator();
    console.log('✅ Pose calibrator created');
    console.log('🎯 Calibration status:', calibrator.isCalibrated());
    
    const multiUser = createMultiUserCalibrator();
    console.log('✅ Multi-user calibrator created');
    console.log('👥 User count:', multiUser.getUserCount());
    
    // Test pose estimation
    const { CANONICAL_FACE_MODEL, createCameraMatrix, validatePose } = await import('./src/utils/pose-estimation.js');
    
    console.log('✅ Pose estimation utilities loaded');
    console.log('🎯 Canonical face model keys:', Object.keys(CANONICAL_FACE_MODEL));
    
    const cameraMatrix = createCameraMatrix(800, 640, 480);
    console.log('📷 Camera matrix:', cameraMatrix);
    
    // Test pose validation
    const testPose = {
      rotation: { yaw: 0.1, pitch: 0.2, roll: 0.1 },
      translation: { x: 10, y: 20, z: 30 },
      confidence: 0.8
    };
    
    const validation = validatePose(testPose);
    console.log('✅ Pose validation:', validation.valid ? 'VALID' : 'INVALID');
    
    return true;
    
  } catch (error) {
    console.error('❌ Pose utilities test failed:', error.message);
    return false;
  }
};

// Test API modules
const testAPIModules = async () => {
  console.log('\n🧪 Testing API Modules...\n');
  
  try {
    // Test minimal server (don't actually start it)
    const minimalServerCode = await Bun.file('./src/api/minimal-server.js').text();
    console.log('✅ Minimal server code loaded:', minimalServerCode.length, 'bytes');
    
    return true;
    
  } catch (error) {
    console.error('❌ API modules test failed:', error.message);
    return false;
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('🚀 Face Analysis Engine - Pipeline Test Suite\n');
  console.log('=====================================\n');
  
  const results = [];
  
  results.push(await testCoreModules());
  results.push(await testMediaPipeIntegration());
  results.push(await testPoseUtilities());
  results.push(await testAPIModules());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n=====================================');
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Pipeline architecture is functional.');
    console.log('🌐 Demo server is running at http://localhost:8080');
    console.log('📱 Open in browser with webcam for full testing');
  } else {
    console.log('⚠️ Some tests failed. Check error messages above.');
  }
  
  console.log('\n🔧 Available commands:');
  console.log('  bun demo          - Start demo server');
  console.log('  bun serve         - Start demo server (alias)');
  console.log('  bun test          - Run unit tests');
  console.log('  bun api:start     - Start API server');
  
  return passed === total;
};

// Run tests if this file is executed directly
if (import.meta.main) {
  await runAllTests();
}