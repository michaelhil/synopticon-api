/**
 * Audio Quality Analysis Core
 * Core quality analysis and scoring logic
 */

export const createQualityAnalysisCore = (state) => {
  // Run individual quality analyses
  const runAnalyses = (audioBuffer, fftMagnitudes, isQuiet) => {
    const snrResult = state.snrCalculator.calculateSNR(audioBuffer, fftMagnitudes, isQuiet);
    let thdResult = { thd: 0, quality: 100 };
    if (fftMagnitudes) {
      thdResult = state.thdCalculator.calculateTHD(fftMagnitudes);
    }
    const clippingResult = state.clippingDetector.detectClipping(audioBuffer);
    
    return { snrResult, thdResult, clippingResult };
  };

  // Calculate weighted overall quality score
  const calculateOverallQuality = (snrResult, thdResult, clippingResult) => {
    const snrWeight = 0.4;
    const thdWeight = 0.3;
    const clippingWeight = 0.3;
    
    return (snrResult.quality * snrWeight) +
           (thdResult.quality * thdWeight) +
           (clippingResult.quality * clippingWeight);
  };

  // Determine quality level from score
  const determineQualityLevel = (overallQuality) => {
    if (overallQuality >= state.config.qualityThresholds.excellent) {
      return 'excellent';
    } else if (overallQuality >= state.config.qualityThresholds.good) {
      return 'good';
    } else if (overallQuality >= state.config.qualityThresholds.fair) {
      return 'fair';
    } else {
      return 'poor';
    }
  };

  // Generate quality recommendations
  const generateRecommendations = (snrResult, thdResult, clippingResult) => {
    const recommendations = [];
    
    if (snrResult.snr < 10) {
      recommendations.push('Reduce background noise or increase microphone gain');
    }
    if (thdResult.thdPercent > 10) {
      recommendations.push('Check for audio hardware distortion or overdriving');
    }
    if (clippingResult.isClipped) {
      recommendations.push('Reduce input level to prevent audio clipping');
    }
    if (snrResult.snr > 40 && thdResult.thdPercent < 1 && !clippingResult.isClipped) {
      recommendations.push('Excellent audio quality - maintain current settings');
    } else if (snrResult.signalStrength < -20) {
      recommendations.push('Increase microphone sensitivity or move closer to source');
    }
    
    return recommendations;
  };

  // Calculate detailed metrics
  const calculateDetailedMetrics = (snrResult, thdResult, clippingResult, audioBuffer) => {
    const rmsLevel = Math.sqrt(audioBuffer.reduce((sum, s) => sum + s * s, 0) / audioBuffer.length);
    const peakLevel = Math.max(...audioBuffer.map(Math.abs));
    
    return {
      signalStrength: 20 * Math.log10(rmsLevel + 1e-10),
      noiseLevel: snrResult.noiseLevel || -60,
      distortion: thdResult.thdPercent || 0,
      clarity: Math.max(0, 100 - (thdResult.thdPercent || 0) - Math.max(0, (clippingResult.clippingPercent || 0) * 10)),
      dynamicRange: 20 * Math.log10((peakLevel + 1e-10) / (rmsLevel + 1e-10)),
      peakLevel: 20 * Math.log10(peakLevel + 1e-10)
    };
  };

  return {
    runAnalyses,
    calculateOverallQuality,
    determineQualityLevel,
    generateRecommendations,
    calculateDetailedMetrics
  };
};