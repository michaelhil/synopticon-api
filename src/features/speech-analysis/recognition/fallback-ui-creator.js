/**
 * UI creation utilities for fallback speech recognition
 */

// Helper functions for UI creation
export const createStyledButton = (text, color, onClick) => {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.cssText = `
    background: ${color};
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    flex: 1;
    min-width: 80px;
  `;
  
  button.onmouseover = () => {
    button.style.opacity = '0.9';
    button.style.transform = 'translateY(-1px)';
  };
  
  button.onmouseout = () => {
    button.style.opacity = '1';
    button.style.transform = 'translateY(0)';
  };
  
  button.onclick = onClick;
  return button;
};

export const updateStatusIndicator = (statusIndicator, status) => {
  if (statusIndicator) {
    statusIndicator.textContent = status;
    statusIndicator.style.background = status.includes('Error') ? '#dc3545' : 
                                      status.includes('Listening') ? '#ffc107' : '#28a745';
  }
};

export const updateRecognitionHistory = (historyPanel, recognitionHistory, text, type) => {
  recognitionHistory.unshift({ text, type, timestamp: new Date().toLocaleTimeString() });
  if (recognitionHistory.length > 5) {
    recognitionHistory.splice(5);
  }
  
  historyPanel.innerHTML = recognitionHistory.map(item => 
    `<div style="margin-bottom: 4px; padding: 4px; background: white; border-radius: 4px;">
      <span style="font-weight: 500; color: ${item.type === 'final' ? '#28a745' : '#17a2b8'};">${item.type}</span>
      <span style="float: right; color: #adb5bd;">${item.timestamp}</span><br>
      <span style="color: #495057;">${item.text.substring(0, 50)}${item.text.length > 50 ? '...' : ''}</span>
    </div>`
  ).join('');
};

export const createMainContainer = () => {
  const container = document.createElement('div');
  container.id = 'speech-fallback-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(145deg, #f8f9fa, #e9ecef);
    border: 2px solid #dee2e6;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-width: 400px;
    max-width: 500px;
    display: none;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  `;
  return container;
};

export const createHeaderSection = () => {
  const headerContainer = document.createElement('div');
  headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';
  
  const header = document.createElement('div');
  header.innerHTML = '🎤 <strong>Speech Input Simulation</strong>';
  header.style.cssText = 'font-weight: bold; color: #495057; font-size: 16px;';
  
  const statusIndicator = document.createElement('div');
  statusIndicator.textContent = 'Ready';
  statusIndicator.style.cssText = `
    background: #28a745;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  `;
  
  headerContainer.appendChild(header);
  headerContainer.appendChild(statusIndicator);
  
  return { headerContainer, statusIndicator };
};

export const createInstructionsPanelElement = () => {
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
    padding: 12px;
    margin-bottom: 15px;
    border-radius: 6px;
    font-size: 13px;
    color: #1565c0;
    line-height: 1.4;
  `;
  panel.innerHTML = `
    <strong>💡 Instructions:</strong><br>
    • Type text and press <kbd>Enter</kbd> or click "Send as Final"<br>
    • Use <kbd>Shift+Enter</kbd> for new lines<br>
    • Click "Send as Interim" for partial results<br>
    • Toggle "Continuous Mode" for multiple inputs
  `;
  return panel;
};

// Draggable functionality
const setupDragHandlers = (element, state) => {
  const dragStart = (e) => {
    if (e.type === "touchstart") {
      state.initialX = e.touches[0].clientX - state.xOffset;
      state.initialY = e.touches[0].clientY - state.yOffset;
    } else {
      state.initialX = e.clientX - state.xOffset;
      state.initialY = e.clientY - state.yOffset;
    }

    if (e.target === state.header || state.header.contains(e.target)) {
      state.isDragging = true;
    }
  };

  const dragEnd = () => {
    state.initialX = state.currentX;
    state.initialY = state.currentY;
    state.isDragging = false;
  };

  const drag = (e) => {
    if (state.isDragging) {
      e.preventDefault();
      
      if (e.type === "touchmove") {
        state.currentX = e.touches[0].clientX - state.initialX;
        state.currentY = e.touches[0].clientY - state.initialY;
      } else {
        state.currentX = e.clientX - state.initialX;
        state.currentY = e.clientY - state.initialY;
      }

      state.xOffset = state.currentX;
      state.yOffset = state.currentY;

      element.style.transform = `translate3d(${state.currentX}px, ${state.currentY}px, 0)`;
    }
  };

  return { dragStart, drag, dragEnd };
};

export const makeDraggableElement = (element) => {
  const dragState = {
    isDragging: false,
    currentX: 0,
    currentY: 0,
    initialX: 0,
    initialY: 0,
    xOffset: 0,
    yOffset: 0,
    header: element.querySelector('div')
  };

  dragState.header.style.cursor = 'move';
  const handlers = setupDragHandlers(element, dragState);

  dragState.header.addEventListener("mousedown", handlers.dragStart);
  document.addEventListener("mousemove", handlers.drag);
  document.addEventListener("mouseup", handlers.dragEnd);
};