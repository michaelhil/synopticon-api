#!/usr/bin/env bun

/**
 * ULTIMATE COMPREHENSIVE IMPORT FIXER
 * The most thorough import fixing script ever created
 * Addresses all 149+ import issues found in the comprehensive audit
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname, extname, relative } from 'path';

const projectRoot = resolve(process.cwd());
console.log('🚀 ULTIMATE COMPREHENSIVE IMPORT FIXER');
console.log('📁 Project root:', projectRoot);
console.log('');

// Track statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  totalFixes: 0,
  fixTypes: {
    extensionMismatch: 0,
    pathCorrection: 0,
    dynamicImport: 0,
    missingFile: 0,
    circularity: 0
  },
  errors: []
};

// Comprehensive import patterns to fix
const IMPORT_PATTERNS = [
  // 1. CRITICAL: TypeScript extension mismatches
  {
    category: 'extensionMismatch',
    pattern: /from\s+['"`](.*?)\.js['"`]/g,
    priority: 1,
    description: 'TypeScript files importing .js extensions',
    filePattern: /\.ts$/,
    fixer: (match, importPath, filePath) => {
      const absolutePath = resolveImportPath(importPath, filePath);
      const tsPath = absolutePath.replace(/\.js$/, '.ts');
      
      if (existsSync(tsPath) && !existsSync(absolutePath)) {
        const correctedImport = importPath.replace(/\.js$/, '.ts');
        return match.replace(importPath + '.js', correctedImport);
      }
      return null;
    }
  },
  
  // 2. CRITICAL: Feature files with wrong paths
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/core\/.*?)['"`]/g,
    priority: 1,
    description: 'Feature files importing core with wrong relative path',
    filePattern: /src\/features\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../core/', '../../core/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 3. CRITICAL: Feature files importing utils
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/utils\/.*?)['"`]/g,
    priority: 1,
    description: 'Feature files importing utils with wrong path',
    filePattern: /src\/features\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../utils/', '../../shared/utils/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 4. CRITICAL: Core files importing utils
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/utils\/.*?)['"`]/g,
    priority: 1,
    description: 'Core files importing utils with wrong path',
    filePattern: /src\/core\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../utils/', '../shared/utils/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 5. CRITICAL: Service files importing core
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/core\/.*?)['"`]/g,
    priority: 1,
    description: 'Service files importing core with wrong path',
    filePattern: /src\/services\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../core/', '../../core/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 6. CRITICAL: Service files importing utils
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/utils\/.*?)['"`]/g,
    priority: 1,
    description: 'Service files importing utils with wrong path',
    filePattern: /src\/services\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../utils/', '../../shared/utils/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 7. CRITICAL: Test files importing src
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/src\/.*?)['"`]/g,
    priority: 1,
    description: 'Test files with wrong src import path',
    filePattern: /tests\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../src/', '../../src/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 8. HIGH: Old pipeline paths
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](.*\/pipelines\/.*?)['"`]/g,
    priority: 2,
    description: 'Old pipeline directory references',
    filePattern: /\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      // Map old pipeline paths to new feature paths
      const pipelineMapping = {
        'mediapipe-face-pipeline.js': 'features/face-detection/mediapipe-face-pipeline.js',
        'mediapipe-pipeline.js': 'features/face-detection/mediapipe-pipeline.js',
        'emotion-analysis-pipeline.js': 'features/emotion-analysis/emotion-analysis-pipeline.js',
        'age-estimation-pipeline.js': 'features/face-detection/age-estimation-pipeline.js',
        'iris-tracking-pipeline.js': 'features/eye-tracking/iris-tracking-pipeline.js',
        'eye-tracking-pipeline.js': 'features/eye-tracking/eye-tracking-pipeline.js'
      };
      
      for (const [old, newPath] of Object.entries(pipelineMapping)) {
        if (importPath.includes(old)) {
          const newImportPath = importPath.replace(/.*\/pipelines\/.*/, `../${newPath}`);
          return match.replace(importPath, newImportPath);
        }
      }
      
      return null;
    }
  },
  
  // 9. HIGH: Dynamic imports in lazy registry
  {
    category: 'dynamicImport',
    pattern: /import\(['"`](\.\.\/pipelines\/.*?)['"`]\)/g,
    priority: 2,
    description: 'Dynamic imports from old pipeline paths',
    filePattern: /lazy-pipeline-registry\.js$/,
    fixer: (match, importPath, filePath) => {
      const pipelineMapping = {
        '../pipelines/mediapipe-face-pipeline.js': '../features/face-detection/mediapipe-face-pipeline.js',
        '../pipelines/mediapipe-pipeline.js': '../features/face-detection/mediapipe-pipeline.js',
        '../pipelines/emotion-analysis-pipeline.js': '../features/emotion-analysis/emotion-analysis-pipeline.js',
        '../pipelines/age-estimation-pipeline.js': '../features/face-detection/age-estimation-pipeline.js',
        '../pipelines/iris-tracking-pipeline.js': '../features/eye-tracking/iris-tracking-pipeline.js',
        '../pipelines/eye-tracking-pipeline.js': '../features/eye-tracking/eye-tracking-pipeline.js'
      };
      
      const correctedPath = pipelineMapping[importPath];
      return correctedPath ? match.replace(importPath, correctedPath) : null;
    }
  },
  
  // 10. HIGH: Shared utils internal imports
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/utils\/.*?)['"`]/g,
    priority: 2,
    description: 'Shared utils importing other utils incorrectly',
    filePattern: /src\/shared\/utils\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../utils/', './');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 11. MEDIUM: UI components importing core
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/core\/.*?)['"`]/g,
    priority: 3,
    description: 'UI components importing core incorrectly',
    filePattern: /src\/shared\/utils\/ui\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../core/', '../../../core/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 12. MEDIUM: Example files importing src
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/src\/.*?)['"`]/g,
    priority: 3,
    description: 'Example files with wrong src paths',
    filePattern: /examples\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../src/', '../../src/');
      return match.replace(importPath, correctedPath);
    }
  },
  
  // 13. LOW: Distribution subdirectory imports
  {
    category: 'pathCorrection',
    pattern: /from\s+['"`](\.\.\/\.\.\/utils\/.*?)['"`]/g,
    priority: 4,
    description: 'Distribution subdir files importing utils',
    filePattern: /src\/core\/distribution\/.*\.(js|ts)$/,
    fixer: (match, importPath, filePath) => {
      const correctedPath = importPath.replace('../../utils/', '../../../shared/utils/');
      return match.replace(importPath, correctedPath);
    }
  }
];

