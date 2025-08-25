#!/usr/bin/env bun

/**
 * Comprehensive Import Path Fixing Script
 * Fixes ALL broken imports after project reorganization
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(process.cwd());
console.log('🔧 Comprehensive Import Path Fixing Script');
console.log('📁 Project root:', projectRoot);
console.log('');

// Import path mappings
const importMappings = [
  // 1. Feature files: ../core/ → ../../core/
  {
    pattern: /from ['"]\.\.\/core\/(.*?)['"];?/g,
    replacement: "from '../../core/$1';",
    filePattern: /^src\/features\/.*\.(js|ts)$/,
    description: 'Feature files importing core modules'
  },
  
  // 2. Feature files: ../utils/ → ../../shared/utils/
  {
    pattern: /from ['"]\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from '../../shared/utils/$1';",
    filePattern: /^src\/features\/.*\.(js|ts)$/,
    description: 'Feature files importing utils'
  },
  
  // 3. Services: ../core/ → ../../core/
  {
    pattern: /from ['"]\.\.\/core\/(.*?)['"];?/g,
    replacement: "from '../../core/$1';",
    filePattern: /^src\/services\/.*\.(js|ts)$/,
    description: 'Service files importing core modules'
  },
  
  // 4. Services: ../utils/ → ../../shared/utils/
  {
    pattern: /from ['"]\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from '../../shared/utils/$1';",
    filePattern: /^src\/services\/.*\.(js|ts)$/,
    description: 'Service files importing utils'
  },
  
  // 5. Core files: ../utils/ → ../shared/utils/
  {
    pattern: /from ['"]\.\.\/utils\/(.*?)['"];?/g,
    replacement: "from '../shared/utils/$1';",
    filePattern: /^src\/core\/.*\.(js|ts)$/,
    description: 'Core files importing utils'
  },
  
  // 6. Test files: ../../src/core/ → ../../src/core/ (already correct, but check others)
  {
    pattern: /from ['"]\.\.\/src\/pipelines\/(.*?)['"];?/g,
    replacement: "from '../src/features/*/$1';",
    filePattern: /^tests\/.*\.(js|ts)$/,
    description: 'Test files importing old pipeline paths'
  },
  
  // 7. Browser files: ./pipelines/ → ./features/
  {
    pattern: /from ['"]\.\/pipelines\/(.*?)['"];?/g,
    replacement: "from './shared/utils/$1';",
    filePattern: /^src\/browser-.*\.(js|ts)$/,
    description: 'Browser files importing pipelines'
  }
];

// Special dynamic import mappings for lazy-pipeline-registry
const dynamicImportMappings = [
  {
    from: "'../pipelines/mediapipe-face-pipeline.js'",
    to: "'../features/face-detection/mediapipe-face-pipeline.js'",
    description: 'mediapipe-face pipeline'
  },
  {
    from: "'../pipelines/mediapipe-pipeline.js'",
    to: "'../features/face-detection/mediapipe-pipeline.js'",
    description: 'mediapipe-face-mesh pipeline'
  },
  {
    from: "'../pipelines/emotion-analysis-pipeline.js'",
    to: "'../features/emotion-analysis/emotion-analysis-pipeline.js'",
    description: 'emotion-analysis pipeline'
  },
  {
    from: "'../pipelines/age-estimation-pipeline.js'",
    to: "'../features/face-detection/age-estimation-pipeline.js'",
    description: 'age-estimation pipeline'
  },
  {
    from: "'../pipelines/iris-tracking-pipeline.js'",
    to: "'../features/eye-tracking/iris-tracking-pipeline.js'",
    description: 'iris-tracking pipeline'
  },
  {
    from: "'../pipelines/eye-tracking-pipeline.js'",
    to: "'../features/eye-tracking/eye-tracking-pipeline.js'",
    description: 'eye-tracking pipeline'
  }
];

// Package.json script fixes
const packageJsonScriptFixes = [
  {
    from: '"api:dev": "bun --watch src/api/simple-server.js"',
    to: '"api:dev": "bun --watch src/services/api/simple-server.js"',
    description: 'api:dev script path'
  },
  {
    from: '"api:start": "bun src/api/simple-server.js"',
    to: '"api:start": "bun src/services/api/simple-server.js"',
    description: 'api:start script path'
  },
  {
    from: '"api:full": "bun --watch src/api/server.js"',
    to: '"api:full": "bun --watch src/services/api/server.js"',
    description: 'api:full script path'
  },
  {
    from: '"serve": "bun dev-server.js"',
    to: '"serve": "bun src/services/api/simple-server.js"',
    description: 'serve script path (assuming simple server)'
  }
];

