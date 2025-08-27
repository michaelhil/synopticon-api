/**
 * Speaking Pace Analysis Module
 * Advanced speech rate, fluency, and articulation pattern analysis
 * Following functional programming patterns with factory functions
 * 
 * Refactored into modular components for maintainability:
 * - Speaking Rate Analyzer: Words per minute, syllable rates, and speed categorization
 * - Fluency Analyzer: Filler words, hesitations, repetitions, and speech flow analysis
 * - Pace Analysis Manager: Orchestrates both components for comprehensive pace analysis
 */

// Import modular components
import { createSpeakingRateAnalyzer } from './pace/speaking-rate-analyzer.js';
import { createFluencyAnalyzer } from './pace/fluency-analyzer.js';
import { createPaceAnalysisManager } from './pace/pace-analysis-manager.js';

// Re-export individual components for advanced usage
export { createSpeakingRateAnalyzer } from './pace/speaking-rate-analyzer.js';
export { createFluencyAnalyzer } from './pace/fluency-analyzer.js';

// Main speaking pace analysis system using the pace analysis manager
export const createSpeakingPaceAnalysis = (config = {}) => {
  console.log('⏱️ Initializing comprehensive speaking pace analysis system...');
  
  // Create pace analysis manager with all modular components
  const paceManager = createPaceAnalysisManager(config);
  
  console.log('✅ Speaking pace analysis system initialized with modular components');
  
  // Return the complete API with enhanced logging and reporting
  return {
    ...paceManager,
    
    // Enhanced processing with logging
    processSegment: (text, startTime, endTime, speakerId = null) => {
      const result = paceManager.processSegment(text, startTime, endTime, speakerId);
      
      if (result) {
        const duration = endTime - startTime;
        const wordCount = text.trim().split(/\s+/).length;
        const wpm = Math.round((wordCount / duration) * 60000);
        
        console.log(`📈 Pace analysis: ${wpm} WPM (${result.speakingRate.category}), Fluency: ${Math.round(result.fluency.score)}/100`);
      }
      
      return result;
    },
    
    // Enhanced analysis report with detailed insights
    getAnalysisReport: (timeWindow) => {
      const report = paceManager.getAnalysisReport(timeWindow);
      
      console.log('📊 Pace Analysis Report:', {
        timeWindow: `${timeWindow || 30000}ms`,
        speakingRate: report.speakingRate?.averageRate ? `${Math.round(report.speakingRate.averageRate)} WPM` : 'N/A',
        fluencyScore: report.fluency?.score ? `${Math.round(report.fluency.score)}/100` : 'N/A',
        insights: report.summary || []
      });
      
      return report;
    },
    
    // Enhanced metrics with component breakdown
    getCurrentPaceMetrics: () => {
      const metrics = paceManager.getCurrentPaceMetrics();
      
      console.log('🎯 Current Pace Metrics:', {
        currentRate: metrics.speakingRate?.current ? `${Math.round(metrics.speakingRate.current)} WPM` : 'N/A',
        smoothedRate: metrics.speakingRate?.smoothed ? `${Math.round(metrics.speakingRate.smoothed)} WPM` : 'N/A',
        fluencyScore: metrics.fluency?.score ? `${Math.round(metrics.fluency.score)}/100` : 'N/A',
        fillerRate: metrics.fluency?.fillerRate ? `${metrics.fluency.fillerRate.toFixed(1)} per min` : 'N/A'
      });
      
      return metrics;
    },
    
    // Enhanced stats with component details
    getStats: () => {
      const stats = paceManager.getStats();
      
      console.log('📈 Pace Analysis Statistics:', {
        totalSegments: stats.totalSegments,
        totalAnalyses: stats.totalAnalyses,
        avgProcessingTime: stats.averageProcessingTime ? `${stats.averageProcessingTime.toFixed(2)}ms` : 'N/A',
        rateAnalyzer: stats.components.rate ? 'Active' : 'Inactive',
        fluencyAnalyzer: stats.components.fluency ? 'Active' : 'Inactive'
      });
      
      return stats;
    },
    
    // Enhanced reset with logging
    reset: () => {
      console.log('🔄 Resetting speaking pace analysis system...');
      paceManager.reset();
      console.log('✅ Speaking pace analysis system reset');
    },
    
    // Enhanced cleanup with logging
    cleanup: () => {
      console.log('🧹 Cleaning up speaking pace analysis system...');
      paceManager.cleanup();
      console.log('✅ Speaking pace analysis system cleaned up');
    }
  };
};