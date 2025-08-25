#!/usr/bin/env bun

/**
 * Test Organization Script
 * Moves test files to appropriate categories and consolidates scattered tests
 */

import { readdirSync, statSync, renameSync, existsSync } from 'fs';
import { join } from 'path';

function categorizeTest(filename) {
  const lower = filename.toLowerCase();
  
  // Performance tests
  if (lower.includes('performance') || lower.includes('benchmark')) {
    return 'performance';
  }
  
  // Integration tests
  if (lower.includes('integration') || lower.includes('server') || 
      lower.includes('api') || lower.includes('distribution') ||
      lower.includes('multimodal') || lower.includes('speech-client')) {
    return 'integration';
  }
  
  // E2E tests
  if (lower.includes('e2e') || lower.includes('browser') || 
      lower.includes('comprehensive')) {
    return 'e2e';
  }
  
  // Unit tests (default)
  return 'unit';
}

function organizeTests() {
  console.log('🧪 Organizing test files...\n');
  
  let moved = 0;
  
  // Move test files from root
  const rootFiles = readdirSync('.');
  const rootTestFiles = rootFiles.filter(f => 
    (f.startsWith('test-') || f.includes('test')) && f.endsWith('.js')
  );
  
  for (const file of rootTestFiles) {
    try {
      const category = categorizeTest(file);
      const targetPath = join('tests', category, file);
      
      console.log(`🧪 ${file} → tests/${category}/`);
      renameSync(file, targetPath);
      moved++;
      
    } catch (error) {
      console.error(`❌ Failed to move ${file}:`, error.message);
    }
  }
  
  // Organize existing tests/ directory
  const testsDir = 'tests';
  if (existsSync(testsDir)) {
    const testFiles = readdirSync(testsDir);
    
    for (const file of testFiles) {
      const filePath = join(testsDir, file);
      
      if (statSync(filePath).isFile() && file.endsWith('.test.js')) {
        try {
          const category = categorizeTest(file);
          const targetPath = join('tests', category, file);
          
          console.log(`📁 tests/${file} → tests/${category}/`);
          renameSync(filePath, targetPath);
          moved++;
          
        } catch (error) {
          console.error(`❌ Failed to move tests/${file}:`, error.message);
        }
      } else if (statSync(filePath).isDirectory() && !['unit', 'integration', 'e2e', 'performance', 'fixtures'].includes(file)) {
        // Move subdirectory contents
        const subFiles = readdirSync(filePath);
        
        for (const subFile of subFiles) {
          if (subFile.endsWith('.test.js')) {
            try {
              const category = categorizeTest(subFile);
              const sourcePath = join(filePath, subFile);
              const targetPath = join('tests', category, `${file}-${subFile}`);
              
              console.log(`📂 tests/${file}/${subFile} → tests/${category}/${file}-${subFile}`);
              renameSync(sourcePath, targetPath);
              moved++;
              
            } catch (error) {
              console.error(`❌ Failed to move tests/${file}/${subFile}:`, error.message);
            }
          }
        }
      }
    }
  }
  
  console.log(`\n✅ Organized ${moved} test files`);
  console.log('\n🧪 Test structure:');
  
  // Show final test structure
  const testDirs = ['unit', 'integration', 'e2e', 'performance'];
  for (const dir of testDirs) {
    const dirPath = join('tests', dir);
    if (existsSync(dirPath)) {
      const files = readdirSync(dirPath).filter(f => f.endsWith('.js') || f.endsWith('.test.js'));
      console.log(`   tests/${dir}/ (${files.length} files)`);
      files.slice(0, 3).forEach(f => console.log(`     - ${f}`));
      if (files.length > 3) {
        console.log(`     ... and ${files.length - 3} more`);
      }
    }
  }
}

// Run the organization
organizeTests();