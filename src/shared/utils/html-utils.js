/**
 * HTML Security Utilities
 * Provides safe HTML escaping to prevent XSS attacks
 */

/**
 * Escape HTML characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - HTML-escaped string
 */
export const escapeHtml = (str) => {
  if (typeof str !== 'string') {
    return String(str);
  }
  
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  return str.replace(/[&<>"'`=\/]/g, (char) => htmlEscapeMap[char]);
};

/**
 * Create text node safely (alternative to innerHTML)
 * @param {string} text - Text content
 * @returns {Text} - DOM text node
 */
export const createTextNode = (text) => {
  return document.createTextNode(String(text));
};

/**
 * Set text content safely without XSS risk
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export const setTextContent = (element, text) => {
  element.textContent = String(text);
};

/**
 * Create HTML element with safe text content
 * @param {string} tagName - HTML tag name
 * @param {string} textContent - Safe text content
 * @param {Object} attributes - Element attributes
 * @returns {HTMLElement} - Created element
 */
export const createElement = (tagName, textContent = '', attributes = {}) => {
  const element = document.createElement(tagName);
  
  if (textContent) {
    element.textContent = String(textContent);
  }
  
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  
  return element;
};

/**
 * Validate and sanitize CSS values
 * @param {Object} styles - CSS style object
 * @returns {Object} - Sanitized styles
 */
export const sanitizeStyles = (styles) => {
  const safe = {};
  
  for (const [property, value] of Object.entries(styles)) {
    const strValue = String(value);
    
    // Block dangerous CSS patterns
    if (strValue.includes('javascript:') || 
        strValue.includes('expression(') ||
        strValue.includes('@import') ||
        strValue.includes('url(') && !strValue.match(/^url\(['"]?[a-zA-Z0-9\-_.\/]+['"]?\)$/)) {
      continue; // Skip dangerous values
    }
    
    safe[property] = strValue;
  }
  
  return safe;
};

/**
 * Apply styles safely to element
 * @param {HTMLElement} element - Target element
 * @param {Object} styles - CSS styles to apply
 */
export const applyStyles = (element, styles) => {
  const safeStyles = sanitizeStyles(styles);
  
  for (const [property, value] of Object.entries(safeStyles)) {
    element.style[property] = value;
  }
};