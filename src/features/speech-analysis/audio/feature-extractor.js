/**
 * Audio Feature Extraction Module
 * Advanced audio analysis and feature computation
 */

export const createFeatureExtractor = (config) => {
  // Extract audio features
  const extractFeatures = (timeData, freqData, sampleRate) => {
    const features = {
      pitch: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      spectralSpread: 0,
      spectralFlux: 0,
      harmonicRatio: 0
    };
    
    // Energy (RMS)
    features.energy = calculateRMS(timeData);
    
    // Zero Crossing Rate
    features.zeroCrossingRate = calculateZCR(timeData);
    
    // Pitch detection using autocorrelation
    features.pitch = detectPitch(timeData, sampleRate);
    
    // Spectral features
    const spectralFeatures = calculateSpectralFeatures(freqData, sampleRate);
    Object.assign(features, spectralFeatures);
    
    // MFCC calculation (simplified)
    features.mfcc = calculateMFCC(freqData, sampleRate);
    
    // Formant detection
    features.formants = detectFormants(freqData, sampleRate);
    
    return features;
  };

  // Calculate RMS energy
  const calculateRMS = (buffer) => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  };

  // Calculate Zero Crossing Rate
  const calculateZCR = (buffer) => {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  };

  // Detect pitch using autocorrelation
  const detectPitch = (buffer, sampleRate) => {
    const minPeriod = Math.floor(sampleRate / (config.maxPitch || 400));
    const maxPeriod = Math.floor(sampleRate / (config.minPitch || 50));
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    // Autocorrelation
    for (let period = minPeriod; period < maxPeriod && period < buffer.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    // Convert period to frequency
    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  };

  // Calculate spectral features
  const calculateSpectralFeatures = (freqData, sampleRate) => {
    const features = {};
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / freqData.length;
    
    let weightedSum = 0;
    let totalMagnitude = 0;
    let rolloffSum = 0;
    let rolloffThreshold = 0;
    
    // Convert dB to linear magnitude
    const magnitudes = freqData.map(db => Math.pow(10, db / 20));
    
    // Calculate total magnitude
    for (let i = 0; i < magnitudes.length; i++) {
      totalMagnitude += magnitudes[i];
    }
    
    rolloffThreshold = totalMagnitude * 0.85; // 85% rolloff point
    
    // Spectral centroid and rolloff
    for (let i = 0; i < magnitudes.length; i++) {
      const frequency = i * binWidth;
      weightedSum += frequency * magnitudes[i];
      rolloffSum += magnitudes[i];
      
      if (rolloffSum >= rolloffThreshold && features.spectralRolloff === undefined) {
        features.spectralRolloff = frequency;
      }
    }
    
    features.spectralCentroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
    features.spectralRolloff = features.spectralRolloff || nyquist;
    
    // Spectral spread (bandwidth around centroid)
    let spreadSum = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      const frequency = i * binWidth;
      const diff = frequency - features.spectralCentroid;
      spreadSum += diff * diff * magnitudes[i];
    }
    features.spectralSpread = totalMagnitude > 0 ? Math.sqrt(spreadSum / totalMagnitude) : 0;
    
    return features;
  };

  // Calculate MFCC (simplified version)
  const calculateMFCC = (freqData, sampleRate, numCoeffs = 13) => {
    const melFilters = createMelFilterBank(freqData.length, sampleRate);
    const mfcc = [];
    
    // Apply mel filter bank
    for (let i = 0; i < melFilters.length && i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < freqData.length; j++) {
        const magnitude = Math.pow(10, freqData[j] / 20);
        sum += magnitude * melFilters[i][j];
      }
      
      // Log and DCT (simplified)
      mfcc.push(Math.log(sum + 1e-10));
    }
    
    return mfcc;
  };

  // Create simplified mel filter bank
  const createMelFilterBank = (fftSize, sampleRate, numFilters = 13) => {
    const filters = [];
    const melMax = 2595 * Math.log10(1 + (sampleRate / 2) / 700);
    
    for (let i = 0; i < numFilters; i++) {
      const filter = new Array(fftSize).fill(0);
      const melCenter = (i + 1) * melMax / (numFilters + 1);
      const freqCenter = 700 * (Math.pow(10, melCenter / 2595) - 1);
      const binCenter = Math.floor(freqCenter * fftSize / sampleRate);
      
      // Triangular filter
      const width = Math.max(1, Math.floor(fftSize / numFilters));
      for (let j = Math.max(0, binCenter - width); j < Math.min(fftSize, binCenter + width); j++) {
        const distance = Math.abs(j - binCenter);
        filter[j] = Math.max(0, 1 - distance / width);
      }
      
      filters.push(filter);
    }
    
    return filters;
  };

  // Detect formants (simplified)
  const detectFormants = (freqData, sampleRate, maxFormants = 4) => {
    const formants = [];
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / freqData.length;
    
    // Convert to linear magnitude
    const magnitudes = freqData.map(db => Math.pow(10, db / 20));
    
    // Simple peak finding for formants
    for (let i = 1; i < magnitudes.length - 1 && formants.length < maxFormants; i++) {
      const freq = i * binWidth;
      
      // Look for peaks in speech frequency range (200-3000 Hz)
      if (freq > 200 && freq < 3000) {
        if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
          // Check if it's a significant peak
          const localMax = Math.max(...magnitudes.slice(Math.max(0, i - 5), i + 6));
          if (magnitudes[i] > localMax * 0.7) {
            formants.push({
              frequency: freq,
              amplitude: magnitudes[i]
            });
          }
        }
      }
    }
    
    return formants.sort((a, b) => a.frequency - b.frequency);
  };

  return {
    extractFeatures,
    calculateRMS,
    calculateZCR,
    detectPitch,
    calculateSpectralFeatures,
    calculateMFCC,
    detectFormants
  };
};