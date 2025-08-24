#!/usr/bin/env bun

/**
 * Build Optimization Script
 * Analyzes and optimizes build output for code splitting
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Analysis configuration
const config = {
  chunkSizeThreshold: 500 * 1024, // 500KB warning threshold
  minChunkSize: 1 * 1024, // 1KB minimum size
  maxChunks: 20, // Maximum recommended chunks
  compressionTypes: ['gzip', 'brotli']
};

/**
 * Get file size in bytes
 * @param {string} filePath - Path to file
 * @returns {number} - File size in bytes
 */
const getFileSize = (filePath) => {
  try {
    return statSync(filePath).size;
  } catch (error) {
    console.warn(`Could not get size for ${filePath}:`, error.message);
    return 0;
  }
};

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} - Formatted string
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Analyze chunk sizes and composition
 * @returns {Object} - Analysis results
 */
const analyzeChunks = () => {
  const analysis = {
    chunks: [],
    totalSize: 0,
    warnings: [],
    recommendations: []
  };

  try {
    const files = readdirSync(distDir);
    
    for (const file of files) {
      const filePath = join(distDir, file);
      const stats = statSync(filePath);
      
      if (stats.isFile() && file.endsWith('.js')) {
        const size = stats.size;
        analysis.totalSize += size;
        
        const chunkInfo = {
          name: file,
          size: size,
          formattedSize: formatBytes(size),
          type: determineChunkType(file),
          path: filePath
        };
        
        // Add warnings for large chunks
        if (size > config.chunkSizeThreshold) {
          analysis.warnings.push({
            type: 'large_chunk',
            message: `Chunk ${file} is ${formatBytes(size)} (exceeds ${formatBytes(config.chunkSizeThreshold)} threshold)`,
            chunk: chunkInfo
          });
        }
        
        // Add warnings for very small chunks
        if (size < config.minChunkSize) {
          analysis.warnings.push({
            type: 'small_chunk', 
            message: `Chunk ${file} is ${formatBytes(size)} (below ${formatBytes(config.minChunkSize)} minimum)`,
            chunk: chunkInfo
          });
        }
        
        analysis.chunks.push(chunkInfo);
      }
    }
    
    // Sort chunks by size (largest first)
    analysis.chunks.sort((a, b) => b.size - a.size);
    
    // Generate recommendations
    generateRecommendations(analysis);
    
  } catch (error) {
    console.error('Error analyzing chunks:', error);
  }
  
  return analysis;
};

/**
 * Determine chunk type based on filename
 * @param {string} filename - Chunk filename
 * @returns {string} - Chunk type
 */
const determineChunkType = (filename) => {
  if (filename.includes('pipeline-')) {
    return 'pipeline';
  } else if (filename.includes('core')) {
    return 'core';
  } else if (filename.includes('utils')) {
    return 'utilities';
  } else if (filename.includes('mediapipe-commons')) {
    return 'shared';
  } else if (filename.includes('vendor')) {
    return 'vendor';
  } else {
    return 'unknown';
  }
};

/**
 * Generate optimization recommendations
 * @param {Object} analysis - Chunk analysis results
 */
const generateRecommendations = (analysis) => {
  const recommendations = analysis.recommendations;
  
  // Too many chunks warning
  if (analysis.chunks.length > config.maxChunks) {
    recommendations.push({
      type: 'too_many_chunks',
      severity: 'warning',
      message: `${analysis.chunks.length} chunks detected (recommended max: ${config.maxChunks}). Consider consolidating smaller chunks.`
    });
  }
  
  // Bundle size analysis
  const totalSizeMB = analysis.totalSize / (1024 * 1024);
  if (totalSizeMB > 10) {
    recommendations.push({
      type: 'large_bundle',
      severity: 'warning', 
      message: `Total bundle size is ${formatBytes(analysis.totalSize)}. Consider further optimization.`
    });
  }
  
  // Pipeline chunk analysis
  const pipelineChunks = analysis.chunks.filter(chunk => chunk.type === 'pipeline');
  const avgPipelineSize = pipelineChunks.reduce((sum, chunk) => sum + chunk.size, 0) / pipelineChunks.length;
  
  if (avgPipelineSize > 1024 * 1024) { // 1MB
    recommendations.push({
      type: 'large_pipeline_chunks',
      severity: 'info',
      message: `Average pipeline chunk size is ${formatBytes(avgPipelineSize)}. This is good for code splitting effectiveness.`
    });
  }
  
  // Core chunk analysis
  const coreChunk = analysis.chunks.find(chunk => chunk.type === 'core');
  if (coreChunk && coreChunk.size > 2 * 1024 * 1024) { // 2MB
    recommendations.push({
      type: 'large_core_chunk',
      severity: 'warning',
      message: `Core chunk is ${coreChunk.formattedSize}. Consider moving non-essential code to separate chunks.`
    });
  }
};

/**
 * Estimate compression savings
 * @param {Object} analysis - Chunk analysis results
 * @returns {Object} - Compression estimates
 */
