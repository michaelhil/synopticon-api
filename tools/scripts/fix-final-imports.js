#!/usr/bin/env bun

/**
 * Final Import Fixes Script
 * Comprehensive fix for all remaining import path issues based on actual file locations
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());

// Final comprehensive import fixes
const finalImportFixes = [
  // Files in shared/utils/ui/ importing from core (need to go up 3 levels)
  {
    pattern: /from ['"]\.\.\/core\/(.*?)['"];?/g,
    replacement: "from '../../../core/$1';",
    filePattern: /^src\/shared\/utils\/ui\/.*\.(js|ts)$/,
    description: 'UI components importing from core'
  },
  
  // Files in shared/utils/modules/* importing from utils (wrong level)
  {
    pattern: /from ['"]\.\.\/\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from '../../$1';",
    filePattern: /^src\/shared\/utils\/modules\/.*\/.*\.(js|ts)$/,
    description: 'Module files importing from wrong utils path'
  },
  
  // Files in shared/utils/* importing from utils (should be same level)
  {
    pattern: /from ['"]\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from './$1';",
    filePattern: /^src\/shared\/utils\/.*\.(js|ts)$/,
    description: 'Utils files importing other utils incorrectly'
  },
  
  // Files in shared/utils/visualization/ importing from wrong path
  {
    pattern: /from ['"]\.\.\/\.\.\/core\/(.*?)['"];?/g,
    replacement: "from '../../../core/$1';",
    filePattern: /^src\/shared\/utils\/visualization\/.*\.(js|ts)$/,
    description: 'Visualization files importing from core'
  },
  
  // Files in shared/utils/shaders/ importing from wrong path  
  {
    pattern: /from ['"]\.\.\/\.\.\/core\/(.*?)['"];?/g,
    replacement: "from '../../../core/$1';",
    filePattern: /^src\/shared\/utils\/shaders\/.*\.(js|ts)$/,
    description: 'Shader files importing from core'
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

function fixFinalImports(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changesCount = 0;
  
  for (const fix of finalImportFixes) {
    if (fix.filePattern.test(relativePath)) {
      const matches = [...content.matchAll(fix.pattern)];
      if (matches.length > 0) {
        console.log(`  📝 ${fix.description} in ${relativePath}`);
        console.log(`    Pattern: ${fix.pattern}`);
        console.log(`    Replacement: ${fix.replacement}`);
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
  
  console.log('🎯 Final Import Path Fixes...\n');
  
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Only process src files
    if (!/^src\/.*\.(js|ts)$/.test(relativePath)) {
      return;
    }
    
    totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const { content: finalContent, changes: fileChanges } = fixFinalImports(filePath, content);
      
      if (fileChanges > 0) {
        writeFileSync(filePath, finalContent);
        console.log(`✅ Fixed ${fileChanges} imports in ${relativePath}\n`);
        modifiedFiles++;
        totalChanges += fileChanges;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error.message);
    }
  });
  
  console.log('📊 Final Import Fix Summary:');
  console.log(`  📁 Source files scanned: ${totalFiles}`);
  console.log(`  📝 Source files modified: ${modifiedFiles}`);
  console.log(`  🔧 Total import fixes applied: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n🎉 Final import fixing complete!');
  } else {
    console.log('\n✨ No final import issues found.');
  }
}

main();