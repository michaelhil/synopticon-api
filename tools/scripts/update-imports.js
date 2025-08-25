#!/usr/bin/env bun

/**
 * Import Update Script
 * Updates import paths after reorganization
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const importMappings = {
  // API imports
  '../src/api/': '../src/services/api/',
  
  // Feature imports
  '../src/pipelines/mediapipe-face-pipeline': '../src/features/face-detection/mediapipe-face-pipeline',
  '../src/pipelines/eye-tracking-pipeline': '../src/features/eye-tracking/eye-tracking-pipeline',
  '../src/pipelines/emotion-analysis-pipeline': '../src/features/emotion-analysis/emotion-analysis-pipeline',
  '../src/pipelines/age-estimation-pipeline': '../src/features/face-detection/age-estimation-pipeline',
  '../src/pipelines/iris-tracking-pipeline': '../src/features/eye-tracking/iris-tracking-pipeline',
  '../src/pipelines/mediapipe-pipeline': '../src/features/face-detection/mediapipe-pipeline',
  
  // Utility imports  
  '../src/utils/': '../src/shared/utils/',
  '../src/configs/': '../src/shared/constants/',
  
  // Core imports (unchanged but good to verify)
  '../src/core/': '../src/core/'
};

function updateImportsInFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    for (const [oldPath, newPath] of Object.entries(importMappings)) {
      const regex = new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldPath)) {
        content = content.replace(regex, newPath);
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function updateImportsRecursively(dir) {
  let updated = 0;
  
  if (!require('fs').existsSync(dir)) return updated;
  
  const items = readdirSync(dir);
  
  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);
    
    if (stat.isDirectory()) {
      updated += updateImportsRecursively(itemPath);
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
      if (updateImportsInFile(itemPath)) {
        console.log(`🔄 Updated imports in ${itemPath}`);
        updated++;
      }
    }
  }
  
  return updated;
}

function updateAllImports() {
  console.log('🔄 Updating import paths after reorganization...\n');
  
  let totalUpdated = 0;
  
  // Update tests
  console.log('📁 Updating test imports...');
  totalUpdated += updateImportsRecursively('tests');
  
  // Update examples  
  console.log('📁 Updating example imports...');
  totalUpdated += updateImportsRecursively('examples');
  
  // Update source imports (internal)
  console.log('📁 Updating source imports...');
  totalUpdated += updateImportsRecursively('src');
  
  console.log(`\n✅ Updated imports in ${totalUpdated} files`);
  
  if (totalUpdated > 0) {
    console.log('\n📝 Remember to:');
    console.log('  1. Run TypeScript compilation check: bun run typecheck');
    console.log('  2. Run tests to verify functionality: bun test');
    console.log('  3. Check for any remaining import issues');
  }
}

// Run the import updates
updateAllImports();