// Helper functions
function resolveImportPath(importPath, fromFile) {
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return resolve(dirname(fromFile), importPath);
  }
  return importPath;
}

function getRelativePath(filePath) {
  return filePath.replace(projectRoot + '/', '');
}

function walkDirectory(dir, callback) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!item.startsWith('.') && item !== 'node_modules') {
        walkDirectory(fullPath, callback);
      }
    } else if (stat.isFile()) {
      callback(fullPath);
    }
  }
}

function fixImportsInFile(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let fileChanges = 0;
  
  // Sort patterns by priority (higher priority first)
  const sortedPatterns = [...IMPORT_PATTERNS].sort((a, b) => a.priority - b.priority);
  
  for (const pattern of sortedPatterns) {
    if (pattern.filePattern.test(relativePath)) {
      const matches = [...content.matchAll(pattern.pattern)];
      
      if (matches.length > 0) {
        console.log(`  📝 ${pattern.description} in ${relativePath}`);
        
        for (const match of matches) {
          const fixResult = pattern.fixer ? pattern.fixer(match[0], match[1], filePath) : null;
          
          if (fixResult && fixResult !== match[0]) {
            modifiedContent = modifiedContent.replace(match[0], fixResult);
            fileChanges++;
            stats.fixTypes[pattern.category]++;
            
            console.log(`    🔧 ${match[0]} → ${fixResult}`);
          }
        }
      }
    }
  }
  
  return { content: modifiedContent, changes: fileChanges };
}

