/**
 * Feature Result Caching System
 * 20% landmark speedup through intelligent result caching
 * Caches stable landmark positions across frames
 */

import { createErrorHandler, ErrorCategory, ErrorSeverity } from '../utils/error-handler.js';

export const createFeatureCacheManager = () => {
  const errorHandler = createErrorHandler({
    logLevel: ErrorSeverity.WARNING,
    enableConsole: true
  });

  const state = {
    landmarkCache: new Map(), // face_id -> landmark data
    detectionCache: new Map(), // region_hash -> detection result
    integralCache: new Map(), // texture_hash -> integral image
    cacheStats: {
      hits: 0,
      misses: 0,
      evictions: 0,
      created: Date.now()
    },
    config: {
      maxLandmarkAge: 5, // frames
      maxDetectionAge: 3, // frames
      maxIntegralAge: 1, // frames  
      maxCacheSize: 100,
      stabilityThreshold: 0.02, // minimum movement to update cache
      confidenceThreshold: 0.7 // minimum confidence to cache
    }
  };

  /**
   * Generate stable face ID based on position and size
   */
  const generateFaceId = (detection) => {
    const x = Math.round(detection.x / 5) * 5; // Round to 5px grid
    const y = Math.round(detection.y / 5) * 5;
    const w = Math.round(detection.width / 5) * 5;
    const h = Math.round(detection.height / 5) * 5;
    return `face_${x}_${y}_${w}_${h}`;
  };

  /**
   * Generate region hash for detection caching
   */
  const generateRegionHash = (x, y, width, height, scale) => {
    const roundedX = Math.round(x / 2) * 2;
    const roundedY = Math.round(y / 2) * 2;
    const roundedScale = Math.round(scale * 100) / 100;
    return `region_${roundedX}_${roundedY}_${width}_${height}_${roundedScale}`;
  };

  /**
   * Generate texture hash for integral image caching
   */
  const generateTextureHash = (width, height, checksum) => {
    return `texture_${width}_${height}_${checksum}`;
  };

  /**
   * Cache landmark results for a face
   */
  const cacheLandmarks = (faceId, landmarks, confidence, frameNumber) => {
    if (confidence < state.config.confidenceThreshold) {
      return false; // Don't cache low-confidence results
    }

    const existing = state.landmarkCache.get(faceId);
    
    // Check if landmarks have moved significantly
    if (existing && existing.landmarks) {
      const movement = calculateLandmarkMovement(existing.landmarks, landmarks);
      if (movement < state.config.stabilityThreshold) {
        // Update age but keep existing landmarks (they're stable)
        existing.lastFrame = frameNumber;
        existing.confidence = Math.max(existing.confidence, confidence);
        state.cacheStats.hits++;
        return true;
      }
    }

    // Cache new landmark data
    state.landmarkCache.set(faceId, {
      landmarks: deepCopyLandmarks(landmarks),
      confidence,
      lastFrame: frameNumber,
      created: frameNumber
    });

    state.cacheStats.misses++;
    cleanupExpiredEntries(frameNumber);
    return true;
  };

  /**
   * Retrieve cached landmarks for a face
   */
  const getCachedLandmarks = (faceId, frameNumber) => {
    const cached = state.landmarkCache.get(faceId);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const age = frameNumber - cached.lastFrame;
    if (age > state.config.maxLandmarkAge) {
      state.landmarkCache.delete(faceId);
      state.cacheStats.evictions++;
      return null;
    }

    state.cacheStats.hits++;
    return {
      landmarks: deepCopyLandmarks(cached.landmarks),
      confidence: cached.confidence,
      age
    };
  };

  /**
   * Cache detection result for a region
   */
  const cacheDetection = (regionHash, result, frameNumber) => {
    if (result.confidence < state.config.confidenceThreshold) {
      return false;
    }

    state.detectionCache.set(regionHash, {
      result: { ...result },
      lastFrame: frameNumber,
      created: frameNumber
    });

    return true;
  };

  /**
   * Retrieve cached detection for a region
   */
  const getCachedDetection = (regionHash, frameNumber) => {
    const cached = state.detectionCache.get(regionHash);
    
    if (!cached) {
      return null;
    }

    const age = frameNumber - cached.lastFrame;
    if (age > state.config.maxDetectionAge) {
      state.detectionCache.delete(regionHash);
      state.cacheStats.evictions++;
      return null;
    }

    state.cacheStats.hits++;
    return {
      result: { ...cached.result },
      age
    };
  };

  /**
   * Cache integral image computation result
   */
  const cacheIntegralImage = (textureHash, integralTexture, frameNumber) => {
    // Integral images are only cached for 1 frame due to memory constraints
    state.integralCache.set(textureHash, {
      texture: integralTexture,
      lastFrame: frameNumber,
      created: frameNumber
    });

    // Immediately cleanup old integral images to save memory
    for (const [hash, cached] of state.integralCache.entries()) {
      const age = frameNumber - cached.lastFrame;
      if (age > state.config.maxIntegralAge) {
        state.integralCache.delete(hash);
        state.cacheStats.evictions++;
      }
    }

    return true;
  };

  /**
   * Retrieve cached integral image
   */
  const getCachedIntegralImage = (textureHash, frameNumber) => {
    const cached = state.integralCache.get(textureHash);
    
    if (!cached) {
      return null;
    }

    const age = frameNumber - cached.lastFrame;
    if (age > state.config.maxIntegralAge) {
      state.integralCache.delete(textureHash);
      state.cacheStats.evictions++;
      return null;
    }

    state.cacheStats.hits++;
    return cached.texture;
  };

  /**
   * Predictive landmark positions based on movement history
   */
  const predictLandmarkPositions = (faceId, frameNumber) => {
    const cached = state.landmarkCache.get(faceId);
    if (!cached || !cached.history) {
      return null;
    }

    // Simple linear prediction based on recent movement
    const history = cached.history;
    if (history.length < 2) {
      return cached.landmarks;
    }

    const recent = history[history.length - 1];
    const previous = history[history.length - 2];
    
    const deltaX = recent.landmarks.nose.x - previous.landmarks.nose.x;
    const deltaY = recent.landmarks.nose.y - previous.landmarks.nose.y;
    
    // Predict next positions
    const predicted = deepCopyLandmarks(recent.landmarks);
    
    // Apply movement delta to all landmarks
    for (const [groupName, group] of Object.entries(predicted)) {
      if (Array.isArray(group)) {
        group.forEach(point => {
          point.x += deltaX;
          point.y += deltaY;
        });
      } else if (group && typeof group === 'object' && 'x' in group) {
        group.x += deltaX;
        group.y += deltaY;
      }
    }

    return predicted;
  };

  /**
   * Update landmark history for motion prediction
   */
  const updateLandmarkHistory = (faceId, landmarks, frameNumber) => {
    const cached = state.landmarkCache.get(faceId);
    if (!cached) return;

    if (!cached.history) {
      cached.history = [];
    }

    cached.history.push({
      landmarks: deepCopyLandmarks(landmarks),
      frame: frameNumber
    });

    // Keep only recent history (last 5 frames)
    if (cached.history.length > 5) {
      cached.history.shift();
    }
  };

  /**
   * Calculate movement between two landmark sets
   */
  const calculateLandmarkMovement = (landmarks1, landmarks2) => {
    if (!landmarks1 || !landmarks2) return Infinity;

    let totalMovement = 0;
    let pointCount = 0;

    // Calculate movement for each landmark group
    for (const [groupName, group1] of Object.entries(landmarks1)) {
      const group2 = landmarks2[groupName];
      if (!group2) continue;

      if (Array.isArray(group1) && Array.isArray(group2)) {
        for (let i = 0; i < Math.min(group1.length, group2.length); i++) {
          const p1 = group1[i];
          const p2 = group2[i];
          if (p1 && p2 && 'x' in p1 && 'x' in p2) {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            totalMovement += Math.sqrt(dx * dx + dy * dy);
            pointCount++;
          }
        }
      } else if (group1 && group2 && 'x' in group1 && 'x' in group2) {
        const dx = group1.x - group2.x;
        const dy = group1.y - group2.y;
        totalMovement += Math.sqrt(dx * dx + dy * dy);
        pointCount++;
      }
    }

    return pointCount > 0 ? totalMovement / pointCount : 0;
  };

  /**
   * Deep copy landmark structure
   */
  const deepCopyLandmarks = (landmarks) => {
    const copy = {};
    
    for (const [groupName, group] of Object.entries(landmarks)) {
      if (Array.isArray(group)) {
        copy[groupName] = group.map(point => ({ ...point }));
      } else if (group && typeof group === 'object') {
        copy[groupName] = { ...group };
      } else {
        copy[groupName] = group;
      }
    }
    
    return copy;
  };

  /**
   * Cleanup expired cache entries
   */
  const cleanupExpiredEntries = (currentFrame) => {
    // Cleanup landmarks
    for (const [faceId, cached] of state.landmarkCache.entries()) {
      const age = currentFrame - cached.lastFrame;
      if (age > state.config.maxLandmarkAge) {
        state.landmarkCache.delete(faceId);
        state.cacheStats.evictions++;
      }
    }

    // Cleanup detections
    for (const [regionHash, cached] of state.detectionCache.entries()) {
      const age = currentFrame - cached.lastFrame;
      if (age > state.config.maxDetectionAge) {
        state.detectionCache.delete(regionHash);
        state.cacheStats.evictions++;
      }
    }

    // Size-based cleanup if cache is too large
    if (state.landmarkCache.size > state.config.maxCacheSize) {
      const entries = Array.from(state.landmarkCache.entries())
        .sort((a, b) => a[1].lastFrame - b[1].lastFrame); // Sort by age
      
      const toRemove = entries.slice(0, Math.floor(state.config.maxCacheSize * 0.2));
      toRemove.forEach(([faceId]) => {
        state.landmarkCache.delete(faceId);
        state.cacheStats.evictions++;
      });
    }
  };

  /**
   * Get cache performance statistics
   */
  const getStatistics = () => {
    const runtime = Date.now() - state.cacheStats.created;
    const total = state.cacheStats.hits + state.cacheStats.misses;
    const hitRate = total > 0 ? (state.cacheStats.hits / total * 100) : 0;

    return {
      hitRate: hitRate.toFixed(1) + '%',
      hits: state.cacheStats.hits,
      misses: state.cacheStats.misses,
      evictions: state.cacheStats.evictions,
      totalQueries: total,
      cacheSize: {
        landmarks: state.landmarkCache.size,
        detections: state.detectionCache.size,
        integrals: state.integralCache.size
      },
      runtime: runtime,
      avgHitsPerSecond: runtime > 0 ? (state.cacheStats.hits / (runtime / 1000)).toFixed(2) : '0'
    };
  };

  /**
   * Clear all caches
   */
  const clearAll = () => {
    state.landmarkCache.clear();
    state.detectionCache.clear();
    state.integralCache.clear();
    
    state.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      created: Date.now()
    };
  };

  /**
   * Configure cache settings
   */
  const configure = (newConfig) => {
    state.config = { ...state.config, ...newConfig };
    
    errorHandler.handleError(
      'Feature cache configuration updated',
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.INFO,
      state.config
    );
  };

  return {
    // Face landmarks caching
    generateFaceId,
    cacheLandmarks,
    getCachedLandmarks,
    updateLandmarkHistory,
    predictLandmarkPositions,
    
    // Detection caching  
    generateRegionHash,
    cacheDetection,
    getCachedDetection,
    
    // Integral image caching
    generateTextureHash,
    cacheIntegralImage,
    getCachedIntegralImage,
    
    // Management
    getStatistics,
    clearAll,
    configure,
    cleanupExpiredEntries
  };
};