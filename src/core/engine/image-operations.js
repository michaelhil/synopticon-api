/**
 * Core image processing operations
 */

export const IMAGE_FORMATS = {
  RGB: { channels: 3, bytesPerPixel: 3 },
  RGBA: { channels: 4, bytesPerPixel: 4 },
  GRAYSCALE: { channels: 1, bytesPerPixel: 1 },
  BGR: { channels: 3, bytesPerPixel: 3 }
};

export const INTERPOLATION_METHODS = {
  NEAREST: 'nearest',
  BILINEAR: 'bilinear',
  BICUBIC: 'bicubic'
};

export const createImageOperations = (resourcePool) => {
  
  const resizeImage = (imageData, targetWidth, targetHeight, method = INTERPOLATION_METHODS.BILINEAR) => {
    const { data, width, height } = imageData;
    const channels = data.length / (width * height);
    
    // Get canvas from resource pool
    const canvas = resourcePool.acquire('Canvas', targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    try {
      // Create temporary canvas for source image
      const sourceCanvas = resourcePool.acquire('Canvas', width, height);
      const sourceCtx = sourceCanvas.getContext('2d');
      
      // Put image data on source canvas
      const sourceImageData = sourceCtx.createImageData(width, height);
      sourceImageData.data.set(data);
      sourceCtx.putImageData(sourceImageData, 0, 0);
      
      // Configure interpolation
      if (method === INTERPOLATION_METHODS.NEAREST) {
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = method === INTERPOLATION_METHODS.BICUBIC ? 'high' : 'medium';
      }
      
      // Resize
      ctx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);
      
      // Get resized image data
      const resizedImageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      
      // Return to pool
      resourcePool.release('Canvas', sourceCanvas);
      resourcePool.release('Canvas', canvas);
      
      return {
        data: resizedImageData.data,
        width: targetWidth,
        height: targetHeight,
        channels
      };
      
    } catch (error) {
      // Ensure cleanup on error
      resourcePool.release('Canvas', canvas);
      throw error;
    }
  };

  const convertColorSpace = (imageData, fromFormat, toFormat) => {
    const { data, width, height } = imageData;
    const fromChannels = IMAGE_FORMATS[fromFormat]?.channels || 3;
    const toChannels = IMAGE_FORMATS[toFormat]?.channels || 3;
    
    const outputData = new Uint8Array(width * height * toChannels);
    
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * fromChannels;
      const dstIdx = i * toChannels;
      
      if (fromFormat === 'RGB' && toFormat === 'GRAYSCALE') {
        // RGB to Grayscale
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        outputData[dstIdx] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      } else if (fromFormat === 'RGBA' && toFormat === 'RGB') {
        // RGBA to RGB
        outputData[dstIdx] = data[srcIdx];
        outputData[dstIdx + 1] = data[srcIdx + 1];
        outputData[dstIdx + 2] = data[srcIdx + 2];
      } else if (fromFormat === 'RGB' && toFormat === 'BGR') {
        // RGB to BGR
        outputData[dstIdx] = data[srcIdx + 2];
        outputData[dstIdx + 1] = data[srcIdx + 1];
        outputData[dstIdx + 2] = data[srcIdx];
      } else {
        // Copy as-is for unsupported conversions
        for (let c = 0; c < Math.min(fromChannels, toChannels); c++) {
          outputData[dstIdx + c] = data[srcIdx + c];
        }
      }
    }
    
    return {
      data: outputData,
      width,
      height,
      channels: toChannels
    };
  };

  const cropImage = (imageData, x, y, width, height) => {
    const { data, width: srcWidth, height: srcHeight } = imageData;
    const channels = data.length / (srcWidth * srcHeight);
    
    // Validate crop region
    const cropX = Math.max(0, Math.min(x, srcWidth));
    const cropY = Math.max(0, Math.min(y, srcHeight));
    const cropWidth = Math.min(width, srcWidth - cropX);
    const cropHeight = Math.min(height, srcHeight - cropY);
    
    const croppedData = new Uint8Array(cropWidth * cropHeight * channels);
    
    for (let row = 0; row < cropHeight; row++) {
      for (let col = 0; col < cropWidth; col++) {
        const srcIdx = ((cropY + row) * srcWidth + (cropX + col)) * channels;
        const dstIdx = (row * cropWidth + col) * channels;
        
        for (let c = 0; c < channels; c++) {
          croppedData[dstIdx + c] = data[srcIdx + c];
        }
      }
    }
    
    return {
      data: croppedData,
      width: cropWidth,
      height: cropHeight,
      channels
    };
  };

  const applyFilter = (imageData, filterType, intensity = 1.0) => {
    const { data, width, height } = imageData;
    const channels = data.length / (width * height);
    const filteredData = new Uint8Array(data);
    
    switch (filterType) {
      case 'brightness':
        for (let i = 0; i < filteredData.length; i += channels) {
          for (let c = 0; c < Math.min(3, channels); c++) {
            filteredData[i + c] = Math.min(255, Math.max(0, filteredData[i + c] + intensity * 50));
          }
        }
        break;
        
      case 'contrast':
        const factor = (259 * (intensity * 100 + 255)) / (255 * (259 - intensity * 100));
        for (let i = 0; i < filteredData.length; i += channels) {
          for (let c = 0; c < Math.min(3, channels); c++) {
            filteredData[i + c] = Math.min(255, Math.max(0, factor * (filteredData[i + c] - 128) + 128));
          }
        }
        break;
        
      case 'blur':
        // Simple box blur
        applyBoxBlur(filteredData, width, height, channels, Math.max(1, intensity * 3));
        break;
        
      default:
        console.warn(`Unknown filter type: ${filterType}`);
    }
    
    return {
      data: filteredData,
      width,
      height,
      channels
    };
  };

  return {
    resizeImage,
    convertColorSpace,
    cropImage,
    applyFilter
  };
};

// Helper function for box blur
const applyBoxBlur = (data, width, height, channels, radius) => {
  const original = new Uint8Array(data);
  const kernelSize = radius * 2 + 1;
  const kernelArea = kernelSize * kernelSize;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * channels;
      
      for (let c = 0; c < Math.min(3, channels); c++) {
        let sum = 0;
        let count = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const ny = y + ky;
            const nx = x + kx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * channels + c;
              sum += original[idx];
              count++;
            }
          }
        }
        
        data[centerIdx + c] = Math.round(sum / count);
      }
    }
  }
};