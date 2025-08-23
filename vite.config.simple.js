import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    target: 'es2020',
    outDir: 'dist',
    lib: {
      entry: 'src/index.js',
      name: 'SynopticonAPI',
      fileName: (format) => `synopticon-api.${format}.js`,
      formats: ['es', 'umd']
    },
    sourcemap: true,
    minify: 'terser'
  }
});