#!/usr/bin/env bun

/**
 * Fix Internal Import Issues Script
 * Fixes remaining internal import paths within the src/ directory
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());

// Internal import fixes based on the actual structure
const internalImportFixes = [
  // UI components - moved to shared/utils/ui/
  {
    pattern: /from ['"]\.\.\/ui\/(.*?)['"];?/g,
    replacement: "from '../shared/utils/ui/$1';",
    filePattern: /^src\/core\/.*\.(js|ts)$/,
    description: 'Core files importing UI components'
  },
  
  // Distribution files importing utils
  {
    pattern: /from ['"]\.\.\/\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from '../../../shared/utils/$1';",
    filePattern: /^src\/core\/distribution\/distributors\/.*\.(js|ts)$/,
    description: 'Distribution distributor files importing utils'
  },
  
  // Fix any remaining modules/ imports
  {
    pattern: /from ['"]\.\.\/modules\/(.*?)['"];?/g,
    replacement: "from '../shared/utils/modules/$1';",
    filePattern: /^src\/services\/api\/.*\.(js|ts)$/,
    description: 'Service files importing modules'
  },
  
  // Fix speech analysis pipeline imports
  {
    pattern: /from ['"]\.\/pipelines\/(.*?)['"];?/g,
    replacement: "from './shared/utils/$1';",
    filePattern: /^src\/browser-.*\.(js|ts)$/,
    description: 'Browser files with pipeline imports'
  },
  
  // Fix any remaining mediapipe imports from wrong location
  {
    pattern: /from ['"]\.\.\/modules\/detection\/mediapipe\/(.*?)['"];?/g,
    replacement: "from '../shared/utils/modules/detection/mediapipe/$1';",
    filePattern: /^src\/services\/api\/.*\.(js|ts)$/,
    description: 'Service files importing mediapipe modules'
  },
  
  // Core files trying to import from wrong paths
  {
    pattern: /from ['"]\.\.\/speech-analysis-pipeline-hybrid\.js['"];?/g,
    replacement: "from '../shared/utils/speech-analysis-pipeline-hybrid.js';",
    filePattern: /^src\/.*\.(js|ts)$/,
    description: 'Files importing speech analysis pipeline'
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

function fixInternalImports(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changesCount = 0;
  
  for (const fix of internalImportFixes) {
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
  
  console.log('🔧 Fixing Internal Import Issues...\n');
  
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Only process src files
    if (!/^src\/.*\.(js|ts)$/.test(relativePath)) {
      return;
    }
    
    totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      const { content: finalContent, changes: fileChanges } = fixInternalImports(filePath, content);
      
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
  
  console.log('\n📊 Internal Import Fix Summary:');
  console.log(`  📁 Source files scanned: ${totalFiles}`);
  console.log(`  📝 Source files modified: ${modifiedFiles}`);
  console.log(`  🔧 Total import fixes applied: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n🎉 Internal import fixing complete!');
  } else {
    console.log('\n✨ No internal import issues found.');
  }
}

main();