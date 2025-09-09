/**
 * Camera Sensor Abstraction
 * Unified interface for camera devices using shared infrastructure
 */

import type { FrameData } from '../../common/types';
import type { DistributionOptions } from '../../common/distribution/universal-distributor';

export interface CameraDeviceInfo {
  id: string;
  label: string;
  type: 'webcam' | 'ip_camera' | 'usb_camera';
  resolution: { width: number; height: number };
  maxFPS: number;
}

export interface CameraConfig {
  deviceId: string;
  resolution?: { width: number; height: number };
  fps?: number;
  format?: 'rgb' | 'rgba' | 'yuv' | 'bgr';
}

// Camera stream initialization helper
const initializeCameraStream = async (config: CameraConfig): Promise<MediaStream> => {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: config.deviceId,
      width: config.resolution?.width || 640,
      height: config.resolution?.height || 480,
      frameRate: config.fps || 30
    }
  });
};

// Frame capture helper
const captureVideoFrame = (
  stream: MediaStream,
  config: CameraConfig,
  frameCount: number
): Promise<FrameData | null> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const frameData: FrameData = {
          timestamp: BigInt(Date.now() * 1000),
          sequenceNumber: frameCount,
          sourceId: config.deviceId,
          sourceType: 'sensor',
          width: canvas.width,
          height: canvas.height,
          format: config.format || 'rgba',
          data: new Uint8Array(imageData.data.buffer)
        };
        
        resolve(frameData);
      } else {
        resolve(null);
      }
    };
  });
};

// Factory function for camera sensor
export const createCameraSensor = (config: CameraConfig) => {
  let isActive = false;
  let stream: MediaStream | null = null;
  let frameCount = 0;

  const start = async (): Promise<boolean> => {
    try {
      stream = await initializeCameraStream(config);
      isActive = true;
      return true;
    } catch (error) {
      console.error('Camera start failed:', error);
      return false;
    }
  };

  const stop = async (): Promise<void> => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    isActive = false;
  };

  const captureFrame = (): Promise<FrameData | null> => {
    if (!stream || !isActive) {
      return Promise.resolve(null);
    }
    return captureVideoFrame(stream, config, frameCount++);
  };

  return {
    start,
    stop,
    captureFrame,
    isActive: () => isActive,
    getConfig: () => ({ ...config }),
    getStats: () => ({
      frameCount,
      isActive,
      deviceId: config.deviceId
    })
  };
};
