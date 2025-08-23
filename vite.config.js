import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  optimizeDeps: {
    // Pre-bundle dependencies for better performance with Bun
    entries: ['src/index.js'],
    force: true
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    lib: {
      entry: 'src/index.js',
      name: 'SynopticonAPI',
      fileName: (format) => `synopticon-api.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    sourcemap: true,
    minify: 'esbuild', // Use esbuild for better Bun compatibility
    esbuild: {
      target: 'es2020',
      drop: ['debugger'],
      keepNames: true
    }
  },
  server: {
    port: 3000,
    host: true,
    https: false,
    // Optimize for Bun
    hmr: {
      port: 3010
    }
  },
  preview: {
    port: 3001,
    host: true
  },
  // Bun-specific optimizations
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});