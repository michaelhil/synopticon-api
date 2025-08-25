#!/usr/bin/env bun

/**
 * Fix Example Import Paths Script
 * Fixes import paths in example files after reorganization
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());

// Example import fixes
const exampleImportFixes = [
  // Examples in tutorials/ or playground/ importing from src (need 2 levels up)
  {
    pattern: /from ['"]\.\.\/src\/(.*?)['"];?/g,
    replacement: "from '../../src/$1';",
    filePattern: /^examples\/(tutorials|playground)\/.*\.(js|ts)$/,
    description: 'Example files importing from src (need 2 levels up)'
  },
  
  // Examples importing from old paths
  {
    pattern: /from ['"]\.\.\/\.\.\/src\/pipelines\/(.*?)['"];?/g,
    replacement: "from '../../src/features/*/$1';",
    filePattern: /^examples\/.*\.(js|ts)$/,
    description: 'Example files importing old pipeline paths'
  },
  
  // Examples importing from utils
  {
    pattern: /from ['"]\.\.\/\.\.\/src\/utils\/(.*?)['"];?/g,
    replacement: "from '../../src/shared/utils/$1';",
    filePattern: /^examples\/.*\.(js|ts)$/,
    description: 'Example files importing utils from old location'
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

function fixExampleImports(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changesCount = 0;
  
  for (const fix of exampleImportFixes) {
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
  
  console.log('📚 Fixing Example Import Paths...\n');
  
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Only process example files
    if (!/^examples\/.*\.(js|ts|html)$/.test(relativePath)) {
      return;
    }
    
    totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const { content: finalContent, changes: fileChanges } = fixExampleImports(filePath, content);
      
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
  
  console.log('\n📊 Example Import Fix Summary:');
  console.log(`  📁 Example files scanned: ${totalFiles}`);
  console.log(`  📝 Example files modified: ${modifiedFiles}`);
  console.log(`  🔧 Total import fixes applied: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n🎉 Example import fixing complete!');
  } else {
    console.log('\n✨ No example import issues found.');
  }
}

main();