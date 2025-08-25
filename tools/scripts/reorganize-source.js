#!/usr/bin/env bun

/**
 * Source Reorganization Script
 * Reorganizes src/ into feature-based modular structure
 */

import { readdirSync, statSync, renameSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';

function reorganizeSource() {
  console.log('🏗️ Reorganizing source code into features...\n');
  
  const srcPath = 'src';
  if (!existsSync(srcPath)) {
    console.log('❌ src/ directory not found');
    return;
  }
  
  // Create new structure
  const newStructure = [
    'src/core',           // Core system (already good)
    'src/features/face-detection',
    'src/features/eye-tracking', 
    'src/features/emotion-analysis',
    'src/features/speech-analysis',
    'src/features/distribution',
    'src/services/api',
    'src/services/streaming',
    'src/shared/utils',
    'src/shared/types',
    'src/shared/constants'
  ];
  
  for (const dir of newStructure) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Created ${dir}`);
    }
  }
  
  // Map current directories to new structure
  const directoryMappings = {
    'face-detection': 'src/features/face-detection',
    'eye-tracking': 'src/features/eye-tracking', 
    'speech-analysis': 'src/features/speech-analysis',
    'audio': 'src/features/speech-analysis/audio',
    'api': 'src/services/api',
    'utils': 'src/shared/utils',
    'modules': 'src/shared/utils/modules',
    'configs': 'src/shared/constants',
    'visualization': 'src/shared/utils/visualization',
    'ui': 'src/shared/utils/ui',
    'shaders': 'src/shared/utils/shaders'
  };
  
  let moved = 0;
  
  // Get current src contents
  const srcContents = readdirSync(srcPath);
  
  for (const item of srcContents) {
    const itemPath = join(srcPath, item);
    
    if (statSync(itemPath).isDirectory() && item !== 'core' && item !== 'features' && item !== 'services' && item !== 'shared') {
      
      const targetPath = directoryMappings[item];
      
      if (targetPath) {
        try {
          console.log(`🏗️ Moving ${item}/ → ${targetPath.replace('src/', '')}/`);
          
          // Move directory contents
          if (existsSync(targetPath)) {
            // Move contents into existing directory
            const itemContents = readdirSync(itemPath);
            for (const subItem of itemContents) {
              const sourcePath = join(itemPath, subItem);
              const destPath = join(targetPath, subItem);
              renameSync(sourcePath, destPath);
            }
            // Remove empty directory
            rmSync(itemPath, { recursive: true });
          } else {
            // Move entire directory
            renameSync(itemPath, targetPath);
          }
          moved++;
        } catch (error) {
          console.error(`❌ Failed to move ${item}:`, error.message);
        }
      } else {
        console.log(`ℹ️ Keeping ${item}/ in current location`);
      }
    }
  }
  
  // Handle pipelines directory specially - distribute to features
  if (existsSync('src/pipelines')) {
    console.log('🔧 Redistributing pipelines to features...');
    
    const pipelineFiles = readdirSync('src/pipelines');
    
    for (const file of pipelineFiles) {
      const sourcePath = join('src/pipelines', file);
      let targetPath = '';
      
      if (file.includes('emotion')) {
        targetPath = join('src/features/emotion-analysis', file);
      } else if (file.includes('eye') || file.includes('iris')) {
        targetPath = join('src/features/eye-tracking', file);
      } else if (file.includes('face') || file.includes('mediapipe')) {
        targetPath = join('src/features/face-detection', file);
      } else if (file.includes('age')) {
        targetPath = join('src/features/face-detection', file); // Age estimation often uses face features
      } else {
        targetPath = join('src/shared/utils', file);
      }
      
      // Create target directory if it doesn't exist
      const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      
      try {
        console.log(`🧩 ${file} → ${targetPath.replace('src/', '')}`);
        renameSync(sourcePath, targetPath);
        moved++;
      } catch (error) {
        console.error(`❌ Failed to move pipeline ${file}:`, error.message);
      }
    }
    
    // Remove empty pipelines directory
    try {
      rmSync('src/pipelines', { recursive: true });
      console.log('🗑️ Removed empty pipelines/ directory');
    } catch (error) {
      console.log('ℹ️ Could not remove pipelines/ directory (may contain files)');
    }
  }
  
  console.log(`\n✅ Reorganized ${moved} directories/files`);
  console.log('\n🏗️ New source structure:');
  
  // Show final structure
  showDirectoryTree('src', 0, 2);
  
  // Create README files for major sections
  createSectionREADMEs();
}

function showDirectoryTree(dirPath, level = 0, maxLevel = 3) {
  if (level > maxLevel || !existsSync(dirPath)) return;
  
  const items = readdirSync(dirPath).filter(item => {
    const itemPath = join(dirPath, item);
    return statSync(itemPath).isDirectory();
  }).sort();
  
  const indent = '  '.repeat(level);
  
  if (level === 0) {
    console.log(`${indent}${dirPath}/`);
  }
  
  for (const item of items) {
    const itemPath = join(dirPath, item);
    console.log(`${indent}  ${item}/`);
    
    if (level < maxLevel) {
      const subItems = readdirSync(itemPath).filter(subItem => {
        return statSync(join(itemPath, subItem)).isDirectory();
      });
      
      if (subItems.length > 0) {
        showDirectoryTree(itemPath, level + 1, maxLevel);
      } else {
        // Show file count
        const files = readdirSync(itemPath).filter(f => statSync(join(itemPath, f)).isFile());
        if (files.length > 0) {
          console.log(`${indent}    (${files.length} files)`);
        }
      }
    }
  }
}

function createSectionREADMEs() {
  const readmes = {
    'src/features': {
      title: 'Features',
      description: 'Feature modules containing specific analysis capabilities. Each feature is self-contained with its own models, processing logic, and utilities.'
    },
    'src/services': {
      title: 'Services',
      description: 'Service layer providing APIs, streaming, and external integrations. These are the interfaces through which features are exposed.'
    },
    'src/shared': {
      title: 'Shared',
      description: 'Shared utilities, types, and constants used across multiple features and services.'
    }
  };
  
  for (const [dir, info] of Object.entries(readmes)) {
    if (existsSync(dir)) {
      const readmePath = join(dir, 'README.md');
      const content = `# ${info.title}

${info.description}

## Structure

${readdirSync(dir).filter(item => {
  const itemPath = join(dir, item);
  return statSync(itemPath).isDirectory();
}).map(subdir => `- \`${subdir}/\` - [Add description]`).join('\n')}

## Guidelines

- Each subdirectory should be self-contained
- Minimize dependencies between peer directories
- Share common functionality through the shared/ directory
- Follow consistent naming conventions
`;
      
      try {
        require('fs').writeFileSync(readmePath, content);
        console.log(`📝 Created ${readmePath}`);
      } catch (error) {
        console.error(`❌ Failed to create README for ${dir}:`, error.message);
      }
    }
  }
}

// Run the reorganization
reorganizeSource();