import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  optimizeDeps: {
    // Pre-bundle dependencies for better performance with Bun
    entries: ['src/index.js'],
    force: true,
    // Don't pre-bundle pipeline modules - they should be lazy loaded
    exclude: [
      'src/pipelines/mediapipe-face-pipeline.js',
      'src/pipelines/mediapipe-pipeline.js', 
      'src/pipelines/emotion-analysis-pipeline.js',
      'src/pipelines/age-estimation-pipeline.js',
      'src/pipelines/iris-tracking-pipeline.js',
      'src/pipelines/eye-tracking-pipeline.js'
    ]
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
      external: [
        'http',
        'url',
        'path',
        'fs'
      ],
      output: {
        // Configure code splitting for pipelines
        globals: {},
        manualChunks: {
          // Core chunk - always loaded
          'core': [
            'src/core/orchestrator.js',
            'src/core/pipeline.js',
            'src/core/types.js',
            'src/core/lazy-pipeline-registry.js',
            'src/core/loading-state-manager.js'
          ],
          // Pipeline chunks - loaded on demand
          'pipeline-mediapipe-face': ['src/pipelines/mediapipe-face-pipeline.js'],
          'pipeline-mediapipe-mesh': ['src/pipelines/mediapipe-pipeline.js'],
          'pipeline-emotion': ['src/pipelines/emotion-analysis-pipeline.js'],
          'pipeline-age': ['src/pipelines/age-estimation-pipeline.js'],
          'pipeline-iris': ['src/pipelines/iris-tracking-pipeline.js'],
          'pipeline-eye-tracking': ['src/pipelines/eye-tracking-pipeline.js'],
          // Shared utilities chunk
          'utils': [
            'src/utils/error-handler.js',
            'src/utils/runtime-detector.js',
            'src/utils/performance-tester.js'
          ],
          // MediaPipe commons chunk (shared by multiple pipelines)
          'mediapipe-commons': [
            'src/core/mediapipe-commons.js',
            'src/utils/dependency-loader.js',
            'src/utils/mediapipe-integration.js'
          ]
        },
        // Configure chunk file names for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? 
            chunkInfo.facadeModuleId.split('/').pop().replace(/\.js$/, '') : 'chunk';
          return `chunks/${facadeModuleId}-[hash].js`;
        },
        // Optimize chunk sizes
        experimentalMinChunkSize: 1000, // 1KB minimum chunk size
        // Configure dynamic imports for better loading
        inlineDynamicImports: false
      }
    },
    sourcemap: true,
    minify: 'esbuild', // Use esbuild for better Bun compatibility
    esbuild: {
      target: 'es2020',
      drop: ['debugger'],
      keepNames: true
    },
    // Optimize chunk sizes
    chunkSizeWarningLimit: 1000, // 1MB warning limit
    // Enable advanced code splitting
    assetsInlineLimit: 4096, // 4KB inline limit for assets
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