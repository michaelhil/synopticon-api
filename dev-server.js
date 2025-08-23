/**
 * Simple development server using Bun for Synopticon API
 * synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization
 * Serves static files for behavioral analysis demos
 */

const server = Bun.serve({
  port: process.env.PORT || 8080,
  async fetch(request) {
    const url = new URL(request.url);
    let filePath = url.pathname;
    
    // Default to demo-mediapipe.html
    if (filePath === '/') {
      filePath = '/demo-mediapipe.html';
    }
    
    try {
      const file = Bun.file(`.${filePath}`);
      
      // Check if file exists
      if (!(await file.exists())) {
        return new Response('File not found', { status: 404 });
      }
      
      // Determine content type
      const contentType = getContentType(filePath);
      
      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      
    } catch (error) {
      console.error('Server error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
});

// Helper function to determine content type
const getContentType = (filePath) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const mimeTypes = {
    'html': 'text/html',
    'js': 'application/javascript',
    'css': 'text/css',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject'
  };
  
  return mimeTypes[ext] || 'text/plain';
};

console.log(`🚀 Development server running at http://localhost:${server.port}`);
console.log(`📱 Open http://localhost:${server.port} in your browser to test the MediaPipe demo`);
console.log('⚡ Using Bun for ultra-fast serving');