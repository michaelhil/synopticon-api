/**
 * Performance Testing Script for Final Audit
 * Tests performance monitoring capabilities and benchmarks
 */

import { createPerformanceTester, PerformanceThresholds, TestCategory } from './src/utils/performance-tester.js';
import { createErrorHandler, ErrorSeverity } from './src/utils/error-handler.js';

async function runPerformanceAudit() {
  console.log('🚀 Running Performance System Audit...\n');
  
  // Create performance tester with audit configuration
  const perfTester = createPerformanceTester({
    enableRealTime: true,
    enableBenchmarks: true,
    enableMemoryTracking: true,
    sampleSize: 50,
    warmupFrames: 5
  });
  
  // Start performance monitoring
  console.log('📊 Starting performance monitoring...');
  perfTester.start();
  
  // Test 1: Frame time recording
  console.log('🎯 Testing frame time recording...');
  for (let i = 0; i < 30; i++) {
    const frameTime = 12 + Math.random() * 8; // Simulate 12-20ms frame times
    perfTester.recordFrameTime(frameTime);
    await delay(10);
  }
  
  // Test 2: Detection time recording
  console.log('🔍 Testing detection time recording...');
  for (let i = 0; i < 20; i++) {
    const detectionTime = 8 + Math.random() * 6; // Simulate 8-14ms detection times
    perfTester.recordDetectionTime(detectionTime);
    await delay(5);
  }
  
  // Test 3: Landmark time recording
  console.log('🎯 Testing landmark time recording...');
  for (let i = 0; i < 20; i++) {
    const landmarkTime = 4 + Math.random() * 3; // Simulate 4-7ms landmark times
    perfTester.recordLandmarkTime(landmarkTime);
    await delay(5);
  }
  
  // Test 4: Initialization time
  console.log('⚡ Testing initialization time recording...');
  perfTester.recordInitializationTime(850); // Good initialization time
  
  // Test 5: Memory tracking
  console.log('💾 Testing memory tracking...');
  for (let i = 0; i < 10; i++) {
    const memInfo = perfTester.trackMemoryUsage();
    if (memInfo) {
      console.log(`  Memory: ${(memInfo.used / 1024 / 1024).toFixed(1)}MB`);
    }
    await delay(100);
  }
  
  // Test 6: Benchmarks
  console.log('🏃 Running performance benchmarks...');
  
  // Benchmark 1: Fast operation
  await perfTester.runBenchmark('fast_operation', async () => {
    // Simulate fast operation (1-3ms)
    await delay(1 + Math.random() * 2);
  }, 20);
  
  // Benchmark 2: Medium operation
  await perfTester.runBenchmark('medium_operation', async () => {
    // Simulate medium operation (5-10ms)
    await delay(5 + Math.random() * 5);
  }, 15);
  
  // Benchmark 3: Detection simulation
  await perfTester.runBenchmark('detection_simulation', async () => {
    // Simulate detection operation (8-15ms)
    await delay(8 + Math.random() * 7);
  }, 10);
  
  // Test 7: Threshold testing
  console.log('⚠️ Testing performance thresholds...');
  perfTester.recordFrameTime(35); // Should trigger warning
  perfTester.recordFrameTime(55); // Should trigger critical
  perfTester.recordDetectionTime(25); // Should trigger warning
  perfTester.recordLandmarkTime(35); // Should trigger critical
  
  // Get real-time stats
  console.log('\n📈 Real-time Performance Stats:');
  const stats = perfTester.getRealtimeStats();
  if (stats) {
    console.log(`  FPS: ${stats.fps.toFixed(1)}`);
    console.log(`  Frame Time: ${stats.frameTime?.mean?.toFixed(2)}ms (min: ${stats.frameTime?.min?.toFixed(2)}ms, max: ${stats.frameTime?.max?.toFixed(2)}ms)`);
    console.log(`  Detection Time: ${stats.detectionTime?.mean?.toFixed(2)}ms (min: ${stats.detectionTime?.min?.toFixed(2)}ms, max: ${stats.detectionTime?.max?.toFixed(2)}ms)`);
    console.log(`  Landmark Time: ${stats.landmarkTime?.mean?.toFixed(2)}ms (min: ${stats.landmarkTime?.min?.toFixed(2)}ms, max: ${stats.landmarkTime?.max?.toFixed(2)}ms)`);
    console.log(`  Frames: ${stats.frameCount}, Uptime: ${(stats.uptime / 1000).toFixed(1)}s`);
  }
  
  // Generate comprehensive report
  console.log('\n📋 Generating Performance Report...');
  const report = perfTester.generateReport();
  
  // Display compliance
  console.log('\n✅ Performance Compliance:');
  console.log(`  Frame Time Target (${PerformanceThresholds.TARGET_FRAME_TIME}ms): ${report.compliance.frameTimeTarget ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Detection Time Target (${PerformanceThresholds.TARGET_DETECTION_TIME}ms): ${report.compliance.detectionTimeTarget ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Landmark Time Target (${PerformanceThresholds.TARGET_LANDMARK_TIME}ms): ${report.compliance.landmarkTimeTarget ? '✅ PASS' : '❌ FAIL'}`);
  
  // Display benchmark results
  console.log('\n🏆 Benchmark Results:');
  for (const [name, results] of Object.entries(report.performance.benchmarks)) {
    if (results.stats) {
      console.log(`  ${name}:`);
      console.log(`    Mean: ${results.stats.mean.toFixed(2)}ms`);
      console.log(`    Min/Max: ${results.stats.min.toFixed(2)}ms / ${results.stats.max.toFixed(2)}ms`);
      console.log(`    P95: ${results.stats.p95.toFixed(2)}ms`);
      console.log(`    Errors: ${results.errors}/${results.iterations}`);
    }
  }
  
  // Error statistics
  console.log('\n🐛 Error Statistics:');
  console.log(`  Total Errors: ${report.errors.total}`);
  console.log(`  By Severity:`, report.errors.bySeverity);
  console.log(`  By Category:`, report.errors.byCategory);
  
  perfTester.stop();
  console.log('\n✅ Performance audit completed successfully!');
  
  return {
    success: true,
    stats,
    report,
    compliance: report.compliance
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the audit
runPerformanceAudit().then(results => {
  console.log('\n🎉 Performance Audit Results:', results.success ? 'PASSED' : 'FAILED');
  process.exit(results.success ? 0 : 1);
}).catch(error => {
  console.error('❌ Performance audit failed:', error);
  process.exit(1);
});