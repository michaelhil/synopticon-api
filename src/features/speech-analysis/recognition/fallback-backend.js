/**
 * Fallback Speech Recognition Backend
 * Comprehensive text input simulation with full UI and interaction support
 */

import {
  createSpeechRecognitionResult,
  createSpeechWord,
  createSpeechEvent
} from '../../../core/configuration/types.ts';

import {
  createStyledButton,
  updateStatusIndicator,
  updateRecognitionHistory,
  createMainContainer,
  createHeaderSection,
  createInstructionsPanelElement,
  makeDraggableElement
} from './fallback-ui-creator.js';

export const createFallbackBackend = () => {
  let textInput = null;
  let inputContainer = null;
  let isActive = false;
  let statusIndicator = null;
  let instructionsPanel = null;
  let historyPanel = null;
  let recognitionHistory = [];

  const checkAvailability = async (state) => {
    console.log('🔍 Checking fallback backend availability...');
    console.log('Runtime check:', state.runtime);
    const available = state.runtime.isBrowser; 
    console.log('✅ Fallback backend available:', available);
    return available; 
  };

  const initialize = async (state) => {
    if (!state.runtime.isBrowser) {
      throw new Error('Fallback backend requires browser environment');
    }

    // Create comprehensive text input interface for speech simulation
    console.log('🔄 Setting up comprehensive speech recognition fallback (text input)...');
    createComprehensiveTextInputInterface(state);
    console.log('✅ Speech recognition fallback ready');
  };

  const createComprehensiveTextInputInterface = (state) => {
    inputContainer = createMainContainer();
    const headerData = createHeaderSection();
    statusIndicator = headerData.statusIndicator;
    inputContainer.appendChild(headerData.headerContainer);
    inputContainer.appendChild(createInstructionsPanelElement());
    createMainInputArea(state);
    createControlButtons(state);
    createHistoryPanel();
    createSettingsPanel(state);
    makeDraggableElement(inputContainer);
    document.body.appendChild(inputContainer);
  };


  const createMainInputArea = (state) => {
    // Create text input with enhanced features
    textInput = document.createElement('textarea');
    textInput.placeholder = 'Type text to simulate speech recognition...\n\nTip: Try phrases like "Hello world", "What is the weather today?", or "Set a reminder for 3 PM"';
    textInput.style.cssText = `
      width: 100%;
      height: 120px;
      margin-bottom: 12px;
      padding: 12px;
      border: 2px solid #ced4da;
      border-radius: 8px;
      resize: vertical;
      font-size: 14px;
      box-sizing: border-box;
      font-family: inherit;
      line-height: 1.4;
      transition: border-color 0.2s ease;
      background: white;
    `;

    // Add focus styling
    textInput.onfocus = () => {
      textInput.style.borderColor = '#007bff';
      textInput.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
    };
    
    textInput.onblur = () => {
      textInput.style.borderColor = '#ced4da';
      textInput.style.boxShadow = 'none';
    };

    // Add character counter
    const charCounter = document.createElement('div');
    charCounter.style.cssText = 'font-size: 11px; color: #6c757d; margin-bottom: 10px; text-align: right;';
    charCounter.textContent = '0 characters';
    
    textInput.oninput = () => {
      const {length} = textInput.value;
      charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
      charCounter.style.color = length > 500 ? '#dc3545' : '#6c757d';
    };

    inputContainer.appendChild(textInput);
    inputContainer.appendChild(charCounter);

    // Add comprehensive keyboard support
    setupKeyboardSupport(state);
  };

  const setupKeyboardSupport = (state) => {
    const abortController = new AbortController();
    
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText(state, textInput.value, true);
      } else if (e.key === 'Escape') {
        textInput.blur();
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendText(state, textInput.value, false); // Send as interim
        } else if (e.key === 'k') {
          e.preventDefault();
          textInput.value = '';
          textInput.dispatchEvent(new Event('input'));
        }
      }
    }, { signal: abortController.signal });
    
    // Store cleanup function
    state.cleanupEventListeners = () => {
      abortController.abort();
    };
  };

  const createControlButtons = (state) => {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;';

    // Send as Final button
    const sendButton = createStyledButton('✓ Send as Final', '#28a745', () => {
      sendText(state, textInput.value, true);
    });

    // Send as Interim button
    const interimButton = createStyledButton('⏳ Send as Interim', '#17a2b8', () => {
      sendText(state, textInput.value, false);
    });

    // Clear button
    const clearButton = createStyledButton('🗑️ Clear', '#dc3545', () => {
      textInput.value = '';
      textInput.dispatchEvent(new Event('input'));
      textInput.focus();
    });

    // Quick phrases button
    const phrasesButton = createStyledButton('💬 Quick Phrases', '#6f42c1', () => {
      showQuickPhrases(state);
    });

    buttonContainer.appendChild(sendButton);
    buttonContainer.appendChild(interimButton);
    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(phrasesButton);
    inputContainer.appendChild(buttonContainer);
  };


  const createHistoryPanel = () => {
    const historyContainer = document.createElement('div');
    historyContainer.style.cssText = 'margin-bottom: 15px;';
    
    const historyHeader = document.createElement('div');
    historyHeader.innerHTML = '<strong>📝 Recent Inputs</strong>';
    historyHeader.style.cssText = 'font-size: 13px; margin-bottom: 8px; color: #495057;';
    
    historyPanel = document.createElement('div');
    historyPanel.style.cssText = `
      max-height: 100px;
      overflow-y: auto;
      background: #f8f9fa;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      color: #6c757d;
    `;
    historyPanel.textContent = 'No recent inputs';
    
    historyContainer.appendChild(historyHeader);
    historyContainer.appendChild(historyPanel);
    inputContainer.appendChild(historyContainer);
  };

  const createSettingsPanel = (state) => {
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = 'border-top: 1px solid #dee2e6; padding-top: 12px; font-size: 12px;';
    
    // Continuous mode toggle
    const continuousLabel = document.createElement('label');
    continuousLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;';
    
    const continuousCheckbox = document.createElement('input');
    continuousCheckbox.type = 'checkbox';
    continuousCheckbox.checked = state.continuous;
    continuousCheckbox.onchange = () => {
      state.continuous = continuousCheckbox.checked;
      updateStatusIndicator(statusIndicator, state.continuous ? 'Continuous Mode' : 'Single Mode');
    };
    
    continuousLabel.appendChild(continuousCheckbox);
    continuousLabel.appendChild(document.createTextNode('Continuous Mode'));
    
    // Interim results toggle
    const interimLabel = document.createElement('label');
    interimLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';
    
    const interimCheckbox = document.createElement('input');
    interimCheckbox.type = 'checkbox';
    interimCheckbox.checked = state.interimResults;
    interimCheckbox.onchange = () => {
      state.interimResults = interimCheckbox.checked;
    };
    
    interimLabel.appendChild(interimCheckbox);
    interimLabel.appendChild(document.createTextNode('Show Interim Results'));
    
    settingsContainer.appendChild(continuousLabel);
    settingsContainer.appendChild(interimLabel);
    inputContainer.appendChild(settingsContainer);
  };

  const createPhraseMenu = () => {
    const phraseMenu = document.createElement('div');
    phraseMenu.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    `;
    return phraseMenu;
  };

  const createPhraseOption = (phrase, phraseMenu) => {
    const option = document.createElement('div');
    option.textContent = phrase;
    option.style.cssText = `
      padding: 10px;
      cursor: pointer;
      border-bottom: 1px solid #f8f9fa;
      font-size: 13px;
      transition: background-color 0.2s ease;
    `;
    
    option.onmouseover = () => option.style.backgroundColor = '#f8f9fa';
    option.onmouseout = () => option.style.backgroundColor = 'transparent';
    
    option.onclick = () => {
      textInput.value = phrase;
      textInput.dispatchEvent(new Event('input'));
      textInput.focus();
      phraseMenu.remove();
    };
    
    return option;
  };

  const showQuickPhrases = (state) => {
    const phrases = [
      'Hello, how are you today?',
      'What is the weather like?',
      'Set a reminder for 3 PM',
      'Call Mom',
      'Navigate to the nearest restaurant',
      'Play some relaxing music',
      'What time is it?',
      'Schedule a meeting for tomorrow',
      'Turn on the lights',
      'What\'s on my calendar today?'
    ];
    
    const phraseMenu = createPhraseMenu();
    
    phrases.forEach(phrase => {
      const option = createPhraseOption(phrase, phraseMenu);
      phraseMenu.appendChild(option);
    });
    
    const closeMenu = (e) => {
      if (!phraseMenu.contains(e.target)) {
        phraseMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
    
    inputContainer.style.position = 'relative';
    inputContainer.appendChild(phraseMenu);
  };




  const createSpeechResultFromText = (trimmedText, confidence, isFinal, state) => {
    const words = trimmedText.split(' ').map((word, index) => 
      createSpeechWord({
        word: word.trim(),
        confidence: confidence + (Math.random() * 0.1 - 0.05),
        startTime: index * 0.3,
        endTime: (index + 1) * 0.3
      })
    ).filter(word => word.word.length > 0);

    return createSpeechRecognitionResult({
      transcript: trimmedText,
      confidence,
      isFinal,
      isInterim: !isFinal,
      words: isFinal ? words : [],
      language: state.language,
      processingTime: Math.random() * 50 + 10,
      source: 'fallback_input'
    });
  };

  const updateRecognitionMetrics = (state, trimmedText, words, confidence, isFinal) => {
    if (isFinal) {
      state.finalTranscript += (state.finalTranscript ? ' ' : '') + trimmedText;
      state.metrics.totalWords += words.length;
      
      const currentWords = state.metrics.totalWords;
      const previousWords = currentWords - words.length;
      const previousAvg = state.metrics.averageConfidence;
      
      state.metrics.averageConfidence = 
        (previousAvg * previousWords + confidence * words.length) / currentWords;
    } else {
      state.currentTranscript = trimmedText;
    }
  };

  const notifyResultCallbacks = (state, speechResult, isFinal) => {
    const callbackType = isFinal ? 'onResult' : 'onInterimResult';
    if (state.callbacks[callbackType]) {
      state.callbacks[callbackType].forEach(callback => {
        try {
          callback(speechResult);
        } catch (error) {
          console.warn(`Fallback ${callbackType} callback error:`, error);
        }
      });
    }
  };

  const sendText = (state, text, isFinal) => {
    if (!text.trim()) return;

    const trimmedText = text.trim();
    const confidence = 0.85 + (Math.random() * 0.1);
    
    const speechResult = createSpeechResultFromText(trimmedText, confidence, isFinal, state);
    const {words} = speechResult;
    
    updateRecognitionMetrics(state, trimmedText, words, confidence, isFinal);
    updateRecognitionHistory(historyPanel, recognitionHistory, trimmedText, isFinal ? 'final' : 'interim');
    updateStatusIndicator(statusIndicator, isFinal ? 'Final Result Sent' : 'Interim Result Sent');
    setTimeout(() => updateStatusIndicator(statusIndicator, 'Ready'), 2000);
    
    notifyResultCallbacks(state, speechResult, isFinal);

    if (isFinal && !state.continuous) {
      textInput.value = '';
      textInput.dispatchEvent(new Event('input'));
    }

    console.log(`📤 Fallback backend sent ${isFinal ? 'final' : 'interim'} result:`, trimmedText);
  };

  const start = async (state) => {
    if (inputContainer) {
      inputContainer.style.display = 'block';
      isActive = true;
      updateStatusIndicator(statusIndicator, 'Listening');
      
      // Focus the text input
      if (textInput) {
        setTimeout(() => textInput.focus(), 100);
      }
      
      // Notify speech start
      if (state.callbacks.onSpeechStart) {
        state.callbacks.onSpeechStart.forEach(callback => {
          try {
            callback(createSpeechEvent({
              type: 'speech_start',
              data: { source: 'fallback' }
            }));
          } catch (error) {
            console.warn('Speech start callback error:', error);
          }
        });
      }
    }
  };

  const stop = async (state) => {
    if (inputContainer) {
      inputContainer.style.display = 'none';
      isActive = false;
      updateStatusIndicator(statusIndicator, 'Stopped');
      
      // Notify speech end
      if (state.callbacks.onSpeechEnd) {
        state.callbacks.onSpeechEnd.forEach(callback => {
          try {
            callback(createSpeechEvent({
              type: 'speech_end',
              data: { source: 'fallback' }
            }));
          } catch (error) {
            console.warn('Speech end callback error:', error);
          }
        });
      }
    }
  };

  const cleanup = async (state) => {
    // Cleanup event listeners
    if (state.cleanupEventListeners) {
      state.cleanupEventListeners();
    }
    
    // Remove UI elements
    if (inputContainer && inputContainer.parentNode) {
      inputContainer.parentNode.removeChild(inputContainer);
    }
    
    // Reset state
    textInput = null;
    inputContainer = null;
    isActive = false;
    statusIndicator = null;
    instructionsPanel = null;
    historyPanel = null;
    recognitionHistory = [];

    console.log('🧹 Fallback backend cleaned up');
  };

  return {
    checkAvailability,
    initialize,
    start,
    stop,
    cleanup
  };
};