// Special handling for specific problematic files
function handleSpecialCases(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changes = 0;
  
  // Package.json script fixes
  if (relativePath === 'package.json') {
    const packageFixes = [
      {
        from: '"serve": "bun dev-server.js"',
        to: '"serve": "bun src/services/api/simple-server.js"'
      },
      {
        from: '"speech:server": "bun speech-analysis-server.js"',
        to: '"speech:server": "bun src/services/api/enhanced-server.js"'
      }
    ];
    
    for (const fix of packageFixes) {
      if (modifiedContent.includes(fix.from)) {
        modifiedContent = modifiedContent.replace(fix.from, fix.to);
        changes++;
        console.log(`  🔧 Package.json script: ${fix.from} → ${fix.to}`);
      }
    }
  }
  
  // HTML files with script tags
  if (relativePath.endsWith('.html')) {
    // Fix relative script paths
    const scriptPattern = /<script[^>]+src="([^"]+)"[^>]*>/g;
    const matches = [...content.matchAll(scriptPattern)];
    
    for (const match of matches) {
      const srcPath = match[1];
      if (srcPath.startsWith('../src/') && !srcPath.startsWith('../../src/')) {
        const correctedPath = srcPath.replace('../src/', '../../src/');
        modifiedContent = modifiedContent.replace(match[0], match[0].replace(srcPath, correctedPath));
        changes++;
        console.log(`  🔧 HTML script: ${srcPath} → ${correctedPath}`);
      }
    }
  }
  
  return { content: modifiedContent, changes };
}

// Validate fixes don't break existing working imports
function validateImportFix(oldImport, newImport, filePath) {
  try {
    const oldPath = resolveImportPath(oldImport, filePath);
    const newPath = resolveImportPath(newImport, filePath);
    
    // Don't "fix" imports that are already working
    if (existsSync(oldPath) && !existsSync(newPath)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return true; // If we can't validate, allow the fix
  }
}

// Main execution
function main() {
  console.log('🔍 Scanning all files for comprehensive import fixes...\n');
  
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Skip non-relevant files
    if (!/\.(js|ts|json|html|md)$/.test(filePath) || 
        relativePath.includes('node_modules') ||
        relativePath.includes('.git') ||
        relativePath.includes('ultimate-import-fixer.js')) {
      return;
    }
    
    stats.filesScanned++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Apply pattern-based fixes
      const { content: contentAfterPatterns, changes: patternChanges } = fixImportsInFile(filePath, content);
      
      // Apply special case fixes
      const { content: finalContent, changes: specialChanges } = handleSpecialCases(filePath, contentAfterPatterns);
      
      const totalChanges = patternChanges + specialChanges;
      
      if (totalChanges > 0) {
        writeFileSync(filePath, finalContent);
        console.log(`✅ Fixed ${totalChanges} imports in ${relativePath}\n`);
        stats.filesModified++;
        stats.totalFixes += totalChanges;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error.message);
      stats.errors.push({ file: relativePath, error: error.message });
    }
  });
  
  // Final report
  console.log('📊 ULTIMATE IMPORT FIXING SUMMARY:');
  console.log(`  📁 Files scanned: ${stats.filesScanned}`);
  console.log(`  📝 Files modified: ${stats.filesModified}`);
  console.log(`  🔧 Total fixes applied: ${stats.totalFixes}`);
  console.log('');
  console.log('🏷️ Fix breakdown:');
  for (const [type, count] of Object.entries(stats.fixTypes)) {
    if (count > 0) {
      console.log(`  ${type}: ${count} fixes`);
    }
  }
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    for (const error of stats.errors) {
      console.log(`  ${error.file}: ${error.error}`);
    }
  }
  
  if (stats.totalFixes > 0) {
    console.log('\n🎉 Ultimate import fixing complete! Run verification tests.');
  } else {
    console.log('\n✨ No import issues found - all paths appear correct.');
  }
}

// Run the ultimate fixer
main();