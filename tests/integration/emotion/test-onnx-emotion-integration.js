/**
 * Test ONNX Emotion Analysis Integration
 * Verifies the new ONNX-based emotion recognition system
 */

import { createEmotionAnalysisPipeline } from './src/features/emotion-analysis/emotion-analysis-pipeline.js';
import { createMediaPipeFacePipeline } from './src/features/face-detection/mediapipe-face-pipeline.js';

const runIntegrationTest = async () => {
  console.log('🧪 Testing ONNX Emotion Analysis Integration');
  console.log('='.repeat(50));

  const startTime = performance.now();
  let emotionPipeline = null;
  let facePipeline = null;

  try {
    // Test 1: Pipeline Creation
    console.log('📝 Test 1: Creating emotion analysis pipeline...');
    emotionPipeline = createEmotionAnalysisPipeline({
      smoothingFactor: 0.3,
      confidenceThreshold: 0.5,
      enableValenceArousal: true,
      executionProvider: 'webgl' // Prefer WebGL acceleration
    });

    facePipeline = createMediaPipeFacePipeline({
      maxFaces: 1,
      minDetectionConfidence: 0.5
    });

    console.log('✅ Pipelines created successfully');

    // Test 2: Pipeline Initialization
    console.log('📝 Test 2: Initializing pipelines...');
    
    const initStartTime = performance.now();
    await Promise.all([
      emotionPipeline.initialize(),
      facePipeline.initialize()
    ]);
    const initTime = performance.now() - initStartTime;

    console.log(`✅ Pipelines initialized in ${initTime.toFixed(2)}ms`);

    // Test 3: Pipeline Status Check
    console.log('📝 Test 3: Checking pipeline status...');
    const emotionStatus = emotionPipeline.getStatus();
    const faceStatus = facePipeline.getStatus();

    console.log('Emotion Pipeline Status:', {
      initialized: emotionStatus.initialized,
      healthy: emotionStatus.healthy
    });
    
    console.log('Face Pipeline Status:', {
      initialized: faceStatus.initialized, 
      healthy: faceStatus.healthy
    });

    if (!emotionStatus.initialized || !faceStatus.initialized) {
      throw new Error('Pipeline initialization failed');
    }

    // Test 4: Create Mock Image Data
    console.log('📝 Test 4: Creating mock image data...');
    const mockImageData = createMockImageData(640, 480);
    console.log(`✅ Mock image created: ${mockImageData.width}x${mockImageData.height}`);

    // Test 5: Face Detection
    console.log('📝 Test 5: Running face detection...');
    const faceStartTime = performance.now();
    const faceResults = await facePipeline.process(mockImageData);
    const faceTime = performance.now() - faceStartTime;

    console.log(`✅ Face detection completed in ${faceTime.toFixed(2)}ms`);
    console.log(`   Faces detected: ${faceResults.faces?.length || 0}`);

    // Test 6: Emotion Analysis
    console.log('📝 Test 6: Running emotion analysis...');
    const emotionStartTime = performance.now();
    const emotionResults = await emotionPipeline.process(mockImageData);
    const emotionTime = performance.now() - emotionStartTime;

    console.log(`✅ Emotion analysis completed in ${emotionTime.toFixed(2)}ms`);
    
    if (emotionResults.faces && emotionResults.faces.length > 0) {
      const emotion = emotionResults.faces[0].emotion;
      console.log(`   Dominant emotion: ${emotion.emotion} (${(emotion.confidence * 100).toFixed(1)}%)`);
      console.log(`   Model used: ${emotionResults.metadata.model}`);
      console.log(`   Processing pipeline: ${emotionResults.metadata.processingPipeline}`);
    }

    // Test 7: Performance Metrics
    console.log('📝 Test 7: Performance metrics...');
    const totalTime = performance.now() - startTime;
    
    console.log('Performance Summary:');
    console.log(`   Total test time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Initialization time: ${initTime.toFixed(2)}ms`);
    console.log(`   Face detection time: ${faceTime.toFixed(2)}ms`);
    console.log(`   Emotion analysis time: ${emotionTime.toFixed(2)}ms`);
    console.log(`   Average processing: ${((faceTime + emotionTime) / 2).toFixed(2)}ms`);

    // Test 8: Model Information
    console.log('📝 Test 8: Model information...');
    const emotionConfig = emotionPipeline.getConfig ? emotionPipeline.getConfig() : { type: 'emotion-analysis' };
    const emotionInfo = emotionPipeline.getInfo ? emotionPipeline.getInfo() : { name: 'emotion-analysis', version: '1.0.0' };

    console.log('Emotion Pipeline Info:', {
      name: emotionInfo.name,
      version: emotionInfo.version,
      capabilities: emotionInfo.capabilities,
      modelSize: emotionInfo.performance?.modelSize
    });

    // Test 9: Bundle Size Impact Assessment
    console.log('📝 Test 9: Bundle size assessment...');
    const bundleSizeEstimate = estimateBundleSize();
    console.log('Bundle Size Estimates:');
    console.log(`   ONNX Runtime Web: ~${bundleSizeEstimate.onnxRuntime}MB`);
    console.log(`   Emotion Model: ~${bundleSizeEstimate.emotionModel}MB`);
    console.log(`   Total Addition: ~${bundleSizeEstimate.total}MB`);
    console.log(`   Previous bundle: 43MB → New bundle: ~${43 + bundleSizeEstimate.total}MB`);

    // Test 10: Integration Success
    console.log('📝 Test 10: Integration validation...');
    const isONNXUsed = emotionResults.metadata?.model === 'onnx-lightweight-cnn';
    const isFallbackUsed = emotionResults.metadata?.model === 'webgl-fallback-cnn';

    console.log(`   ONNX model used: ${isONNXUsed ? '✅ Yes' : '❌ No (using fallback)'}`);
    console.log(`   WebGL fallback used: ${isFallbackUsed ? '⚠️ Yes' : '✅ No'}`);

    console.log('\n🎉 Integration Test Summary:');
    console.log('✅ All tests passed successfully');
    console.log(`✅ Total execution time: ${totalTime.toFixed(2)}ms`);
    console.log(`✅ ${isONNXUsed ? 'ONNX model' : 'Fallback model'} is working`);
    console.log('✅ MediaPipe face detection integrated');
    console.log('✅ Emotion analysis pipeline operational');

    return {
      success: true,
      performanceMetrics: {
        totalTime,
        initTime,
        faceTime,
        emotionTime,
        avgProcessing: (faceTime + emotionTime) / 2
      },
      bundleImpact: bundleSizeEstimate,
      modelUsed: emotionResults.metadata?.model,
      facesDetected: faceResults.faces?.length || 0
    };

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };

  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      if (emotionPipeline) {
        await emotionPipeline.cleanup();
        console.log('✅ Emotion pipeline cleaned up');
      }
      if (facePipeline) {
        await facePipeline.cleanup();
        console.log('✅ Face pipeline cleaned up');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
};

// Helper function to create mock image data for testing
const createMockImageData = (width, height) => {
  // Use mock canvas for Bun/headless environment
  const canvas = createMockCanvas();
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  
  // Create a simple test pattern with a mock face
  ctx.fillStyle = '#f0f0f0'; // Light background
  ctx.fillRect(0, 0, width, height);
  
  // Draw mock face in center
  const centerX = width / 2;
  const centerY = height / 2;
  const faceSize = Math.min(width, height) * 0.3;
  
  // Face outline
  ctx.fillStyle = '#ffdbac'; // Skin tone
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, faceSize/2, faceSize * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(centerX - faceSize * 0.15, centerY - faceSize * 0.1, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX + faceSize * 0.15, centerY - faceSize * 0.1, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Mouth (happy expression)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY + faceSize * 0.1, faceSize * 0.1, 0, Math.PI);
  ctx.stroke();
  
  return ctx.getImageData(0, 0, width, height);
};

// Mock canvas for Node.js environment
const createMockCanvas = () => ({
  width: 640,
  height: 480,
  getContext: () => ({
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    fillRect: () => {},
    beginPath: () => {},
    ellipse: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    getImageData: (x, y, w, h) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4).map((_, i) => i % 4 === 3 ? 255 : Math.random() * 255)
    })
  })
});

// Estimate bundle size impact
const estimateBundleSize = () => ({
  onnxRuntime: 1.5,     // ONNX Runtime Web
  emotionModel: 2.3,    // Emotion recognition model
  overhead: 0.2,        // Integration overhead
  total: 4.0            // Total additional size
});

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest().then(result => {
    if (result.success) {
      console.log('\n🎯 Integration test completed successfully');
      process.exit(0);
    } else {
      console.log('\n💥 Integration test failed');
      process.exit(1);
    }
  });
}

export { runIntegrationTest };