// File walker
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

// Get relative path from project root
function getRelativePath(filePath) {
  return filePath.replace(projectRoot + '/', '');
}

// Fix regular import statements
function fixImportsInFile(filePath, content) {
  const relativePath = getRelativePath(filePath);
  let modifiedContent = content;
  let changesCount = 0;
  
  for (const mapping of importMappings) {
    if (mapping.filePattern.test(relativePath)) {
      const matches = [...content.matchAll(mapping.pattern)];
      if (matches.length > 0) {
        console.log(`  📝 Applying ${mapping.description} to ${relativePath}`);
        modifiedContent = modifiedContent.replace(mapping.pattern, mapping.replacement);
        changesCount += matches.length;
      }
    }
  }
  
  return { content: modifiedContent, changes: changesCount };
}

// Fix dynamic imports in lazy-pipeline-registry
function fixDynamicImports(filePath, content) {
  const relativePath = getRelativePath(filePath);
  
  if (!relativePath.includes('lazy-pipeline-registry.js')) {
    return { content, changes: 0 };
  }
  
  let modifiedContent = content;
  let changesCount = 0;
  
  console.log(`  🔄 Fixing dynamic imports in ${relativePath}`);
  
  for (const mapping of dynamicImportMappings) {
    if (modifiedContent.includes(mapping.from)) {
      console.log(`    ➡️ ${mapping.description}: ${mapping.from} → ${mapping.to}`);
      modifiedContent = modifiedContent.replace(mapping.from, mapping.to);
      changesCount++;
    }
  }
  
  return { content: modifiedContent, changes: changesCount };
}

// Fix package.json scripts
function fixPackageJsonScripts() {
  const packageJsonPath = join(projectRoot, 'package.json');
  
  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    let modifiedContent = content;
    let changesCount = 0;
    
    console.log('📦 Fixing package.json scripts...');
    
    for (const fix of packageJsonScriptFixes) {
      if (modifiedContent.includes(fix.from)) {
        console.log(`  ➡️ ${fix.description}`);
        modifiedContent = modifiedContent.replace(fix.from, fix.to);
        changesCount++;
      }
    }
    
    if (changesCount > 0) {
      writeFileSync(packageJsonPath, modifiedContent);
      console.log(`  ✅ Fixed ${changesCount} script paths`);
    } else {
      console.log('  ℹ️ No script fixes needed');
    }
    
  } catch (error) {
    console.error('  ❌ Error fixing package.json:', error.message);
  }
}

// Main execution
function main() {
  let totalFiles = 0;
  let modifiedFiles = 0;
  let totalChanges = 0;
  
  console.log('🔍 Scanning all files for import issues...\n');
  
  // Fix regular files
  walkDirectory(projectRoot, (filePath) => {
    const relativePath = getRelativePath(filePath);
    
    // Skip non-code files and dependencies
    if (!/\.(js|ts|json)$/.test(filePath) || 
        relativePath.includes('node_modules') ||
        relativePath.includes('.git') ||
        relativePath.includes('tools/scripts/fix-all-imports.js')) {
      return;
    }
    
    totalFiles++;
    
    try {
      const content = readFileSync(filePath, 'utf8');
      
      // Apply regular import fixes
      const { content: contentAfterImports, changes: importChanges } = fixImportsInFile(filePath, content);
      
      // Apply dynamic import fixes
      const { content: finalContent, changes: dynamicChanges } = fixDynamicImports(filePath, contentAfterImports);
      
      const totalFileChanges = importChanges + dynamicChanges;
      
      if (totalFileChanges > 0) {
        writeFileSync(filePath, finalContent);
        console.log(`✅ Fixed ${totalFileChanges} imports in ${relativePath}`);
        modifiedFiles++;
        totalChanges += totalFileChanges;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error.message);
    }
  });
  
  // Fix package.json
  fixPackageJsonScripts();
  
  console.log('\n📊 Summary:');
  console.log(`  📁 Total files scanned: ${totalFiles}`);
  console.log(`  📝 Files modified: ${modifiedFiles}`);
  console.log(`  🔧 Total import fixes applied: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n🎉 Import fixing complete! Please run tests to verify functionality.');
  } else {
    console.log('\n✨ No import issues found - all paths appear to be correct.');
  }
}

// Run the script
main();