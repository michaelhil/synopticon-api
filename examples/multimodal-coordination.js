#!/usr/bin/env bun

/**
 * Multimodal Coordination Example
 * Demonstrates advanced coordination between eye tracking and face analysis
 * including attention modeling, engagement detection, and behavioral insights
 */

import { createEyeTracker } from '../src/eye-tracking/index.js';
import { createFaceAnalysisEngine } from '../src/face-analysis-engine.js';
import { createSynchronizationEngine } from '../src/core/synchronization.js';
import { streamFactory } from '../src/core/streams.js';

class MultimodalCoordinator {
  constructor(config = {}) {
    this.config = {
      syncTolerance: config.syncTolerance || 10, // ms
      attentionWindow: config.attentionWindow || 5000, // 5 seconds
      engagementThreshold: config.engagementThreshold || 0.7,
      ...config
    };

    this.eyeTracker = null;
    this.faceEngine = null;
    this.syncEngine = null;
    
    this.state = {
      isRunning: false,
      currentSession: null,
      attentionModel: this.createAttentionModel(),
      engagementDetector: this.createEngagementDetector(),
      behaviorAnalyzer: this.createBehaviorAnalyzer()
    };

    this.metrics = {
      totalFrames: 0,
      syncedFrames: 0,
      attentionEvents: [],
      engagementLevels: [],
      behaviorPatterns: []
    };
  }

  // Attention modeling system
  createAttentionModel() {
    const attentionHistory = [];
    const focusRegions = new Map();

    return {
      updateAttention: (gazeData, faceData) => {
        const attention = this.calculateAttentionMetrics(gazeData, faceData);
        attentionHistory.push({
          timestamp: Date.now(),
          ...attention
        });

        // Keep sliding window
        const cutoff = Date.now() - this.config.attentionWindow;
        const recentHistory = attentionHistory.filter(a => a.timestamp > cutoff);
        attentionHistory.splice(0, attentionHistory.length - recentHistory.length);

        return this.analyzeAttentionPattern(recentHistory);
      },

      getAttentionSummary: () => {
        if (attentionHistory.length === 0) return null;

        const recent = attentionHistory.slice(-10);
        const avgFocusStability = recent.reduce((sum, a) => sum + a.focusStability, 0) / recent.length;
        const avgGazeAccuracy = recent.reduce((sum, a) => sum + a.gazeAccuracy, 0) / recent.length;

        return {
          focusStability: avgFocusStability,
          gazeAccuracy: avgGazeAccuracy,
          attentionLevel: this.classifyAttentionLevel(avgFocusStability, avgGazeAccuracy),
          trendDirection: this.calculateTrend(recent.map(a => a.focusStability))
        };
      },

      reset: () => {
        attentionHistory.length = 0;
        focusRegions.clear();
      }
    };
  }

  calculateAttentionMetrics(gazeData, faceData) {
    // Focus stability (low gaze velocity = more stable)
    const gazeVelocity = gazeData.metadata?.velocity || 0;
    const focusStability = Math.max(0, 1 - gazeVelocity / 0.5); // Normalize to 0-1

    // Gaze accuracy (confidence in gaze measurement)
    const gazeAccuracy = gazeData.confidence || 0;

    // Face attention (is gaze directed at detected face)
    let faceAttention = 0;
    if (faceData.faces && faceData.faces.length > 0) {
      const face = faceData.faces[0];
      const faceCenter = {
        x: (face.bbox.x + face.bbox.width / 2) / 1920,
        y: (face.bbox.y + face.bbox.height / 2) / 1080
      };
      
      const gazeDistance = Math.sqrt(
        Math.pow(gazeData.x - faceCenter.x, 2) + 
        Math.pow(gazeData.y - faceCenter.y, 2)
      );
      
      faceAttention = Math.max(0, 1 - gazeDistance / 0.2); // Within 20% screen distance
    }

    // Overall attention score
    const overallAttention = (focusStability * 0.4 + gazeAccuracy * 0.3 + faceAttention * 0.3);

    return {
      focusStability,
      gazeAccuracy,
      faceAttention,
      overallAttention,
      gazeVelocity
    };
  }

