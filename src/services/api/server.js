/**
 * Synopticon API Server - JavaScript Executable
 * Imports from TypeScript core modules for type safety while remaining executable
 * This file serves as the CLI entry point that uses the TypeScript-based core
 */

import { createSynopticonServer } from './server.ts';

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    host: process.env.HOST || '0.0.0.0',
    features: {
      distribution: true
    },
    websocket: {
      enabled: true,
      port: 3001
    }
  };

  console.log('🚀 Starting Synopticon API Server...');
  
  const server = createSynopticonServer(config);
  server.start().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏸️ Shutting down gracefully...');
    try {
      await server.stop();
      console.log('✅ Server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  process.on('SIGTERM', async () => {
    console.log('\n⏸️ Received SIGTERM, shutting down gracefully...');
    try {
      await server.stop();
      console.log('✅ Server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
}

// Export for programmatic use
export { createSynopticonServer } from './server.ts';