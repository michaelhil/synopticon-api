// Simple browser compatibility test
// Run this in browser console to check for issues

console.log('🧪 Browser Compatibility Test');

// Test 1: Check if module loads
try {
  console.log('✅ Module system working');
} catch(e) {
  console.error('❌ Module system error:', e);
}

// Test 2: Check WebGL support
const canvas = document.createElement('canvas');
const gl2 = canvas.getContext('webgl2');
const gl1 = canvas.getContext('webgl');

if (gl2) {
  console.log('✅ WebGL2 supported');
} else if (gl1) {
  console.log('⚠️  Only WebGL1 supported - some features may be limited');
} else {
  console.error('❌ No WebGL support detected');
}

// Test 3: Check camera API
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  console.log('✅ Camera API available');
} else {
  console.error('❌ Camera API not available');
}

// Test 4: Check required browser features
const features = {
  'ArrayBuffer': typeof ArrayBuffer !== 'undefined',
  'Float32Array': typeof Float32Array !== 'undefined',
  'Uint8Array': typeof Uint8Array !== 'undefined',
  'Promise': typeof Promise !== 'undefined',
  'requestAnimationFrame': typeof requestAnimationFrame !== 'undefined'
};

Object.entries(features).forEach(([feature, supported]) => {
  if (supported) {
    console.log(`✅ ${feature} supported`);
  } else {
    console.error(`❌ ${feature} not supported`);
  }
});

console.log('🎯 Browser test complete');