const estimateCompression = (analysis) => {
  const estimates = {
    uncompressed: analysis.totalSize,
    gzip: Math.round(analysis.totalSize * 0.3), // ~70% compression typical for JS
    brotli: Math.round(analysis.totalSize * 0.25), // ~75% compression typical for JS
  };
  
  return {
    ...estimates,
    gzipSavings: formatBytes(estimates.uncompressed - estimates.gzip),
    brotliSavings: formatBytes(estimates.uncompressed - estimates.brotli),
    gzipRatio: ((1 - estimates.gzip / estimates.uncompressed) * 100).toFixed(1) + '%',
    brotliRatio: ((1 - estimates.brotli / estimates.uncompressed) * 100).toFixed(1) + '%'
  };
};

/**
 * Generate bundle analysis report
 * @param {Object} analysis - Analysis results
 * @returns {string} - Formatted report
 */
const generateReport = (analysis) => {
  const compression = estimateCompression(analysis);
  
  let report = `
# Bundle Analysis Report - ${new Date().toISOString()}

## Summary
- **Total Chunks**: ${analysis.chunks.length}
- **Total Size**: ${formatBytes(analysis.totalSize)}
- **Estimated Gzipped**: ${formatBytes(compression.gzip)} (${compression.gzipRatio})
- **Estimated Brotli**: ${formatBytes(compression.brotli)} (${compression.brotliRatio})

## Chunks by Size
`;
  
  analysis.chunks.forEach((chunk, index) => {
    const icon = chunk.type === 'core' ? '🔧' : 
                 chunk.type === 'pipeline' ? '🔬' :
                 chunk.type === 'utilities' ? '🛠️' : 
                 chunk.type === 'shared' ? '🤝' : '📦';
    
    report += `${index + 1}. ${icon} **${chunk.name}** (${chunk.type}) - ${chunk.formattedSize}\n`;
  });
  
  if (analysis.warnings.length > 0) {
    report += `\n## Warnings\n`;
    analysis.warnings.forEach(warning => {
      const icon = warning.type === 'large_chunk' ? '⚠️' : '💡';
      report += `${icon} ${warning.message}\n`;
    });
  }
  
  if (analysis.recommendations.length > 0) {
    report += `\n## Recommendations\n`;
    analysis.recommendations.forEach(rec => {
      const icon = rec.severity === 'warning' ? '🔍' : '✨';
      report += `${icon} **${rec.type}**: ${rec.message}\n`;
    });
  }
  
  // Code splitting effectiveness analysis
  const pipelineChunks = analysis.chunks.filter(chunk => chunk.type === 'pipeline');
  const coreChunk = analysis.chunks.find(chunk => chunk.type === 'core');
  const codeSplittingRatio = pipelineChunks.length > 0 && coreChunk ? 
    (pipelineChunks.reduce((sum, chunk) => sum + chunk.size, 0) / coreChunk.size) : 0;
  
  report += `
## Code Splitting Effectiveness
- **Pipeline Chunks**: ${pipelineChunks.length}
- **Core vs Pipeline Ratio**: ${codeSplittingRatio.toFixed(2)}:1
- **Lazy Loading Benefit**: ${codeSplittingRatio > 1 ? 'High' : 'Medium'} (${((codeSplittingRatio / (codeSplittingRatio + 1)) * 100).toFixed(1)}% of code can be lazy loaded)

## Next Steps
1. Monitor chunk loading performance in real-world usage
2. Consider preloading critical pipeline chunks
3. Implement service worker caching for better offline support
4. Monitor Core Web Vitals impact

---
Generated by Synopticon API Build Optimizer
`;
  
  return report;
};

/**
 * Main optimization function
 */
const optimize = async () => {
  console.log('🔍 Analyzing build output...\n');
  
  const analysis = analyzeChunks();
  
  if (analysis.chunks.length === 0) {
    console.error('❌ No build output found. Run `bun run build` first.');
    process.exit(1);
  }
  
  const report = generateReport(analysis);
  
  // Write report to file
  const reportPath = join(distDir, 'bundle-analysis.md');
  writeFileSync(reportPath, report, 'utf8');
  
  // Write JSON data for programmatic access
  const jsonPath = join(distDir, 'bundle-analysis.json');
  writeFileSync(jsonPath, JSON.stringify({
    ...analysis,
    compression: estimateCompression(analysis),
    generatedAt: new Date().toISOString()
  }, null, 2), 'utf8');
  
  // Print summary to console
  console.log('📊 Build Analysis Summary');
  console.log('========================');
  console.log(`Total Chunks: ${analysis.chunks.length}`);
  console.log(`Total Size: ${formatBytes(analysis.totalSize)}`);
  console.log(`Warnings: ${analysis.warnings.length}`);
  console.log(`Recommendations: ${analysis.recommendations.length}`);
  
  if (analysis.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    analysis.warnings.forEach(warning => {
      console.log(`  - ${warning.message}`);
    });
  }
  
  if (analysis.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`  - ${rec.message}`);
    });
  }
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log(`🔗 JSON data saved to: ${jsonPath}`);
  
  // Exit with error if there are warnings
  if (analysis.warnings.some(w => w.type === 'large_chunk')) {
    console.log('\n❌ Build optimization needed - see warnings above');
    process.exit(1);
  } else {
    console.log('\n✅ Build optimization looks good!');
  }
};

// Run optimization if called directly
if (import.meta.main) {
  optimize().catch(error => {
    console.error('❌ Build optimization failed:', error);
    process.exit(1);
  });
}

export { optimize, analyzeChunks, generateReport };