/**
 * Performance Testing Framework
 * Comprehensive performance monitoring and benchmarking for face analysis engine
 */

import { ErrorCategory, ErrorSeverity, createErrorHandler } from './error-handler.js';

// Performance test categories
export const TestCategory = {
  INITIALIZATION: 'initialization',
  DETECTION: 'detection',
  LANDMARK: 'landmark',
  WEBGL: 'webgl',
  MEMORY: 'memory',
  OVERALL: 'overall'
};

// Performance thresholds (in milliseconds)
export const PerformanceThresholds = {
  TARGET_FRAME_TIME: 16.67, // 60 FPS target
  WARNING_FRAME_TIME: 33.33, // 30 FPS warning
  CRITICAL_FRAME_TIME: 50.0, // 20 FPS critical
  
  TARGET_DETECTION_TIME: 10.0, // Sub-10ms detection target
  WARNING_DETECTION_TIME: 20.0,
  CRITICAL_DETECTION_TIME: 50.0,
  
  TARGET_LANDMARK_TIME: 5.0, // Sub-5ms landmark target
  WARNING_LANDMARK_TIME: 15.0,
  CRITICAL_LANDMARK_TIME: 30.0,
  
  TARGET_INITIALIZATION_TIME: 1000.0, // 1 second initialization
  WARNING_INITIALIZATION_TIME: 3000.0,
  CRITICAL_INITIALIZATION_TIME: 5000.0
};

/**
 * Creates a comprehensive performance testing system
 */
