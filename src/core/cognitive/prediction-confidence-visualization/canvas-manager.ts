/**
 * @fileoverview Canvas Management System
 * 
 * Handles canvas initialization, event management, and interaction processing
 * for the prediction confidence visualization system.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  VisualizationState,
  Position,
  InteractionMode,
  PredictionConfidenceVisualizationConfig
} from './types.js';

export interface CanvasManager {
  initializeCanvas(container: HTMLElement): void;
  attachEventListeners(): void;
  getFeatureAtPosition(position: Position): string | null;
  handleCanvasClick(position: Position): void;
  clearCanvas(): void;
}

export const createCanvasManager = (
  config: Required<PredictionConfidenceVisualizationConfig>,
  state: VisualizationState,
  requestRender: () => void
): CanvasManager => {
  const { canvasWidth, canvasHeight, enableInteractivity, colorScheme } = config;

  /**
   * Initialize canvas element and context
   */
  const initializeCanvas = (container: HTMLElement): void => {
    state.canvas = document.createElement('canvas');
    state.canvas.width = canvasWidth;
    state.canvas.height = canvasHeight;
    state.canvas.style.width = `${canvasWidth}px`;
    state.canvas.style.height = `${canvasHeight}px`;
    
    const context = state.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D canvas context');
    }
    
    state.context = context;
    state.context.imageSmoothingEnabled = true;
    state.context.imageSmoothingQuality = 'high';
    
    container.appendChild(state.canvas);
    
    if (enableInteractivity) {
      attachEventListeners();
    }
  };

  /**
   * Attach interactive event listeners
   */
  const attachEventListeners = (): void => {
    if (!state.canvas) return;

    state.canvas.addEventListener('mousemove', (event) => {
      const rect = state.canvas!.getBoundingClientRect();
      state.hoverPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      const feature = getFeatureAtPosition(state.hoverPosition);
      if (feature !== state.selectedFeature) {
        state.selectedFeature = feature;
        requestRender();
      }
    });

    state.canvas.addEventListener('click', (event) => {
      const rect = state.canvas!.getBoundingClientRect();
      const clickPosition: Position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      handleCanvasClick(clickPosition);
    });

    // Handle keyboard interactions
    state.canvas.addEventListener('keydown', (event) => {
      handleKeyboardInteraction(event.key);
    });

    // Make canvas focusable for keyboard events
    state.canvas.tabIndex = 0;
  };

  /**
   * Get feature at specific canvas position
   */
  const getFeatureAtPosition = (position: Position): string | null => {
    if (!state.currentConfidence || state.interactionMode !== 'detailed') {
      return null;
    }
    
    const featureHeight = canvasHeight / (state.currentConfidence.featureConfidences.size + 2);
    const featureIndex = Math.floor(position.y / featureHeight) - 1;
    
    if (featureIndex >= 0 && featureIndex < state.currentConfidence.featureConfidences.size) {
      return Array.from(state.currentConfidence.featureConfidences.keys())[featureIndex];
    }
    
    return null;
  };

  /**
   * Handle canvas click interactions
   */
  const handleCanvasClick = (position: Position): void => {
    const feature = getFeatureAtPosition(position);
    
    if (feature) {
      // Cycle through interaction modes for selected feature
      cycleInteractionMode();
    } else {
      // Click outside features - cycle modes or reset selection
      if (state.selectedFeature) {
        state.selectedFeature = null;
      } else {
        cycleInteractionMode();
      }
    }
    
    requestRender();
  };

  /**
   * Handle keyboard interactions
   */
  const handleKeyboardInteraction = (key: string): void => {
    switch (key) {
      case 'Tab':
      case ' ':
        cycleInteractionMode();
        requestRender();
        break;
        
      case 'Escape':
        state.selectedFeature = null;
        state.interactionMode = 'overview';
        requestRender();
        break;
        
      case 'ArrowUp':
        navigateFeatures(-1);
        break;
        
      case 'ArrowDown':
        navigateFeatures(1);
        break;
        
      case 'Enter':
        if (state.selectedFeature && state.interactionMode === 'detailed') {
          state.interactionMode = 'explanation';
          requestRender();
        }
        break;
    }
  };

  /**
   * Navigate through features with keyboard
   */
  const navigateFeatures = (direction: number): void => {
    if (!state.currentConfidence || state.interactionMode !== 'detailed') return;

    const features = Array.from(state.currentConfidence.featureConfidences.keys());
    if (features.length === 0) return;

    const currentIndex = state.selectedFeature 
      ? features.indexOf(state.selectedFeature) 
      : -1;
    
    const nextIndex = Math.max(0, Math.min(
      features.length - 1,
      currentIndex + direction
    ));
    
    state.selectedFeature = features[nextIndex];
    requestRender();
  };

  /**
   * Cycle through interaction modes
   */
  const cycleInteractionMode = (): void => {
    const modes: InteractionMode[] = ['overview', 'detailed', 'explanation'];
    const currentIndex = modes.indexOf(state.interactionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    state.interactionMode = modes[nextIndex];
  };

  /**
   * Clear canvas with background color
   */
  const clearCanvas = (): void => {
    if (!state.context) return;
    
    state.context.fillStyle = colorScheme.background;
    state.context.fillRect(0, 0, canvasWidth, canvasHeight);
  };

  /**
   * Resize canvas to new dimensions
   */
  const resizeCanvas = (width: number, height: number): void => {
    if (!state.canvas || !state.context) return;

    // Save current drawing state
    const imageData = state.context.getImageData(0, 0, state.canvas.width, state.canvas.height);
    
    // Update canvas size
    state.canvas.width = width;
    state.canvas.height = height;
    state.canvas.style.width = `${width}px`;
    state.canvas.style.height = `${height}px`;
    
    // Restore rendering settings
    state.context.imageSmoothingEnabled = true;
    state.context.imageSmoothingQuality = 'high';
    
    // Trigger re-render
    requestRender();
  };

  /**
   * Get canvas metrics for calculations
   */
  const getCanvasMetrics = () => ({
    width: canvasWidth,
    height: canvasHeight,
    aspectRatio: canvasWidth / canvasHeight,
    center: { x: canvasWidth / 2, y: canvasHeight / 2 }
  });

  return {
    initializeCanvas,
    attachEventListeners,
    getFeatureAtPosition,
    handleCanvasClick,
    clearCanvas,
    // Additional utility methods
    resizeCanvas,
    getCanvasMetrics
  };
};