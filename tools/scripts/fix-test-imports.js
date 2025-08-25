#!/usr/bin/env bun

/**
 * Fix Test Import Paths Script
 * Specifically targets test files that may have incorrect import paths
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());

// Patterns for test import fixes
const testImportFixes = [
  // Fix imports from test files that should go up 2 levels to reach src
  {
    pattern: /from ['"]\.\.\/src\/(.*?)['"];?/g,
    replacement: "from '../../src/$1';",
    filePattern: /^tests\/(unit|integration|e2e|performance)\/.*\.(js|ts)$/,
    description: 'Test files importing from src (need 2 levels up)'
  },
  
  // Fix any remaining single-level references  
  {
    pattern: /from ['"]\.\/(src\/.*?)['"];?/g,
    replacement: "from '../$1';",
    filePattern: /^tests\/.*\.(js|ts)$/,
    description: 'Test files with wrong relative src imports'
  },

  // Fix any absolute-looking imports that aren't actually absolute
  {
    pattern: /from ['"]src\/(.*?)['"];?/g,
    replacement: "from '../../src/$1';",
    filePattern: /^tests\/(unit|integration|e2e|performance)\/.*\.(js|ts)$/,
    description: 'Test files with pseudo-absolute src imports'
  },

  // Fix eye-tracking test path if it exists
  {
    pattern: /from ['"]\.\.\/\.\.\/src\/eye-tracking\/(.*?)['"];?/g,
    replacement: "from '../../src/features/eye-tracking/$1';",
    filePattern: /^tests\/.*\.(js|ts)$/,
    description: 'Eye tracking feature imports'
  }
];

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

function getRelativePath(filePath) {
  return filePath.replace(projectRoot + '/', '');
}

function fixTestImports(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changesCount = 0;
  
  for (const fix of testImportFixes) {
    if (fix.filePattern.test(relativePath)) {
      const matches = [...content.matchAll(fix.pattern)];
      if (matches.length > 0) {
        console.log(`  📝 ${fix.description} in ${relativePath}`);
        modifiedContent = modifiedContent.replace(fix.pattern, fix.replacement);
        changesCount += matches.length;
      }
    }
  }
  
  return { content: modifiedContent, changes: changesCount };
}

function main() {
  let totalFiles = 0;
  let modifiedFiles = 0;
  let totalChanges = 0;
  
  console.log('🧪 Fixing Test Import Paths...\n');
  
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Only process test files
    if (!/^tests\/.*\.(js|ts)$/.test(relativePath)) {
      return;
    }
    
    totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const { content: finalContent, changes: fileChanges } = fixTestImports(filePath, content);
      
      if (fileChanges > 0) {
        writeFileSync(filePath, finalContent);
        console.log(`✅ Fixed ${fileChanges} imports in ${relativePath}`);
        modifiedFiles++;
        totalChanges += fileChanges;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error.message);
    }
  });
  
  console.log('\n📊 Test Import Fix Summary:');
  console.log(`  📁 Test files scanned: ${totalFiles}`);
  console.log(`  📝 Test files modified: ${modifiedFiles}`);
  console.log(`  🔧 Total import fixes applied: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n🎉 Test import fixing complete!');
  } else {
    console.log('\n✨ No test import issues found.');
  }
}

main();