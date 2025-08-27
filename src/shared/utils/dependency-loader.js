/**
 * Dependency loading utilities for external ML libraries
 * Provides dynamic loading and availability checking for MediaPipe
 * Pure MediaPipe implementation - NO TensorFlow dependencies
 */

// Import modular components
import { isDependencyAvailable, getDependencyInfo, checkSystemCapabilities } from './system-capabilities.js';
import { loadDependency, loadDependencies, createDependencyInitializer } from './dependency-resolver.js';
import { createMediaPipeLoader } from './mediapipe-loader.js';

// Dependency registry with CDN URLs, SRI hashes, and security info
const DEPENDENCIES = {
  mediapipe: {
    name: 'MediaPipe',
    globalName: 'mediapipe',
    scripts: [
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js',
        integrity: 'sha384-K9YmDx2dQvL3xGq5N7bHzP8jF1vYnM4eR6tWzQ5sA2hD9oC8lE3fH6yB7xN1qM9p',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/camera_utils.js'
      },
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6.1640029074/control_utils.js',
        integrity: 'sha384-P7xM9wQ2vL8jH5nF3yR6tA1sE4dG9hK2bC5xN7pQ8mT1oW6vB3yL9nF5jH8pM2qX',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/control_utils.js'
      },
      {
        url: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1640029074/drawing_utils.js',
        integrity: 'sha384-R8pN3wL6vF5jM9yB2xH1qT7dE8nC4mK9sA5hG3oL7bX6pR1wF4nJ8vQ2yT5hL9mN',
        crossorigin: 'anonymous',
        fallback: '/assets/vendor/mediapipe/drawing_utils.js'
      }
    ],
    check: () => typeof window !== 'undefined' && window.mediapipe
  },
  mediapipeFaceMesh: {
    name: 'MediaPipe Face Mesh',
    globalName: 'FaceMesh',
    scripts: [{
      url: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js',
      integrity: 'sha384-T5bJ8nL2xF9qM6yH3pW1vR7dC4eG5hK8mA9sL2oX7bY6pT1wF9nJ3vQ5yH8pM1qR',
      crossorigin: 'anonymous',
      fallback: '/assets/vendor/mediapipe/face_mesh.js'
    }],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.FaceMesh
  },
  mediapipeIris: {
    name: 'MediaPipe Iris',
    globalName: 'Iris', 
    scripts: [{
      url: 'https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/iris.js',
      integrity: 'sha384-W9qX7nL8yF2mH5pT3vR1dB6eG9hK2mA5sL8oY7bX6pW1vB3yL9nF5jH8pM7qT1R',
      crossorigin: 'anonymous', 
      fallback: '/assets/vendor/mediapipe/iris.js'
    }],
    dependencies: ['mediapipe'],
    check: () => typeof window !== 'undefined' && window.Iris
  }
};

// Export functions with DEPENDENCIES bound
export const isDependencyAvailableLocal = (dependencyKey) => 
  isDependencyAvailable(DEPENDENCIES, dependencyKey);

export const loadDependencyLocal = async (dependencyKey) => 
  loadDependency(DEPENDENCIES, dependencyKey);

export const loadDependenciesLocal = async (dependencyKeys) =>
  loadDependencies(DEPENDENCIES, dependencyKeys);

export const getDependencyInfoLocal = (dependencyKey) =>
  getDependencyInfo(DEPENDENCIES, dependencyKey);

export const checkSystemCapabilitiesLocal = () =>
  checkSystemCapabilities(DEPENDENCIES);

export const createMediaPipeLoaderLocal = () =>
  createMediaPipeLoader(DEPENDENCIES);

export const createDependencyInitializerLocal = (dependencyKeys) =>
  createDependencyInitializer(DEPENDENCIES, dependencyKeys);

// Export with original names for backward compatibility
export {
  isDependencyAvailableLocal as isDependencyAvailable,
  loadDependencyLocal as loadDependency,
  loadDependenciesLocal as loadDependencies,
  getDependencyInfoLocal as getDependencyInfo,
  checkSystemCapabilitiesLocal as checkSystemCapabilities,
  createMediaPipeLoaderLocal as createMediaPipeLoader,
  createDependencyInitializerLocal as createDependencyInitializer
};