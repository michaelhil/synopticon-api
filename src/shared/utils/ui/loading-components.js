/**
 * Loading UI Components
 * Provides user-friendly loading indicators and progress displays for lazy-loaded pipelines
 */

import { escapeHtml } from '../html-utils.js';

/**
 * Create a loading spinner component
 * @param {Object} options - Spinner options
 * @returns {HTMLElement} - Spinner element
 */
export const createLoadingSpinner = (options = {}) => {
  const config = {
    size: options.size || 'medium', // small, medium, large
    color: options.color || '#007acc',
    text: options.text || 'Loading...',
    showText: options.showText !== false,
    className: options.className || '',
    ...options
  };

  const container = document.createElement('div');
  container.className = `loading-spinner ${config.className}`;
  
  // Size-based styling
  const sizeMap = {
    small: { size: 20, stroke: 2 },
    medium: { size: 32, stroke: 3 },
    large: { size: 48, stroke: 4 }
  };
  
  const sizeConfig = sizeMap[config.size] || sizeMap.medium;
  
  container.innerHTML = `
    <div class="spinner-container" style="
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <svg width="${sizeConfig.size}" height="${sizeConfig.size}" viewBox="0 0 50 50" style="
        animation: spin 1s linear infinite;
      ">
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#e0e0e0"
          stroke-width="${sizeConfig.stroke}"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="${config.color}"
          stroke-width="${sizeConfig.stroke}"
          stroke-dasharray="31.416"
          stroke-dashoffset="15.708"
          stroke-linecap="round"
          style="
            animation: spinner-dash 1.4s ease-in-out infinite;
          "
        />
      </svg>
      ${config.showText ? `<span style="
        color: #666;
        font-size: 14px;
        font-weight: 500;
      ">${escapeHtml(config.text)}</span>` : ''}
    </div>
  `;

  // Add CSS animations if not already present
  if (!document.getElementById('loading-spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-spinner-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes spinner-dash {
        0% {
          stroke-dasharray: 1, 150;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -124;
        }
      }
    `;
    document.head.appendChild(style);
  }

  return container;
};

/**
 * Create a progress bar component
 * @param {Object} options - Progress bar options
 * @returns {HTMLElement} - Progress bar element
 */
export const createProgressBar = (options = {}) => {
  const config = {
    width: options.width || '300px',
    height: options.height || '8px',
    color: options.color || '#007acc',
    backgroundColor: options.backgroundColor || '#e0e0e0',
    showPercentage: options.showPercentage !== false,
    showLabel: options.showLabel !== false,
    label: options.label || 'Loading Pipeline...',
    className: options.className || '',
    ...options
  };

  const container = document.createElement('div');
  container.className = `progress-bar-container ${config.className}`;
  
  container.innerHTML = `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      width: ${config.width};
    ">
      ${config.showLabel ? `
        <div class="progress-label" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          font-size: 13px;
          color: #666;
        ">
          <span class="progress-text">${escapeHtml(config.label)}</span>
          ${config.showPercentage ? '<span class="progress-percentage">0%</span>' : ''}
        </div>
      ` : ''}
      
      <div class="progress-track" style="
        width: 100%;
        height: ${config.height};
        background-color: ${config.backgroundColor};
        border-radius: ${parseInt(config.height) / 2}px;
        overflow: hidden;
        position: relative;
      ">
        <div class="progress-fill" style="
          height: 100%;
          width: 0%;
          background-color: ${config.color};
          border-radius: inherit;
          transition: width 0.3s ease-in-out;
          position: relative;
        ">
          <div class="progress-glow" style="
            position: absolute;
            top: 0;
            right: -10px;
            width: 10px;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
            border-radius: inherit;
          "></div>
        </div>
      </div>
    </div>
  `;

  const updateProgress = (percentage, label) => {
    const fill = container.querySelector('.progress-fill');
    const percentageElement = container.querySelector('.progress-percentage');
    const textElement = container.querySelector('.progress-text');
    
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
    
    if (percentageElement) {
      percentageElement.textContent = `${Math.round(percentage)}%`;
    }
    
    if (textElement && label) {
      textElement.textContent = label;
    }
  };

  container.updateProgress = updateProgress;
  
  return container;
};

/**
 * Create a pipeline loading card
 * @param {string} pipelineName - Name of the pipeline
 * @param {Object} options - Card options
 * @returns {HTMLElement} - Loading card element
 */
