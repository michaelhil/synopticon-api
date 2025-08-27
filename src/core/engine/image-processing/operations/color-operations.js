/**
 * Color Space Operations
 * Optimized color space conversions and adjustments
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';

export const COLOR_FORMATS = {
  RGB: 'rgb',
  RGBA: 'rgba',
  GRAYSCALE: 'grayscale',
  HSV: 'hsv',
  HSL: 'hsl',
  LAB: 'lab',
  YUV: 'yuv'
};

/**
 * Creates color operations module
 */
export const createColorOperations = (resourcePool, config = {}) => {
  const opConfig = {
    defaultFormat: config.defaultFormat || COLOR_FORMATS.RGBA,
    enableGammaCorrection: config.enableGammaCorrection !== false,
    gamma: config.gamma || 2.2,
    ...config
  };

  const state = {
    metrics: {
      totalConversions: 0,
      totalAdjustments: 0,
      conversionTypes: {},
      avgProcessingTime: 0
    }
  };

  // Color space conversion matrices and functions
  const colorMath = {
    // RGB to Grayscale conversion weights (ITU-R BT.709)
    grayscaleWeights: [0.2126, 0.7152, 0.0722],
    
    // Gamma correction
    applyGamma: (value, gamma) => Math.pow(value / 255, 1 / gamma) * 255,
    removeGamma: (value, gamma) => Math.pow(value / 255, gamma) * 255,
    
    // Clamp value to 0-255 range
    clamp: (value) => Math.max(0, Math.min(255, Math.round(value))),
    
    // RGB to HSV conversion
    rgbToHsv: (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      
      let h = 0;
      const s = max === 0 ? 0 : diff / max;
      const v = max;
      
      if (diff !== 0) {
        switch (max) {
          case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / diff + 2) / 6; break;
          case b: h = ((r - g) / diff + 4) / 6; break;
        }
      }
      
      return [h * 360, s * 100, v * 100];
    },
    
    // HSV to RGB conversion
    hsvToRgb: (h, s, v) => {
      h /= 360; s /= 100; v /= 100;
      
      const c = v * s;
      const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
      const m = v - c;
      
      let r = 0, g = 0, b = 0;
      
      if (h < 1/6) { r = c; g = x; b = 0; }
      else if (h < 2/6) { r = x; g = c; b = 0; }
      else if (h < 3/6) { r = 0; g = c; b = x; }
      else if (h < 4/6) { r = 0; g = x; b = c; }
      else if (h < 5/6) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      
      return [
        colorMath.clamp((r + m) * 255),
        colorMath.clamp((g + m) * 255),
        colorMath.clamp((b + m) * 255)
      ];
    }
  };

  const convertColorSpace = async (imageData, fromFormat, toFormat) => {
    const startTime = performance.now();
    
    try {
      const { data, width, height } = imageData;
      
      if (fromFormat === toFormat) {
        return imageData;
      }
      
      let resultData;
      const conversionKey = `${fromFormat}->${toFormat}`;
      
      // RGB/RGBA to Grayscale
      if ((fromFormat === COLOR_FORMATS.RGB || fromFormat === COLOR_FORMATS.RGBA) && 
          toFormat === COLOR_FORMATS.GRAYSCALE) {
        resultData = new Uint8ClampedArray(width * height * 4);
        const weights = colorMath.grayscaleWeights;
        
        for (let i = 0; i < data.length; i += 4) {
          const gray = colorMath.clamp(
            data[i] * weights[0] +     // R
            data[i + 1] * weights[1] + // G
            data[i + 2] * weights[2]   // B
          );
          
          resultData[i] = gray;     // R
          resultData[i + 1] = gray; // G
          resultData[i + 2] = gray; // B
          resultData[i + 3] = data[i + 3]; // A
        }
      }
      
      // RGB to RGBA (add alpha channel)
      else if (fromFormat === COLOR_FORMATS.RGB && toFormat === COLOR_FORMATS.RGBA) {
        resultData = new Uint8ClampedArray(width * height * 4);
        
        for (let i = 0; i < data.length; i += 3) {
          const outputIndex = (i / 3) * 4;
          resultData[outputIndex] = data[i];         // R
          resultData[outputIndex + 1] = data[i + 1]; // G
          resultData[outputIndex + 2] = data[i + 2]; // B
          resultData[outputIndex + 3] = 255;         // A (opaque)
        }
      }
      
      // RGBA to RGB (remove alpha channel)
      else if (fromFormat === COLOR_FORMATS.RGBA && toFormat === COLOR_FORMATS.RGB) {
        resultData = new Uint8ClampedArray(width * height * 3);
        
        for (let i = 0; i < data.length; i += 4) {
          const outputIndex = (i / 4) * 3;
          resultData[outputIndex] = data[i];         // R
          resultData[outputIndex + 1] = data[i + 1]; // G
          resultData[outputIndex + 2] = data[i + 2]; // B
        }
      }
      
      else {
        throw new Error(`Unsupported color space conversion: ${fromFormat} to ${toFormat}`);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      state.metrics.totalConversions++;
      state.metrics.conversionTypes[conversionKey] = (state.metrics.conversionTypes[conversionKey] || 0) + 1;
      updateMetrics(processingTime);
      
      return new ImageData(resultData, width, height);
      
    } catch (error) {
      throw handleError(
        `Color space conversion failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  const normalize = async (imageData) => {
    const startTime = performance.now();
    
    try {
      const { data, width, height } = imageData;
      const resultData = new Uint8ClampedArray(data.length);
      
      // Find min and max values for each channel
      let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]);
        maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i + 1]);
        maxG = Math.max(maxG, data[i + 1]);
        minB = Math.min(minB, data[i + 2]);
        maxB = Math.max(maxB, data[i + 2]);
      }
      
      // Calculate normalization factors
      const rangeR = maxR - minR || 1;
      const rangeG = maxG - minG || 1;
      const rangeB = maxB - minB || 1;
      
      // Apply normalization
      for (let i = 0; i < data.length; i += 4) {
        resultData[i] = colorMath.clamp(((data[i] - minR) / rangeR) * 255);         // R
        resultData[i + 1] = colorMath.clamp(((data[i + 1] - minG) / rangeG) * 255); // G
        resultData[i + 2] = colorMath.clamp(((data[i + 2] - minB) / rangeB) * 255); // B
        resultData[i + 3] = data[i + 3];                                             // A
      }
      
      updateMetrics(performance.now() - startTime);
      return new ImageData(resultData, width, height);
      
    } catch (error) {
      throw handleError(
        `Normalization failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  const adjustBrightness = async (imageData, factor) => {
    const startTime = performance.now();
    
    try {
      const { data, width, height } = imageData;
      const resultData = new Uint8ClampedArray(data.length);
      
      // Apply brightness adjustment
      for (let i = 0; i < data.length; i += 4) {
        resultData[i] = colorMath.clamp(data[i] * factor);         // R
        resultData[i + 1] = colorMath.clamp(data[i + 1] * factor); // G
        resultData[i + 2] = colorMath.clamp(data[i + 2] * factor); // B
        resultData[i + 3] = data[i + 3];                           // A
      }
      
      state.metrics.totalAdjustments++;
      updateMetrics(performance.now() - startTime);
      return new ImageData(resultData, width, height);
      
    } catch (error) {
      throw handleError(
        `Brightness adjustment failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  const adjustContrast = async (imageData, factor) => {
    const startTime = performance.now();
    
    try {
      const { data, width, height } = imageData;
      const resultData = new Uint8ClampedArray(data.length);
      
      const contrastFactor = (259 * (factor + 255)) / (255 * (259 - factor));
      
      // Apply contrast adjustment
      for (let i = 0; i < data.length; i += 4) {
        resultData[i] = colorMath.clamp(contrastFactor * (data[i] - 128) + 128);         // R
        resultData[i + 1] = colorMath.clamp(contrastFactor * (data[i + 1] - 128) + 128); // G
        resultData[i + 2] = colorMath.clamp(contrastFactor * (data[i + 2] - 128) + 128); // B
        resultData[i + 3] = data[i + 3];                                                 // A
      }
      
      state.metrics.totalAdjustments++;
      updateMetrics(performance.now() - startTime);
      return new ImageData(resultData, width, height);
      
    } catch (error) {
      throw handleError(
        `Contrast adjustment failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  const adjustSaturation = async (imageData, factor) => {
    const startTime = performance.now();
    
    try {
      const { data, width, height } = imageData;
      const resultData = new Uint8ClampedArray(data.length);
      
      const weights = colorMath.grayscaleWeights;
      
      // Apply saturation adjustment
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate grayscale value
        const gray = r * weights[0] + g * weights[1] + b * weights[2];
        
        // Interpolate between grayscale and original color
        resultData[i] = colorMath.clamp(gray + factor * (r - gray));     // R
        resultData[i + 1] = colorMath.clamp(gray + factor * (g - gray)); // G
        resultData[i + 2] = colorMath.clamp(gray + factor * (b - gray)); // B
        resultData[i + 3] = data[i + 3];                                 // A
      }
      
      state.metrics.totalAdjustments++;
      updateMetrics(performance.now() - startTime);
      return new ImageData(resultData, width, height);
      
    } catch (error) {
      throw handleError(
        `Saturation adjustment failed: ${error.message}`,
        ErrorCategory.IMAGE_PROCESSING,
        ErrorSeverity.ERROR
      );
    }
  };

  const updateMetrics = (processingTime) => {
    const totalOps = state.metrics.totalConversions + state.metrics.totalAdjustments;
    state.metrics.avgProcessingTime = 
      (state.metrics.avgProcessingTime * (totalOps - 1) + processingTime) / totalOps;
  };

  const getMetrics = () => ({ ...state.metrics });

  const cleanup = async () => {
    state.metrics = {
      totalConversions: 0,
      totalAdjustments: 0,
      conversionTypes: {},
      avgProcessingTime: 0
    };
  };

  return {
    convertColorSpace,
    normalize,
    adjustBrightness,
    adjustContrast,
    adjustSaturation,
    getMetrics,
    cleanup,
    
    // Constants
    COLOR_FORMATS,
    
    // Utility functions
    colorMath
  };
};