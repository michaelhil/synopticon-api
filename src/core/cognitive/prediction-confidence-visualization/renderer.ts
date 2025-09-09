/**
 * @fileoverview Rendering System for Prediction Confidence Visualization
 * 
 * Handles all rendering operations including overview, detailed, and explanation modes.
 * Provides smooth animations and interactive visualization elements.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  VisualizationState,
  PredictionConfidenceVisualizationConfig,
  ExplanationData,
  VisualizationStyle,
  ConfidenceThresholds,
  ColorScheme
} from './types.js';

export interface Renderer {
  requestRender(): void;
  render(): void;
  renderOverview(): void;
  renderDetailed(): void;
  renderExplanation(): void;
  renderTemporalProgression(): void;
  renderInteractionHints(): void;
}

export const createRenderer = (
  config: Required<PredictionConfidenceVisualizationConfig>,
  state: VisualizationState,
  clearCanvas: () => void
): Renderer => {
  const {
    canvasWidth,
    canvasHeight,
    confidenceThresholds,
    colorScheme,
    visualizationStyle,
    enableInteractivity,
    showTemporalProgression,
    showUncertaintyBands
  } = config;

  /**
   * Request animation frame for smooth rendering
   */
  const requestRender = (): void => {
    if (state.animationFrame) {
      cancelAnimationFrame(state.animationFrame);
    }
    
    state.animationFrame = requestAnimationFrame(() => {
      render();
    });
  };

  /**
   * Main rendering function
   */
  const render = (): void => {
    if (!state.context || !state.currentConfidence) return;
    
    clearCanvas();
    
    switch (state.interactionMode) {
      case 'overview':
        renderOverview();
        break;
      case 'detailed':
        renderDetailed();
        break;
      case 'explanation':
        renderExplanation();
        break;
    }
    
    if (showTemporalProgression) {
      renderTemporalProgression();
    }
    
    renderInteractionHints();
  };

  /**
   * Render overview mode with overall confidence
   */
  const renderOverview = (): void => {
    if (!state.context || !state.currentConfidence) return;

    const confidence = state.currentConfidence.overallConfidence;
    const color = getConfidenceColor(confidence);
    
    // Main confidence bar
    const barHeight = 40;
    const barY = (canvasHeight - barHeight) / 2;
    const barWidth = canvasWidth - 100;
    
    // Background bar with rounded corners
    drawRoundedRect(state.context, 50, barY, barWidth, barHeight, 8, '#374151');
    
    // Confidence bar with gradient
    const gradient = state.context.createLinearGradient(50, barY, 50 + barWidth * confidence, barY);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, adjustColorBrightness(color, 0.8));
    
    drawRoundedRect(state.context, 50, barY, barWidth * confidence, barHeight, 8, gradient);
    
    // Uncertainty bands
    if (showUncertaintyBands && state.currentConfidence.uncertaintyBounds) {
      renderUncertaintyBands(barY, barHeight, barWidth);
    }
    
    // Confidence text with shadow
    drawTextWithShadow(
      state.context,
      `${(confidence * 100).toFixed(1)}%`,
      canvasWidth / 2,
      barY - 20,
      '24px Arial',
      colorScheme.text,
      'center'
    );
    
    // Confidence label
    drawTextWithShadow(
      state.context,
      getConfidenceLabel(confidence),
      canvasWidth / 2,
      barY + barHeight + 30,
      '14px Arial',
      colorScheme.text,
      'center'
    );

    // Trend indicator
    if (state.currentConfidence.temporalTrend !== 0) {
      renderTrendIndicator(confidence, barY, barHeight);
    }
  };

  /**
   * Render detailed mode with feature breakdown
   */
  const renderDetailed = (): void => {
    if (!state.context || !state.currentConfidence) return;

    const features = Array.from(state.currentConfidence.featureConfidences.entries());
    const featureHeight = Math.max(25, (canvasHeight - 80) / features.length);
    const barWidth = canvasWidth - 200;
    
    state.context.font = '12px Arial';
    
    features.forEach(([featureName, confidence], index) => {
      const y = 40 + index * featureHeight;
      const color = getConfidenceColor(confidence);
      const isSelected = featureName === state.selectedFeature;
      
      // Feature label with truncation
      state.context.fillStyle = isSelected ? colorScheme.highConfidence : colorScheme.text;
      state.context.textAlign = 'left';
      const truncatedName = truncateText(featureName, 130, state.context);
      state.context.fillText(truncatedName, 10, y + featureHeight / 2 + 4);
      
      // Background bar with rounded corners
      const barY = y + 5;
      const barHeight = featureHeight - 10;
      drawRoundedRect(state.context, 150, barY, barWidth, barHeight, 4, '#374151');
      
      // Confidence bar with animation effect
      const animatedWidth = barWidth * confidence;
      const gradient = state.context.createLinearGradient(150, barY, 150 + animatedWidth, barY);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, adjustColorBrightness(color, 0.9));
      
      drawRoundedRect(state.context, 150, barY, animatedWidth, barHeight, 4, gradient);
      
      // Confidence percentage
      state.context.fillStyle = colorScheme.text;
      state.context.textAlign = 'right';
      state.context.fillText(
        `${(confidence * 100).toFixed(1)}%`,
        canvasWidth - 10,
        y + featureHeight / 2 + 4
      );
      
      // Highlight selected feature
      if (isSelected) {
        state.context.strokeStyle = colorScheme.highConfidence;
        state.context.lineWidth = 2;
        state.context.setLineDash([5, 3]);
        state.context.strokeRect(148, barY - 2, barWidth + 4, barHeight + 4);
        state.context.setLineDash([]);
      }
      
      // Hover effect
      if (featureName === state.selectedFeature) {
        state.context.fillStyle = 'rgba(255, 255, 255, 0.1)';
        state.context.fillRect(5, y, canvasWidth - 10, featureHeight);
      }
    });
  };

  /**
   * Render explanation mode with detailed insights
   */
  const renderExplanation = (): void => {
    if (!state.context) return;

    if (!state.currentConfidence?.explanation) {
      renderOverview();
      return;
    }
    
    const explanation = state.currentConfidence.explanation;
    const textLines = formatExplanationText(explanation);
    
    state.context.fillStyle = colorScheme.text;
    state.context.font = '14px Arial';
    state.context.textAlign = 'left';
    
    let y = 30;
    const lineHeight = 22;
    const maxWidth = canvasWidth - 40;
    
    textLines.forEach(line => {
      if (line.startsWith('•')) {
        // Bullet point
        state.context.fillStyle = colorScheme.mediumConfidence;
        state.context.fillText('•', 20, y);
        state.context.fillStyle = colorScheme.text;
        
        const bulletText = line.substring(1).trim();
        const wrappedLines = wrapText(bulletText, maxWidth - 15, state.context);
        
        wrappedLines.forEach((wrappedLine, lineIndex) => {
          state.context.fillText(wrappedLine, 35, y + lineIndex * lineHeight);
        });
        
        y += wrappedLines.length * lineHeight;
      } else if (line.endsWith(':')) {
        // Header
        state.context.fillStyle = colorScheme.highConfidence;
        state.context.font = 'bold 16px Arial';
        state.context.fillText(line, 20, y);
        state.context.font = '14px Arial';
        y += lineHeight + 5;
      } else {
        // Regular text
        state.context.fillStyle = colorScheme.text;
        const wrappedLines = wrapText(line, maxWidth, state.context);
        
        wrappedLines.forEach(wrappedLine => {
          state.context.fillText(wrappedLine, 20, y);
          y += lineHeight;
        });
      }
    });

    // Add confidence summary box
    renderConfidenceSummaryBox(y + 20);
  };

  /**
   * Render temporal progression indicators
   */
  const renderTemporalProgression = (): void => {
    if (!state.context) return;

    const historyData = state.confidenceHistory.filter(item => item !== null);
    if (historyData.length < 2) return;
    
    const progressionHeight = 60;
    const progressionY = canvasHeight - progressionHeight - 10;
    const progressionWidth = canvasWidth - 20;
    
    // Background with gradient
    const bgGradient = state.context.createLinearGradient(0, progressionY, 0, progressionY + progressionHeight);
    bgGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    
    drawRoundedRect(state.context, 10, progressionY, progressionWidth, progressionHeight, 8, bgGradient);
    
    // Trend line with glow effect
    state.context.strokeStyle = colorScheme.mediumConfidence;
    state.context.lineWidth = 3;
    state.context.shadowColor = colorScheme.mediumConfidence;
    state.context.shadowBlur = 10;
    state.context.beginPath();
    
    historyData.forEach((item, index) => {
      const x = 15 + (index / (historyData.length - 1)) * (progressionWidth - 10);
      const y = progressionY + progressionHeight - 10 - (item.overallConfidence * (progressionHeight - 20));
      
      if (index === 0) {
        state.context.moveTo(x, y);
      } else {
        state.context.lineTo(x, y);
      }
    });
    
    state.context.stroke();
    state.context.shadowBlur = 0;
    
    // Current position indicator with pulse effect
    const currentX = canvasWidth - 15;
    const currentY = progressionY + progressionHeight - 10 - 
      (state.currentConfidence!.overallConfidence * (progressionHeight - 20));
    
    const pulseRadius = 4 + Math.sin(Date.now() * 0.01) * 2;
    state.context.fillStyle = colorScheme.highConfidence;
    state.context.beginPath();
    state.context.arc(currentX, currentY, pulseRadius, 0, 2 * Math.PI);
    state.context.fill();
  };

  /**
   * Render interaction hints and mode indicators
   */
  const renderInteractionHints = (): void => {
    if (!enableInteractivity || !state.context) return;
    
    const hints = [
      `Mode: ${state.interactionMode}`,
      'Click to cycle modes',
      'Hover for details',
      'Tab/Space: Navigate'
    ];
    
    const hintWidth = 160;
    const hintHeight = hints.length * 16 + 15;
    
    // Background with rounded corners
    drawRoundedRect(
      state.context,
      canvasWidth - hintWidth - 5,
      5,
      hintWidth,
      hintHeight,
      8,
      'rgba(0, 0, 0, 0.8)'
    );
    
    state.context.fillStyle = colorScheme.text;
    state.context.font = '10px Arial';
    state.context.textAlign = 'left';
    
    hints.forEach((hint, index) => {
      const color = index === 0 ? colorScheme.mediumConfidence : colorScheme.text;
      state.context.fillStyle = color;
      state.context.fillText(hint, canvasWidth - hintWidth, 20 + index * 16);
    });
  };

  /**
   * Render uncertainty bands for confidence visualization
   */
  const renderUncertaintyBands = (barY: number, barHeight: number, barWidth: number): void => {
    if (!state.context || !state.currentConfidence?.uncertaintyBounds) return;

    const bounds = state.currentConfidence.uncertaintyBounds;
    const currentConfidence = state.currentConfidence.overallConfidence;
    
    // Upper bound
    if (bounds.upper > currentConfidence) {
      const upperStart = 50 + barWidth * currentConfidence;
      const upperWidth = barWidth * (bounds.upper - currentConfidence);
      
      const upperGradient = state.context.createLinearGradient(upperStart, barY, upperStart + upperWidth, barY);
      upperGradient.addColorStop(0, 'rgba(156, 163, 175, 0.3)');
      upperGradient.addColorStop(1, 'rgba(156, 163, 175, 0.1)');
      
      drawRoundedRect(state.context, upperStart, barY, upperWidth, barHeight, 4, upperGradient);
    }
    
    // Lower bound
    if (bounds.lower < currentConfidence) {
      const lowerWidth = barWidth * bounds.lower;
      
      const lowerGradient = state.context.createLinearGradient(50, barY, 50 + lowerWidth, barY);
      lowerGradient.addColorStop(0, 'rgba(156, 163, 175, 0.1)');
      lowerGradient.addColorStop(1, 'rgba(156, 163, 175, 0.3)');
      
      drawRoundedRect(state.context, 50, barY, lowerWidth, barHeight, 4, lowerGradient);
    }
  };

  /**
   * Render confidence summary box in explanation mode
   */
  const renderConfidenceSummaryBox = (startY: number): void => {
    if (!state.context || !state.currentConfidence) return;

    const boxHeight = 80;
    const boxY = Math.min(startY, canvasHeight - boxHeight - 10);
    
    // Background box
    drawRoundedRect(
      state.context,
      20,
      boxY,
      canvasWidth - 40,
      boxHeight,
      8,
      'rgba(0, 0, 0, 0.3)'
    );
    
    // Summary statistics
    const stats = [
      `Overall: ${(state.currentConfidence.overallConfidence * 100).toFixed(1)}%`,
      `Trend: ${state.currentConfidence.temporalTrend > 0 ? '↗' : state.currentConfidence.temporalTrend < 0 ? '↘' : '→'}`,
      `Type: ${state.currentConfidence.predictionType}`,
      `Features: ${state.currentConfidence.featureConfidences.size}`
    ];
    
    state.context.font = '12px Arial';
    state.context.fillStyle = colorScheme.text;
    
    stats.forEach((stat, index) => {
      const x = 30 + (index % 2) * (canvasWidth - 60) / 2;
      const y = boxY + 25 + Math.floor(index / 2) * 20;
      state.context.fillText(stat, x, y);
    });
  };

  /**
   * Render trend indicator
   */
  const renderTrendIndicator = (confidence: number, barY: number, barHeight: number): void => {
    if (!state.context || !state.currentConfidence) return;

    const trend = state.currentConfidence.temporalTrend;
    const x = 50 + (canvasWidth - 100) * confidence + 15;
    const y = barY + barHeight / 2;
    
    state.context.fillStyle = trend > 0 ? colorScheme.highConfidence : colorScheme.lowConfidence;
    state.context.font = '16px Arial';
    state.context.textAlign = 'center';
    state.context.fillText(trend > 0 ? '↗' : '↘', x, y + 5);
  };

  // Utility functions
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= confidenceThresholds.high) {
      return colorScheme.highConfidence;
    } else if (confidence >= confidenceThresholds.medium) {
      return colorScheme.mediumConfidence;
    } else {
      return colorScheme.lowConfidence;
    }
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= confidenceThresholds.high) {
      return 'High Confidence';
    } else if (confidence >= confidenceThresholds.medium) {
      return 'Medium Confidence';
    } else {
      return 'Low Confidence';
    }
  };

  const formatExplanationText = (explanation: ExplanationData): string[] => {
    const lines: string[] = [];
    
    switch (visualizationStyle) {
      case 'technical':
        lines.push('Technical Analysis:');
        if (explanation.featureAttributions) {
          lines.push('• Key Features:');
          explanation.featureAttributions.forEach(attr => {
            lines.push(`  - ${attr.feature}: ${(attr.importance * 100).toFixed(1)}%`);
          });
        }
        if (explanation.uncertainty) {
          lines.push(`• Uncertainty: ±${(explanation.uncertainty * 100).toFixed(1)}%`);
        }
        break;
        
      case 'simple':
        lines.push('Confidence Summary:');
        lines.push(explanation.summary || 'Based on current data analysis');
        if (explanation.primaryFactors) {
          lines.push('• Main factors:');
          explanation.primaryFactors.forEach(factor => {
            lines.push(`  - ${factor}`);
          });
        }
        break;
        
      case 'balanced':
      default:
        lines.push('Prediction Confidence Analysis:');
        lines.push(explanation.summary || 'Analyzing multiple data sources');
        if (explanation.keyInsights) {
          explanation.keyInsights.forEach(insight => {
            lines.push(`• ${insight}`);
          });
        }
        break;
    }
    
    return lines;
  };

  // Helper functions
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle: string | CanvasGradient
  ): void => {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  };

  const drawTextWithShadow = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    fillStyle: string,
    textAlign: CanvasTextAlign
  ): void => {
    ctx.font = font;
    ctx.textAlign = textAlign;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText(text, x + 1, y + 1);
    
    // Main text
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
  };

  const truncateText = (text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
  };

  const wrapText = (text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const adjustColorBrightness = (color: string, factor: number): string => {
    // Simple brightness adjustment - in a real implementation, 
    // you might want to use a proper color manipulation library
    return color;
  };

  return {
    requestRender,
    render,
    renderOverview,
    renderDetailed,
    renderExplanation,
    renderTemporalProgression,
    renderInteractionHints
  };
};