export const createPipelineLoadingCard = (pipelineName, options = {}) => {
  const config = {
    showIcon: options.showIcon !== false,
    showDescription: options.showDescription !== false,
    description: options.description || 'Preparing pipeline for use...',
    compact: options.compact === true,
    className: options.className || '',
    ...options
  };

  const pipelineIcons = {
    'mediapipe-face': '👤',
    'mediapipe-face-mesh': '🔍',
    'emotion-analysis': '😊',
    'age-estimation': '📊',
    'iris-tracking': '👁️',
    'eye-tracking': '👀',
    'speech-analysis': '🎤'
  };

  const pipelineDescriptions = {
    'mediapipe-face': 'Loading face detection pipeline...',
    'mediapipe-face-mesh': 'Loading facial landmark detection...',
    'emotion-analysis': 'Loading emotion recognition system...',
    'age-estimation': 'Loading age estimation model...',
    'iris-tracking': 'Loading iris tracking system...',
    'eye-tracking': 'Loading eye tracking hardware...',
    'speech-analysis': 'Loading speech analysis engine...'
  };

  const icon = pipelineIcons[pipelineName] || '🔬';
  const description = config.description || pipelineDescriptions[pipelineName] || 'Loading pipeline...';
  
  const card = document.createElement('div');
  card.className = `pipeline-loading-card ${config.className}`;
  
  const cardStyle = config.compact ? `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  ` : `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
    max-width: 300px;
  `;

  card.innerHTML = `
    <div style="${cardStyle}">
      ${config.showIcon ? `
        <div class="pipeline-icon" style="
          font-size: ${config.compact ? '16px' : '24px'};
          margin-bottom: ${config.compact ? '0' : '8px'};
        ">${icon}</div>
      ` : ''}
      
      <div class="pipeline-info" style="
        display: flex;
        flex-direction: ${config.compact ? 'row' : 'column'};
        align-items: ${config.compact ? 'center' : 'center'};
        gap: ${config.compact ? '8px' : '4px'};
        flex: 1;
      ">
        <div class="pipeline-name" style="
          font-weight: 600;
          color: #333;
          font-size: ${config.compact ? '13px' : '16px'};
        ">${escapeHtml(pipelineName)}</div>
        
        ${config.showDescription && !config.compact ? `
          <div class="pipeline-description" style="
            font-size: 12px;
            color: #666;
            margin-bottom: 12px;
          ">${escapeHtml(description)}</div>
        ` : ''}
      </div>
      
      <div class="loading-indicator">
        ${createLoadingSpinner({
          size: config.compact ? 'small' : 'medium',
          showText: false
        }).outerHTML}
      </div>
    </div>
  `;

  return card;
};

/**
 * Create a loading overlay for the entire application
 * @param {Object} options - Overlay options
 * @returns {HTMLElement} - Overlay element
 */
export const createLoadingOverlay = (options = {}) => {
  const config = {
    message: options.message || 'Initializing Synopticon API...',
    showProgress: options.showProgress !== false,
    progress: options.progress || 0,
    zIndex: options.zIndex || 10000,
    backgroundColor: options.backgroundColor || 'rgba(255, 255, 255, 0.95)',
    className: options.className || '',
    ...options
  };

  const overlay = document.createElement('div');
  overlay.className = `loading-overlay ${config.className}`;
  
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${config.backgroundColor};
      backdrop-filter: blur(2px);
      z-index: ${config.zIndex};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
      <div style="
        background: #fff;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        text-align: center;
        min-width: 320px;
      ">
        <div style="margin-bottom: 16px;">
          ${createLoadingSpinner({ size: 'large', showText: false }).outerHTML}
        </div>
        
        <div style="
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        ">${escapeHtml(config.message)}</div>
        
        ${config.showProgress ? `
          <div style="margin-top: 16px;">
            ${createProgressBar({
              width: '100%',
              showLabel: false,
              showPercentage: true
            }).outerHTML}
          </div>
        ` : ''}
        
        <div style="
          font-size: 12px;
          color: #666;
          margin-top: 12px;
        ">This may take a few seconds...</div>
      </div>
    </div>
  `;

  const updateProgress = (percentage, message) => {
    const progressBar = overlay.querySelector('.progress-bar-container');
    const messageElement = overlay.querySelector('div[style*="font-weight: 600"]');
    
    if (progressBar && progressBar.updateProgress) {
      progressBar.updateProgress(percentage);
    }
    
    if (messageElement && message) {
      messageElement.textContent = message;
    }
  };

  const remove = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  overlay.updateProgress = updateProgress;
  overlay.remove = remove;

  return overlay;
};

/**
 * Create a toast notification for loading events
 * @param {string} message - Notification message
 * @param {Object} options - Toast options
 * @returns {HTMLElement} - Toast element
 */
export const createLoadingToast = (message, options = {}) => {
  const config = {
    type: options.type || 'info', // info, success, warning, error
    duration: options.duration || 3000,
    position: options.position || 'top-right', // top-right, top-left, bottom-right, bottom-left
    showIcon: options.showIcon !== false,
    className: options.className || '',
    ...options
  };

  const typeStyles = {
    info: { color: '#007acc', backgroundColor: '#e7f3ff', borderColor: '#007acc' },
    success: { color: '#28a745', backgroundColor: '#d4edda', borderColor: '#28a745' },
    warning: { color: '#ffc107', backgroundColor: '#fff3cd', borderColor: '#ffc107' },
    error: { color: '#dc3545', backgroundColor: '#f8d7da', borderColor: '#dc3545' }
  };

  const typeIcons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  const positionStyles = {
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' }
  };

  const style = typeStyles[config.type];
  const position = positionStyles[config.position];

  const toast = document.createElement('div');
  toast.className = `loading-toast ${config.className}`;

  toast.innerHTML = `
    <div style="
      position: fixed;
      ${Object.entries(position).map(([k, v]) => `${k}: ${v}`).join('; ')};
      background: ${style.backgroundColor};
      color: ${style.color};
      border: 1px solid ${style.borderColor};
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    ">
      ${config.showIcon ? `<span style="font-size: 16px;">${typeIcons[config.type]}</span>` : ''}
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  // Add slide-in animation if not already present
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto-remove after duration
  if (config.duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, config.duration);
  }

  return toast;
};

/**
 * Show a loading toast notification
 * @param {string} message - Toast message
 * @param {Object} options - Toast options
 */
export const showLoadingToast = (message, options = {}) => {
  const toast = createLoadingToast(message, options);
  document.body.appendChild(toast);
  return toast;
};