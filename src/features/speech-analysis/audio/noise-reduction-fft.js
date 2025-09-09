/**
 * FFT Operations for Noise Reduction
 * Fast Fourier Transform and signal processing utilities
 */

export const createFFTProcessor = () => {
  // FFT implementation (simplified)
  const fft = (inputBuffer) => {
    const N = inputBuffer.length;
    const output = new Array(N);
    
    for (let k = 0; k < N; k++) {
      let sumReal = 0;
      let sumImag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        sumReal += inputBuffer[n] * Math.cos(angle);
        sumImag += inputBuffer[n] * Math.sin(angle);
      }
      
      output[k] = { real: sumReal, imag: sumImag };
    }
    
    return output;
  };

  // Inverse FFT
  const ifft = (complexBuffer) => {
    const N = complexBuffer.length;
    const output = new Float32Array(N);
    
    for (let n = 0; n < N; n++) {
      let sum = 0;
      
      for (let k = 0; k < N; k++) {
        const angle = 2 * Math.PI * k * n / N;
        sum += complexBuffer[k].real * Math.cos(angle) - complexBuffer[k].imag * Math.sin(angle);
      }
      
      output[n] = sum / N;
    }
    
    return output;
  };

  // Calculate magnitudes and phases from FFT result
  const extractMagnitudesAndPhases = (fftResult) => {
    const magnitudes = new Float32Array(fftResult.length);
    const phases = new Float32Array(fftResult.length);
    
    for (let i = 0; i < fftResult.length; i++) {
      magnitudes[i] = Math.sqrt(fftResult[i].real * fftResult[i].real + fftResult[i].imag * fftResult[i].imag);
      phases[i] = Math.atan2(fftResult[i].imag, fftResult[i].real);
    }
    
    return { magnitudes, phases };
  };

  // Reconstruct complex spectrum from magnitudes and phases
  const reconstructSpectrum = (magnitudes, phases) => {
    const spectrum = new Array(magnitudes.length);
    for (let i = 0; i < magnitudes.length; i++) {
      spectrum[i] = {
        real: magnitudes[i] * Math.cos(phases[i]),
        imag: magnitudes[i] * Math.sin(phases[i])
      };
    }
    return spectrum;
  };

  return {
    fft,
    ifft,
    extractMagnitudesAndPhases,
    reconstructSpectrum
  };
};
