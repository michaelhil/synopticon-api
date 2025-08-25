#!/usr/bin/env node

/**
 * Script to fix all test imports from .js to .ts where appropriate
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// List of core TypeScript files that were migrated
const tsFiles = [
  'src/core/orchestrator',
  'src/core/strategies',
  'src/core/configuration',
  'src/core/pipeline',
  'src/core/types',
  'src/core/parallel-initializer',
  'src/core/pipeline-results',
  'src/core/index',
  'src/utils/error-handler',
  'src/api/server',
  'src/api/distribution-api'
];

// Test files to fix
const testFiles = [
  'tests/distribution-api.test.js',
  'tests/enhanced-memory-pool.test.js',
  'tests/lazy-loading-simple.test.js',
  'tests/lazy-loading.test.js',
  'tests/performance-validation.test.js',
  'tests/phase1-integration.test.js',
  'tests/pipeline-coverage.test.js',
  'tests/pipeline-integration.test.js',
  'tests/security.test.js',
  'tests/speech-client-server.test.js',
  'tests/speech-integration.test.js',
  'tests/synchronization.test.js',
  'tests/eye-tracking/comprehensive.test.js',
  'tests/integration/multimodal-integration.test.js'
];

function fixTestFile(filePath) {
  const fullPath = join(__dirname, filePath);
  
  if (!existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = readFileSync(fullPath, 'utf-8');
  let modified = false;
  
  // Fix imports for TypeScript files
  tsFiles.forEach(tsFile => {
    const jsPattern = new RegExp(`from ['"](\\.\\./)*${tsFile}\\.js['"]`, 'g');
    const tsReplacement = `from '$1${tsFile}.ts'`;
    
    if (content.match(jsPattern)) {
      content = content.replace(jsPattern, tsReplacement);
      modified = true;
    }
  });
  
  // Add strategy registry import if file uses orchestrator
  if (content.includes('createOrchestrator') && !content.includes('createStrategyRegistry')) {
    // Find the orchestrator import line
    const orchestratorImportMatch = content.match(/import.*createOrchestrator.*from.*orchestrator\.ts['"];?/);
    if (orchestratorImportMatch) {
      const importLine = orchestratorImportMatch[0];
      const strategyImport = `\nimport { createStrategyRegistry } from '${importLine.includes('../src/') ? '../src/' : '../'}core/strategies.ts';`;
      
      // Add strategy import after orchestrator import
      content = content.replace(importLine, importLine + strategyImport);
      
      // Fix orchestrator creation to include strategies
      content = content.replace(
        /createOrchestrator\(\s*\)/g,
        'createOrchestrator({ strategies: createStrategyRegistry() })'
      );
      
      content = content.replace(
        /createOrchestrator\(\s*{([^}]*)}\s*\)/g,
        (match, config) => {
          if (!config.includes('strategies')) {
            return `createOrchestrator({ strategies: createStrategyRegistry(), ${config} })`;
          }
          return match;
        }
      );
      
      modified = true;
    }
  }
  
  // Special fix for enhanced-server imports in tests
  content = content.replace(
    /from ['"](\.\.\/)*(src\/)?api\/enhanced-server\.js['"]/g,
    "from '$1$2api/enhanced-server.js'"
  );
  
  if (modified) {
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
  }
}

console.log('🔧 Fixing test imports...\n');

testFiles.forEach(testFile => {
  fixTestFile(testFile);
});

console.log('\n✅ Test import fixes complete!');
console.log('\n📝 Next steps:');
console.log('1. Run: bun test');
console.log('2. Check for any remaining failures');
console.log('3. Manually fix any edge cases');