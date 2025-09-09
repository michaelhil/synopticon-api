/**
 * HTTPS Server for iOS Safari Camera Access
 * Factory function based HTTP server with SSL support
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read SSL certificates
const cert = readFileSync(join(__dirname, '../../../cert.pem'));
const key = readFileSync(join(__dirname, '../../../key.pem'));

// Import existing server setup
const createServer = async () => {
  const { createFaceAnalysisServer } = await import('./server.ts');
  
  // Get the base server configuration
  const serverConfig = await createFaceAnalysisServer();
  
  // Create HTTPS server with Bun
  const server = Bun.serve({
    port: 3443,
    tls: {
      cert,
      key
    },
    fetch: serverConfig.fetch,
    websocket: serverConfig.websocket,
    static: {
      '/': join(__dirname, '../../../'),
      '/examples': join(__dirname, '../../../examples')
    }
  });

  console.log('🔒 HTTPS Face Analysis API running on https://localhost:3443');
  console.log('📱 For iPhone access:');
  console.log('   1. Make sure iPhone is on same network');
  console.log('   2. Find your Mac IP: ifconfig | grep "inet " | grep -v 127.0.0.1');
  console.log('   3. Access https://YOUR_MAC_IP:3443/examples/playground/face-tracking-demo.html');
  console.log('   4. Accept the certificate warning on iPhone');
  
  return server;
};

// Start server
createServer().catch(console.error);