export const createPerformanceTester = (config = {}) => {
  const errorHandler = createErrorHandler({
    logLevel: ErrorSeverity.INFO,
    enableConsole: true,
    enableCollection: true
  });

  const state = {
    config: {
      enableRealTime: true,
      enableBenchmarks: true,
      enableMemoryTracking: true,
      sampleSize: 100,
      warmupFrames: 10,
      ...config
    },
    
    // Performance metrics storage
    metrics: {
      frameTime: [],
      detectionTime: [],
      landmarkTime: [],
      initializationTime: [],
      memoryUsage: [],
      gpuMemory: []
    },
    
    // Real-time monitoring
    currentFrame: 0,
    startTime: null,
    lastFrameTime: null,
    
    // Benchmark results
    benchmarkResults: new Map(),
    
    // Memory tracking
    memoryBaseline: null,
    gcThreshold: 100 * 1024 * 1024, // 100MB
    
    isActive: false
  };

  const start = () => {
    state.isActive = true;
    state.startTime = performance.now();
    state.currentFrame = 0;
    
    // Establish memory baseline
    if (state.config.enableMemoryTracking && performance.memory) {
      state.memoryBaseline = performance.memory.usedJSHeapSize;
    }
    
    errorHandler.handleError(
      'Performance monitoring started',
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.INFO,
      { 
        memoryBaseline: state.memoryBaseline,
        config: state.config
      }
    );
  };

  const stop = () => {
    state.isActive = false;
    
    const totalTime = performance.now() - state.startTime;
    const avgFrameTime = state.metrics.frameTime.length > 0 
      ? state.metrics.frameTime.reduce((a, b) => a + b, 0) / state.metrics.frameTime.length
      : 0;
    
    errorHandler.handleError(
      `Performance monitoring stopped - Total: ${totalTime.toFixed(2)}ms, Avg Frame: ${avgFrameTime.toFixed(2)}ms`,
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.INFO,
      { 
        totalFrames: state.currentFrame,
        avgFrameTime,
        totalTime
      }
    );
  };

  const recordFrameTime = (frameTime) => {
    if (!state.isActive) return;
    
    state.currentFrame++;
    
    // Skip warmup frames
    if (state.currentFrame <= state.config.warmupFrames) {
      return;
    }
    
    // Record frame time
    state.metrics.frameTime.push(frameTime);
    
    // Maintain sample size limit
    if (state.metrics.frameTime.length > state.config.sampleSize) {
      state.metrics.frameTime.shift();
    }
    
    // Check thresholds and warn if necessary
    if (frameTime > PerformanceThresholds.CRITICAL_FRAME_TIME) {
      errorHandler.handleError(
        `Critical frame time detected: ${frameTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.ERROR,
        { frameTime, frameNumber: state.currentFrame }
      );
    } else if (frameTime > PerformanceThresholds.WARNING_FRAME_TIME) {
      errorHandler.handleError(
        `Slow frame detected: ${frameTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.WARNING,
        { frameTime, frameNumber: state.currentFrame }
      );
    }
  };

  const recordDetectionTime = (detectionTime) => {
    if (!state.isActive) return;
    
    state.metrics.detectionTime.push(detectionTime);
    
    if (state.metrics.detectionTime.length > state.config.sampleSize) {
      state.metrics.detectionTime.shift();
    }
    
    if (detectionTime > PerformanceThresholds.CRITICAL_DETECTION_TIME) {
      errorHandler.handleError(
        `Critical detection time: ${detectionTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.ERROR,
        { detectionTime }
      );
    } else if (detectionTime > PerformanceThresholds.WARNING_DETECTION_TIME) {
      errorHandler.handleError(
        `Slow detection: ${detectionTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.WARNING,
        { detectionTime }
      );
    }
  };

  const recordLandmarkTime = (landmarkTime) => {
    if (!state.isActive) return;
    
    state.metrics.landmarkTime.push(landmarkTime);
    
    if (state.metrics.landmarkTime.length > state.config.sampleSize) {
      state.metrics.landmarkTime.shift();
    }
    
    if (landmarkTime > PerformanceThresholds.CRITICAL_LANDMARK_TIME) {
      errorHandler.handleError(
        `Critical landmark time: ${landmarkTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.ERROR,
        { landmarkTime }
      );
    }
  };

  const recordInitializationTime = (initTime) => {
    state.metrics.initializationTime.push(initTime);
    
    if (initTime > PerformanceThresholds.CRITICAL_INITIALIZATION_TIME) {
      errorHandler.handleError(
        `Critical initialization time: ${initTime.toFixed(2)}ms`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.ERROR,
        { initTime }
      );
    }
  };

  const trackMemoryUsage = () => {
    if (!state.config.enableMemoryTracking || !performance.memory) {
      return null;
    }
    
    const memInfo = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      timestamp: performance.now()
    };
    
    state.metrics.memoryUsage.push(memInfo);
    
    // Check for memory leaks
    if (state.memoryBaseline && memInfo.used > state.memoryBaseline + state.gcThreshold) {
      errorHandler.handleError(
        `Memory usage increased significantly: ${((memInfo.used - state.memoryBaseline) / 1024 / 1024).toFixed(2)}MB`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING,
        { 
          baseline: state.memoryBaseline,
          current: memInfo.used,
          increase: memInfo.used - state.memoryBaseline
        }
      );
    }
    
    // Warn if approaching memory limit
    if (memInfo.used > memInfo.limit * 0.8) {
      errorHandler.handleError(
        `Memory usage approaching limit: ${(memInfo.used / memInfo.limit * 100).toFixed(1)}%`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING,
        memInfo
      );
    }
    
    return memInfo;
  };

  const runBenchmark = async (name, testFunction, iterations = 10) => {
    errorHandler.handleError(
      `Starting benchmark: ${name} (${iterations} iterations)`,
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.INFO
    );
    
    const results = {
      name,
      iterations,
      times: [],
      memory: [],
      errors: 0,
      startTime: performance.now()
    };
    
    // Warmup run
    try {
      await testFunction();
    } catch (error) {
      errorHandler.handleError(
        `Benchmark warmup failed for ${name}: ${error.message}`,
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.WARNING
      );
    }
    
    // Run benchmark iterations
    for (let i = 0; i < iterations; i++) {
      const memBefore = trackMemoryUsage();
      const startTime = performance.now();
      
      try {
        await testFunction();
        const duration = performance.now() - startTime;
        results.times.push(duration);
        
        const memAfter = trackMemoryUsage();
        if (memBefore && memAfter) {
          results.memory.push(memAfter.used - memBefore.used);
        }
        
      } catch (error) {
        results.errors++;
        errorHandler.handleError(
          `Benchmark iteration ${i + 1} failed for ${name}: ${error.message}`,
          ErrorCategory.PERFORMANCE,
          ErrorSeverity.WARNING
        );
      }
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    results.totalTime = performance.now() - results.startTime;
    
    // Calculate statistics
    if (results.times.length > 0) {
      const sortedTimes = [...results.times].sort((a, b) => a - b);
      results.stats = {
        min: sortedTimes[0],
        max: sortedTimes[sortedTimes.length - 1],
        mean: results.times.reduce((a, b) => a + b, 0) / results.times.length,
        median: sortedTimes[Math.floor(sortedTimes.length / 2)],
        p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
        p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
      };
    }
    
    state.benchmarkResults.set(name, results);
    
    errorHandler.handleError(
      `Benchmark completed: ${name} - Mean: ${results.stats?.mean?.toFixed(2)}ms, Errors: ${results.errors}`,
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.INFO,
      { benchmarkResults: results.stats }
    );
    
    return results;
  };

  const getRealtimeStats = () => {
    if (state.metrics.frameTime.length === 0) {
      return null;
    }
    
    const recentFrames = state.metrics.frameTime.slice(-30); // Last 30 frames
    const recentDetections = state.metrics.detectionTime.slice(-30);
    const recentLandmarks = state.metrics.landmarkTime.slice(-30);
    
    const calculateStats = (arr) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: arr.reduce((a, b) => a + b, 0) / arr.length,
        median: sorted[Math.floor(sorted.length / 2)]
      };
    };
    
    const memInfo = trackMemoryUsage();
    
    return {
      fps: recentFrames.length > 0 ? 1000 / (recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length) : 0,
      frameTime: calculateStats(recentFrames),
      detectionTime: calculateStats(recentDetections),
      landmarkTime: calculateStats(recentLandmarks),
      memory: memInfo,
      frameCount: state.currentFrame,
      uptime: state.startTime ? performance.now() - state.startTime : 0
    };
  };

  const generateReport = () => {
    const stats = getRealtimeStats();
    const benchmarks = Object.fromEntries(state.benchmarkResults);
    
    const report = {
      timestamp: new Date().toISOString(),
      runtime: stats?.uptime || 0,
      frameCount: state.currentFrame,
      
      performance: {
        realtime: stats,
        benchmarks,
        thresholds: PerformanceThresholds
      },
      
      compliance: {
        frameTimeTarget: stats?.frameTime?.mean ? stats.frameTime.mean <= PerformanceThresholds.TARGET_FRAME_TIME : null,
        detectionTimeTarget: stats?.detectionTime?.mean ? stats.detectionTime.mean <= PerformanceThresholds.TARGET_DETECTION_TIME : null,
        landmarkTimeTarget: stats?.landmarkTime?.mean ? stats.landmarkTime.mean <= PerformanceThresholds.TARGET_LANDMARK_TIME : null
      },
      
      memory: {
        baseline: state.memoryBaseline,
        current: stats?.memory,
        samples: state.metrics.memoryUsage.length
      },
      
      errors: errorHandler.getStatistics()
    };
    
    return report;
  };

  const reset = () => {
    // Clear all metrics
    Object.keys(state.metrics).forEach(key => {
      state.metrics[key] = [];
    });
    
    // Clear benchmark results
    state.benchmarkResults.clear();
    
    // Reset counters
    state.currentFrame = 0;
    state.startTime = null;
    state.memoryBaseline = null;
    state.isActive = false;
    
    errorHandler.handleError(
      'Performance tester reset',
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.INFO
    );
  };

  return {
    // Control
    start,
    stop,
    reset,
    
    // Recording
    recordFrameTime,
    recordDetectionTime,
    recordLandmarkTime,
    recordInitializationTime,
    trackMemoryUsage,
    
    // Benchmarking
    runBenchmark,
    
    // Analysis
    getRealtimeStats,
    generateReport,
    
    // State access
    get isActive() { return state.isActive; },
    get frameCount() { return state.currentFrame; },
    get benchmarkResults() { return new Map(state.benchmarkResults); }
  };
};

// Global performance tester instance
export const GlobalPerformanceTester = createPerformanceTester();

// Convenience functions
export const {recordFrameTime} = GlobalPerformanceTester;
export const {recordDetectionTime} = GlobalPerformanceTester;
export const {recordLandmarkTime} = GlobalPerformanceTester;
export const {getRealtimeStats} = GlobalPerformanceTester;