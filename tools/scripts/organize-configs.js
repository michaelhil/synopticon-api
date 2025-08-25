#!/usr/bin/env bun

/**
 * Configuration Organization Script
 * Moves config files to organized config/ directory
 */

import { readdirSync, statSync, renameSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

function categorizeConfig(filename) {
  const lower = filename.toLowerCase();
  
  // Build configs
  if (lower.includes('vite') || lower.includes('rollup') || lower.includes('webpack') || 
      lower.includes('build') || lower.includes('tsconfig') || lower.includes('babel')) {
    return 'build';
  }
  
  // CI/CD configs
  if (lower.includes('github') || lower.includes('workflow') || lower.includes('ci') || 
      lower.includes('actions') || lower.startsWith('.github')) {
    return 'ci';
  }
  
  // Environment configs
  if (lower.includes('env') || lower.includes('docker') || lower.includes('compose')) {
    return 'env';
  }
  
  // Default to build for most config files
  return 'build';
}

function organizeConfigs() {
  console.log('⚙️ Organizing configuration files...\n');
  
  let moved = 0;
  
  // Essential files that should stay at root
  const keepAtRoot = [
    'package.json',
    'README.md', 
    'LICENSE',
    '.gitignore',
    '.gitattributes'
  ];
  
  const rootFiles = readdirSync('.');
  const configFiles = rootFiles.filter(f => {
    return (f.endsWith('.json') || f.endsWith('.js') || f.endsWith('.ts') || 
           f.startsWith('.') || f.includes('config') || f.includes('rc')) &&
           !f.endsWith('.test.js') && 
           !f.endsWith('.test.ts') &&
           !keepAtRoot.includes(f) &&
           !f.startsWith('organize-') &&
           !f.startsWith('test-') &&
           statSync(f).isFile();
  });
  
  for (const file of configFiles) {
    try {
      const category = categorizeConfig(file);
      const targetPath = join('config', category, file);
      
      console.log(`⚙️ ${file} → config/${category}/`);
      renameSync(file, targetPath);
      moved++;
      
    } catch (error) {
      console.error(`❌ Failed to move ${file}:`, error.message);
    }
  }
  
  // Handle special case files that need copying (not moving) due to tool expectations
  const specialFiles = ['tsconfig.json', 'package.json'];
  
  for (const file of specialFiles) {
    if (existsSync(file)) {
      const category = categorizeConfig(file);
      const targetPath = join('config', category, file);
      
      if (!existsSync(targetPath)) {
        try {
          copyFileSync(file, targetPath);
          console.log(`📋 ${file} → config/${category}/ (copied)`);
        } catch (error) {
          console.error(`❌ Failed to copy ${file}:`, error.message);
        }
      }
    }
  }
  
  console.log(`\n✅ Organized ${moved} configuration files`);
  console.log('\n⚙️ Configuration structure:');
  
  // Show final config structure
  const configDirs = ['build', 'env', 'ci'];
  for (const dir of configDirs) {
    const dirPath = join('config', dir);
    if (existsSync(dirPath)) {
      const files = readdirSync(dirPath);
      console.log(`   config/${dir}/ (${files.length} files)`);
      files.slice(0, 3).forEach(f => console.log(`     - ${f}`));
      if (files.length > 3) {
        console.log(`     ... and ${files.length - 3} more`);
      }
    }
  }
  
  // Show remaining root files
  const remainingRoot = readdirSync('.').filter(f => {
    return statSync(f).isFile() && !f.startsWith('organize-') && !f.startsWith('test-core-system');
  });
  
  console.log(`\n🏠 Remaining root files: ${remainingRoot.length}`);
  remainingRoot.forEach(f => console.log(`   - ${f}`));
}

// Run the organization
organizeConfigs();