#!/usr/bin/env bun

/**
 * Documentation Organization Script
 * Moves all .md files to appropriate docs/ subdirectories
 */

import { readdirSync, statSync, renameSync, existsSync } from 'fs';
import { join } from 'path';

const docCategories = {
  reports: [
    'AUDIT', 'REPORT', 'ANALYSIS', 'COMPLETE_CODE_AUDIT', 'FIXES_COMPLETE',
    'TYPESCRIPT_VERIFICATION', 'TYPESCRIPT_MIGRATION', 'DISTRIBUTION_SYSTEM_AUDIT',
    'SPEECH_ANALYSIS_AUDIT', 'COMPREHENSIVE_CODEBASE_AUDIT', 'CODE_AUDIT_REPORT',
    'PERFORMANCE_OPTIMIZATION_LOG', 'LAZY_LOADING_AUDIT', 'CLEANUP_LOG'
  ],
  guides: [
    'GUIDE', 'DEPLOYMENT', 'DOCKER', 'INTEGRATION', 'CHECKLIST', 'MAINTENANCE',
    'EMERGENCY_FIX', 'RELEASE_NOTES', 'NETLIFY'
  ],
  roadmap: [
    'ROADMAP', 'ARCHITECTURE_AND_ROADMAP'
  ],
  architecture: [
    'ARCHITECTURE', 'DESIGN', 'PATTERNS', 'STRUCTURE'
  ],
  api: [
    'API', 'ENDPOINTS'
  ]
};

function categorizeFile(filename) {
  const upper = filename.toUpperCase();
  
  for (const [category, keywords] of Object.entries(docCategories)) {
    if (keywords.some(keyword => upper.includes(keyword))) {
      return category;
    }
  }
  
  // Special cases
  if (upper.includes('MULTIMODAL') || upper.includes('BLAZEFACE') || upper.includes('NEON')) {
    return 'reports';
  }
  
  if (upper.includes('DYNAMIC') || upper.includes('MULTI_DISTRIBUTION')) {
    return 'architecture';
  }
  
  // Default category for uncategorized docs
  return 'reports';
}

function organizeDocumentation() {
  console.log('📚 Organizing documentation files...\n');
  
  const rootFiles = readdirSync('.');
  const mdFiles = rootFiles.filter(f => f.endsWith('.md') && f !== 'README.md');
  
  let moved = 0;
  
  for (const file of mdFiles) {
    try {
      const category = categorizeFile(file);
      const targetDir = `docs/${category}`;
      const targetPath = join(targetDir, file);
      
      if (!existsSync(targetDir)) {
        console.log(`Creating directory: ${targetDir}`);
      }
      
      console.log(`📄 ${file} → docs/${category}/`);
      renameSync(file, targetPath);
      moved++;
      
    } catch (error) {
      console.error(`❌ Failed to move ${file}:`, error.message);
    }
  }
  
  console.log(`\n✅ Moved ${moved} documentation files`);
  console.log('\n📁 Documentation structure:');
  
  // Show final structure
  const docDirs = readdirSync('docs');
  for (const dir of docDirs) {
    const dirPath = join('docs', dir);
    if (statSync(dirPath).isDirectory()) {
      const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
      console.log(`   docs/${dir}/ (${files.length} files)`);
      files.slice(0, 3).forEach(f => console.log(`     - ${f}`));
      if (files.length > 3) {
        console.log(`     ... and ${files.length - 3} more`);
      }
    }
  }
}

// Run the organization
organizeDocumentation();