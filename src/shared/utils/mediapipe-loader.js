/**
 * MediaPipe Specific Loading Module
 * Specialized utilities for MediaPipe library management
 */

import { loadDependency } from './dependency-resolver.js';

// MediaPipe-specific utilities
export const createMediaPipeLoader = (dependencies) => {
  let faceMesh = null;
  let iris = null;

  const loadFaceMesh = async (options = {}) => {
    await loadDependency(dependencies, 'mediapipeFaceMesh');
    
    if (!faceMesh) {
      faceMesh = new window.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });

      faceMesh.setOptions({
        maxNumFaces: options.maxNumFaces || 1,
        refineLandmarks: options.refineLandmarks !== false,
        minDetectionConfidence: options.minDetectionConfidence || 0.5,
        minTrackingConfidence: options.minTrackingConfidence || 0.5
      });
    }

    return faceMesh;
  };

  const loadIris = async (options = {}) => {
    await loadDependency(dependencies, 'mediapipeIris');
    
    if (!iris) {
      iris = new window.Iris({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/${file}`;
        }
      });

      iris.setOptions({
        maxNumFaces: options.maxNumFaces || 1,
        minDetectionConfidence: options.minDetectionConfidence || 0.5,
        minTrackingConfidence: options.minTrackingConfidence || 0.5
      });
    }

    return iris;
  };

  const cleanup = async () => {
    if (faceMesh) {
      await faceMesh.close();
      faceMesh = null;
    }
    if (iris) {
      await iris.close();
      iris = null;
    }
  };

  return {
    loadFaceMesh,
    loadIris,
    cleanup,
    isLoaded: () => ({ faceMesh: Boolean(faceMesh), iris: Boolean(iris) })
  };
};