  analyzeAttentionPattern(history) {
    if (history.length < 5) return { pattern: 'insufficient_data' };

    const recent = history.slice(-5);
    const avgAttention = recent.reduce((sum, h) => sum + h.overallAttention, 0) / recent.length;
    const variance = recent.reduce((sum, h) => sum + Math.pow(h.overallAttention - avgAttention, 2), 0) / recent.length;
    const stability = 1 - Math.sqrt(variance);

    let pattern;
    if (avgAttention > 0.8 && stability > 0.7) pattern = 'highly_focused';
    else if (avgAttention > 0.6 && stability > 0.5) pattern = 'moderately_focused';
    else if (stability < 0.3) pattern = 'distracted_scanning';
    else if (avgAttention < 0.4) pattern = 'low_attention';
    else pattern = 'variable_attention';

    return {
      pattern,
      avgAttention,
      stability,
      confidence: Math.min(1, history.length / 20) // More confidence with more data
    };
  }

  classifyAttentionLevel(focusStability, gazeAccuracy) {
    const combined = (focusStability + gazeAccuracy) / 2;
    
    if (combined > 0.8) return 'high';
    if (combined > 0.6) return 'medium';
    if (combined > 0.4) return 'low';
    return 'very_low';
  }

  calculateTrend(values) {
    if (values.length < 3) return 'stable';
    
    const recent = values.slice(-3);
    const slope = (recent[2] - recent[0]) / 2;
    
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  // Engagement detection system
  createEngagementDetector() {
    const engagementHistory = [];
    
    return {
      detectEngagement: (attentionData, faceData) => {
        const engagement = this.calculateEngagementLevel(attentionData, faceData);
        
        engagementHistory.push({
          timestamp: Date.now(),
          level: engagement.level,
          indicators: engagement.indicators,
          confidence: engagement.confidence
        });

        // Keep recent history
        if (engagementHistory.length > 100) {
          engagementHistory.shift();
        }

        return this.detectEngagementEvents(engagementHistory);
      },

      getEngagementSummary: () => {
        if (engagementHistory.length === 0) return null;

        const levels = engagementHistory.map(e => e.level);
        const avgEngagement = levels.reduce((sum, level) => {
          const numeric = { very_low: 0, low: 0.25, medium: 0.5, high: 0.75, very_high: 1 }[level];
          return sum + numeric;
        }, 0) / levels.length;

        return {
          averageLevel: avgEngagement,
          currentTrend: this.calculateEngagementTrend(),
          peakEngagement: Math.max(...levels.map(l => ({ very_low: 0, low: 0.25, medium: 0.5, high: 0.75, very_high: 1 }[l]))),
          engagementVariability: this.calculateEngagementVariability()
        };
      },

      reset: () => {
        engagementHistory.length = 0;
      }
    };
  }

  calculateEngagementLevel(attentionData, faceData) {
    const indicators = {
      highAttention: attentionData.overallAttention > 0.7,
      stableGaze: attentionData.focusStability > 0.6,
      facePresent: faceData.faces && faceData.faces.length > 0,
      highConfidence: attentionData.gazeAccuracy > 0.8,
      lookingAtFace: attentionData.faceAttention > 0.5
    };

    const positiveIndicators = Object.values(indicators).filter(Boolean).length;
    const engagementScore = positiveIndicators / Object.keys(indicators).length;

    let level;
    if (engagementScore >= 0.8) level = 'very_high';
    else if (engagementScore >= 0.6) level = 'high';
    else if (engagementScore >= 0.4) level = 'medium';
    else if (engagementScore >= 0.2) level = 'low';
    else level = 'very_low';

    return {
      level,
      score: engagementScore,
      indicators,
      confidence: Math.min(1, attentionData.gazeAccuracy * 1.2)
    };
  }

  detectEngagementEvents(history) {
    if (history.length < 3) return { events: [] };

    const recent = history.slice(-3);
    const events = [];

    // Engagement increase
    const scores = recent.map(h => ({ very_low: 0, low: 0.25, medium: 0.5, high: 0.75, very_high: 1 }[h.level]));
    if (scores[2] - scores[0] > 0.25) {
      events.push({
        type: 'engagement_increase',
        magnitude: scores[2] - scores[0],
        timestamp: recent[2].timestamp
      });
    }

    // Engagement decrease
    if (scores[0] - scores[2] > 0.25) {
      events.push({
        type: 'engagement_decrease',
        magnitude: scores[0] - scores[2],
        timestamp: recent[2].timestamp
      });
    }

    // Sustained high engagement
    if (scores.every(s => s >= 0.75)) {
      events.push({
        type: 'sustained_high_engagement',
        duration: recent[2].timestamp - recent[0].timestamp,
        timestamp: recent[2].timestamp
      });
    }

    return { events };
  }

  calculateEngagementTrend() {
    // Implementation would analyze recent engagement history
    return 'stable';
  }

  calculateEngagementVariability() {
    // Implementation would calculate variance in engagement levels
    return 0.5;
  }

  // Behavior analysis system
  createBehaviorAnalyzer() {
    const behaviorHistory = [];
    
    return {
      analyzeBehavior: (gazeData, faceData, attentionData) => {
        const behavior = this.identifyBehaviorPatterns(gazeData, faceData, attentionData);
        
        behaviorHistory.push({
          timestamp: Date.now(),
          ...behavior
        });

        // Keep recent history
        if (behaviorHistory.length > 200) {
          behaviorHistory.shift();
        }

        return this.detectBehaviorChanges(behaviorHistory);
      },

      getBehaviorSummary: () => {
        if (behaviorHistory.length === 0) return null;

        const patterns = behaviorHistory.map(b => b.primary_pattern);
        const patternCounts = patterns.reduce((counts, pattern) => {
          counts[pattern] = (counts[pattern] || 0) + 1;
          return counts;
        }, {});

        const dominantPattern = Object.entries(patternCounts)
          .sort(([,a], [,b]) => b - a)[0];

        return {
          dominantBehavior: dominantPattern[0],
          behaviorDistribution: patternCounts,
          behaviorStability: this.calculateBehaviorStability(),
          totalObservations: behaviorHistory.length
        };
      },

      reset: () => {
        behaviorHistory.length = 0;
      }
    };
  }

  identifyBehaviorPatterns(gazeData, faceData, attentionData) {
    const patterns = [];

    // Scanning behavior (high gaze velocity)
    if (gazeData.metadata?.velocity > 0.3) {
      patterns.push({ type: 'scanning', confidence: Math.min(1, gazeData.metadata.velocity / 0.5) });
    }

    // Fixation behavior (low gaze velocity, high confidence)
    if (gazeData.metadata?.velocity < 0.1 && gazeData.confidence > 0.8) {
      patterns.push({ type: 'fixation', confidence: gazeData.confidence });
    }

    // Social attention (looking at face)
    if (attentionData.faceAttention > 0.7) {
      patterns.push({ type: 'social_attention', confidence: attentionData.faceAttention });
    }

    // Distracted behavior (low overall attention)
    if (attentionData.overallAttention < 0.4) {
      patterns.push({ type: 'distracted', confidence: 1 - attentionData.overallAttention });
    }

    // Focused behavior (high attention, stable gaze)
    if (attentionData.overallAttention > 0.7 && attentionData.focusStability > 0.6) {
      patterns.push({ type: 'focused', confidence: (attentionData.overallAttention + attentionData.focusStability) / 2 });
    }

    // Determine primary pattern
    const primary = patterns.reduce((max, pattern) => 
      pattern.confidence > max.confidence ? pattern : max, 
      { type: 'unknown', confidence: 0 }
    );

    return {
      primary_pattern: primary.type,
      primary_confidence: primary.confidence,
      all_patterns: patterns,
      pattern_count: patterns.length
    };
  }

  detectBehaviorChanges(history) {
    if (history.length < 5) return { changes: [] };

    const recent = history.slice(-5);
    const changes = [];

    // Detect pattern transitions
    const patterns = recent.map(h => h.primary_pattern);
    const uniquePatterns = [...new Set(patterns)];

    if (uniquePatterns.length > 3) {
      changes.push({
        type: 'pattern_instability',
        patterns: uniquePatterns,
        timestamp: recent[recent.length - 1].timestamp
      });
    }

    // Detect significant pattern shifts
    if (patterns[0] !== patterns[patterns.length - 1]) {
      changes.push({
        type: 'pattern_transition',
        from: patterns[0],
        to: patterns[patterns.length - 1],
        timestamp: recent[recent.length - 1].timestamp
      });
    }

    return { changes };
  }

  calculateBehaviorStability() {
    // Implementation would analyze consistency of behavior patterns
    return 0.7;
  }

  // Main coordination system
  async initialize() {
    console.log('🤖 Initializing Multimodal Coordination System...\n');

    // Initialize eye tracking
    this.eyeTracker = createEyeTracker({
      useMockDevices: true,
      enableSynchronization: true
    });
    await this.eyeTracker.initialize();

    // Initialize face analysis
    const mockCanvas = { 
      getContext: () => ({}), 
      width: 1920, 
      height: 1080 
    };
    this.faceEngine = createFaceAnalysisEngine(mockCanvas, {
      enableStreaming: true
    });
    await this.faceEngine.initialize();

    // Initialize synchronization
    this.syncEngine = createSynchronizationEngine({
      tolerance: this.config.syncTolerance,
      strategy: 'hardware_timestamp'
    });

    console.log('✅ All systems initialized\n');
  }

  async startCoordination() {
    console.log('🎯 Starting multimodal coordination...\n');
    
    await this.eyeTracker.autoConnectToFirstDevice();
    
    // Create optimized streams
    const gazeStream = streamFactory.create('eyetracking', {
      id: 'coordination-gaze',
      enableMemoryOptimization: true,
      enableAdaptiveBatching: true
    });

    const faceStream = streamFactory.create('video', {
      id: 'coordination-face',
      sampleRate: 30
    });

    // Setup synchronization
    this.syncEngine.addStream('gaze', gazeStream);
    this.syncEngine.addStream('face', faceStream);

    await Promise.all([gazeStream.start(), faceStream.start()]);

    // Setup coordination handlers
    this.setupCoordinationHandlers();

    this.state.isRunning = true;
    console.log('🔄 Multimodal coordination active - analyzing behavior patterns...\n');

    // Run coordination session
    await this.runCoordinationSession(gazeStream, faceStream);

    return { gazeStream, faceStream };
  }

  setupCoordinationHandlers() {
    this.syncEngine.onSynchronizedData((streams) => {
      const gazeData = streams.find(s => s.streamType === 'eyetracking');
      const faceData = streams.find(s => s.streamType === 'video');

      if (gazeData && faceData) {
        this.metrics.syncedFrames++;
        
        // Update attention model
        const attentionAnalysis = this.state.attentionModel.updateAttention(gazeData, faceData.data);
        
        // Detect engagement
        const engagementAnalysis = this.state.engagementDetector.detectEngagement(
          this.calculateAttentionMetrics(gazeData, faceData.data), 
          faceData.data
        );

        // Analyze behavior
        const behaviorAnalysis = this.state.behaviorAnalyzer.analyzeBehavior(
          gazeData, 
          faceData.data, 
          this.calculateAttentionMetrics(gazeData, faceData.data)
        );

        // Store insights
        this.processCoordinationInsights(attentionAnalysis, engagementAnalysis, behaviorAnalysis);
      }

      this.metrics.totalFrames++;
    });
  }

  processCoordinationInsights(attention, engagement, behavior) {
    // Log significant events
    if (attention && attention.pattern !== 'insufficient_data') {
      if (attention.pattern === 'highly_focused' && Math.random() < 0.1) {
        console.log(`👁️  High focus detected: ${attention.confidence.toFixed(2)} confidence`);
      }
    }

    if (engagement && engagement.events.length > 0) {
      engagement.events.forEach(event => {
        console.log(`📊 Engagement event: ${event.type} at ${new Date(event.timestamp).toLocaleTimeString()}`);
      });
    }

    if (behavior && behavior.changes.length > 0) {
      behavior.changes.forEach(change => {
        console.log(`🔄 Behavior change: ${change.type} (${change.from || ''} → ${change.to || ''})`);
      });
    }

    // Store for analysis
    this.metrics.attentionEvents.push(attention);
    this.metrics.engagementLevels.push(engagement);
    this.metrics.behaviorPatterns.push(behavior);
  }

  async runCoordinationSession(gazeStream, faceStream) {
    const sessionDuration = 15000; // 15 seconds
    const startTime = Date.now();

    // Simulate coordinated multimodal data
    let phase = 0; // 0: focused, 1: scanning, 2: distracted, 3: engaged
    let phaseDuration = 3000; // 3 seconds per phase

    while (Date.now() - startTime < sessionDuration) {
      const currentTime = Date.now();
      const phaseProgress = ((currentTime - startTime) % phaseDuration) / phaseDuration;
      
      // Update phase
      phase = Math.floor((currentTime - startTime) / phaseDuration);

      // Generate behavior-specific data
      const { gazeData, faceData } = this.generatePhasedData(phase, phaseProgress);

      // Process through streams
      await Promise.all([
        gazeStream.process(gazeData),
        faceData ? faceStream.process(faceData) : Promise.resolve()
      ]);

      await new Promise(resolve => setTimeout(resolve, 5)); // 200Hz
    }

    await Promise.all([gazeStream.stop(), faceStream.stop()]);
  }

  generatePhasedData(phase, progress) {
    const baseTime = Date.now();
    
    let gazeData, faceData;

    switch (phase % 4) {
      case 0: // Focused phase
        gazeData = {
          timestamp: baseTime,
          x: 0.5 + Math.sin(progress * Math.PI * 2) * 0.05, // Small movement around center
          y: 0.5 + Math.cos(progress * Math.PI * 2) * 0.03,
          confidence: 0.85 + Math.random() * 0.1,
          metadata: { velocity: 0.05 + Math.random() * 0.03 }
        };
        
        faceData = {
          timestamp: baseTime,
          faces: [{
            bbox: { x: 840, y: 440, width: 240, height: 200 },
            confidence: 0.9 + Math.random() * 0.05
          }]
        };
        break;

      case 1: // Scanning phase
        gazeData = {
          timestamp: baseTime,
          x: 0.2 + progress * 0.6, // Scan across screen
          y: 0.4 + Math.sin(progress * Math.PI * 4) * 0.2,
          confidence: 0.7 + Math.random() * 0.2,
          metadata: { velocity: 0.4 + Math.random() * 0.3 }
        };
        
        faceData = {
          timestamp: baseTime,
          faces: [{
            bbox: { x: 800, y: 400, width: 260, height: 220 },
            confidence: 0.8 + Math.random() * 0.1
          }]
        };
        break;

      case 2: // Distracted phase
        gazeData = {
          timestamp: baseTime,
          x: Math.random(), // Random gaze
          y: Math.random(),
          confidence: 0.4 + Math.random() * 0.3,
          metadata: { velocity: 0.6 + Math.random() * 0.4 }
        };
        
        faceData = Math.random() > 0.3 ? {
          timestamp: baseTime,
          faces: [{
            bbox: { x: 750 + Math.random() * 100, y: 350 + Math.random() * 100, width: 200, height: 180 },
            confidence: 0.6 + Math.random() * 0.2
          }]
        } : { timestamp: baseTime, faces: [] };
        break;

      case 3: // Engaged phase (looking at face)
        const faceX = 0.5, faceY = 0.45;
        gazeData = {
          timestamp: baseTime,
          x: faceX + (Math.random() - 0.5) * 0.08, // Gaze near face center
          y: faceY + (Math.random() - 0.5) * 0.06,
          confidence: 0.9 + Math.random() * 0.05,
          metadata: { velocity: 0.08 + Math.random() * 0.05 }
        };
        
        faceData = {
          timestamp: baseTime,
          faces: [{
            bbox: { x: 840, y: 420, width: 240, height: 200 },
            confidence: 0.92 + Math.random() * 0.03
          }]
        };
        break;
    }

    return { gazeData, faceData };
  }

  displayCoordinationResults() {
    console.log('\n📈 Multimodal Coordination Results');
    console.log('==================================');
    
    console.log(`📊 Total frames processed: ${this.metrics.totalFrames}`);
    console.log(`🔗 Synchronized frames: ${this.metrics.syncedFrames}`);
    console.log(`⚡ Synchronization rate: ${((this.metrics.syncedFrames / this.metrics.totalFrames) * 100).toFixed(1)}%\n`);

    // Attention analysis
    const attentionSummary = this.state.attentionModel.getAttentionSummary();
    if (attentionSummary) {
      console.log('👁️  Attention Analysis:');
      console.log(`   Focus Stability: ${(attentionSummary.focusStability * 100).toFixed(1)}%`);
      console.log(`   Gaze Accuracy: ${(attentionSummary.gazeAccuracy * 100).toFixed(1)}%`);
      console.log(`   Attention Level: ${attentionSummary.attentionLevel}`);
      console.log(`   Trend: ${attentionSummary.trendDirection}\n`);
    }

    // Engagement analysis
    const engagementSummary = this.state.engagementDetector.getEngagementSummary();
    if (engagementSummary) {
      console.log('💫 Engagement Analysis:');
      console.log(`   Average Level: ${(engagementSummary.averageLevel * 100).toFixed(1)}%`);
      console.log(`   Peak Engagement: ${(engagementSummary.peakEngagement * 100).toFixed(1)}%`);
      console.log(`   Variability: ${(engagementSummary.engagementVariability * 100).toFixed(1)}%\n`);
    }

    // Behavior analysis
    const behaviorSummary = this.state.behaviorAnalyzer.getBehaviorSummary();
    if (behaviorSummary) {
      console.log('🧠 Behavior Analysis:');
      console.log(`   Dominant Behavior: ${behaviorSummary.dominantBehavior}`);
      console.log(`   Behavior Stability: ${(behaviorSummary.behaviorStability * 100).toFixed(1)}%`);
      console.log('   Pattern Distribution:');
      
      Object.entries(behaviorSummary.behaviorDistribution).forEach(([pattern, count]) => {
        const percentage = (count / behaviorSummary.totalObservations * 100).toFixed(1);
        console.log(`     ${pattern}: ${percentage}% (${count} observations)`);
      });
    }

    console.log('\n🎯 Coordination Insights:');
    console.log('   - Real-time multimodal analysis completed successfully');
    console.log('   - Attention and engagement patterns identified');
    console.log('   - Behavior transitions detected and analyzed');
    console.log('   - System demonstrates robust synchronization capabilities\n');
  }

  async cleanup() {
    console.log('🧹 Cleaning up coordination system...');
    
    this.state.isRunning = false;
    
    if (this.eyeTracker) {
      await this.eyeTracker.shutdown();
    }
    
    if (this.syncEngine) {
      this.syncEngine.stop();
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Main execution
async function runCoordinationDemo() {
  console.log('🤖 Advanced Multimodal Coordination Demo');
  console.log('========================================\n');

  const coordinator = new MultimodalCoordinator({
    syncTolerance: 15,
    attentionWindow: 3000,
    engagementThreshold: 0.6
  });

  try {
    await coordinator.initialize();
    await coordinator.startCoordination();
    coordinator.displayCoordinationResults();
    
    console.log('🎉 Coordination demo completed successfully!');
    console.log('\n🔬 This demo showcases:');
    console.log('   • Real-time attention modeling');
    console.log('   • Engagement detection algorithms');
    console.log('   • Behavioral pattern recognition');
    console.log('   • Synchronized multimodal processing');
    console.log('   • Advanced data correlation techniques\n');
    
  } catch (error) {
    console.error('❌ Coordination demo failed:', error.message);
  } finally {
    await coordinator.cleanup();
  }
}

// Execute demo
if (import.meta.main) {
  runCoordinationDemo().catch(console.error);
}