#!/usr/bin/env bun

/**
 * TypeScript Import Fix Script
 * Fixes TypeScript imports after reorganization
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const tsImportMappings = {
  // Error handler moved to shared utils
  '../utils/error-handler.js': '../shared/utils/error-handler.ts',
  '../utils/url-utils.js': '../shared/utils/url-utils.js',
  
  // Core files (relative paths within core)
  '../core/orchestrator.js': '../core/orchestrator.ts',
  '../core/strategies.js': '../core/strategies.ts', 
  '../core/types.js': '../core/types.ts',
  '../core/configuration.js': '../core/configuration.ts',
  '../core/pipeline.js': '../core/pipeline.ts',
  
  // Distribution files (within core)
  '../core/distribution/distribution-session-manager.js': '../core/distribution/distribution-session-manager.js',
  '../core/distribution/distribution-config-manager.js': '../core/distribution/distribution-config-manager.js'
};

function fixTSImportsInFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    for (const [oldPath, newPath] of Object.entries(tsImportMappings)) {
      if (content.includes(oldPath)) {
        content = content.replace(new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPath);
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function fixTSImportsRecursively(dir) {
  let fixed = 0;
  
  if (!require('fs').existsSync(dir)) return fixed;
  
  const items = readdirSync(dir);
  
  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);
    
    if (stat.isDirectory()) {
      fixed += fixTSImportsRecursively(itemPath);
    } else if (stat.isFile() && item.endsWith('.ts')) {
      if (fixTSImportsInFile(itemPath)) {
        console.log(`🔧 Fixed TS imports in ${itemPath}`);
        fixed++;
      }
    }
  }
  
  return fixed;
}

function fixAllTSImports() {
  console.log('🔧 Fixing TypeScript imports...\n');
  
  let totalFixed = 0;
  
  // Fix source imports
  console.log('📁 Fixing TypeScript files in src/...');
  totalFixed += fixTSImportsRecursively('src');
  
  console.log(`\n✅ Fixed TypeScript imports in ${totalFixed} files`);
}

// Run the fix
fixAllTSImports();