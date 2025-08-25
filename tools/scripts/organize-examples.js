#!/usr/bin/env bun

/**
 * Example Organization Script
 * Consolidates demos/ and examples/ and organizes by complexity
 */

import { readdirSync, statSync, renameSync, existsSync, cpSync, rmSync } from 'fs';
import { join } from 'path';

function categorizeExample(filename) {
  const lower = filename.toLowerCase();
  
  // Tutorials - step-by-step learning materials
  if (lower.includes('tutorial') || lower.includes('getting-started') || 
      lower.includes('basic') || lower.includes('simple')) {
    return 'tutorials';
  }
  
  // Snippets - small code examples
  if (lower.includes('snippet') || lower.includes('util') || 
      (lower.includes('demo') && lower.includes('small'))) {
    return 'snippets';
  }
  
  // Playground - interactive demos and complex examples
  return 'playground';
}

function organizeExamples() {
  console.log('🎮 Consolidating examples and demos...\n');
  
  let moved = 0;
  
  // First, handle demos/ directory
  if (existsSync('demos')) {
    console.log('📁 Processing demos/ directory...');
    const demoFiles = readdirSync('demos');
    
    for (const file of demoFiles) {
      const sourcePath = join('demos', file);
      
      if (statSync(sourcePath).isFile()) {
        const category = categorizeExample(file);
        const targetPath = join('examples', category, file);
        
        console.log(`🎮 demos/${file} → examples/${category}/`);
        
        try {
          renameSync(sourcePath, targetPath);
          moved++;
        } catch (error) {
          console.error(`❌ Failed to move demos/${file}:`, error.message);
        }
      }
    }
  }
  
  // Handle existing examples/ files
  if (existsSync('examples')) {
    console.log('📁 Processing examples/ directory...');
    const exampleFiles = readdirSync('examples');
    
    for (const file of exampleFiles) {
      const sourcePath = join('examples', file);
      
      if (statSync(sourcePath).isFile() && !['playground', 'tutorials', 'snippets'].includes(file)) {
        const category = categorizeExample(file);
        const targetPath = join('examples', category, file);
        
        console.log(`📂 examples/${file} → examples/${category}/`);
        
        try {
          renameSync(sourcePath, targetPath);
          moved++;
        } catch (error) {
          console.error(`❌ Failed to move examples/${file}:`, error.message);
        }
      }
    }
  }
  
  // Handle demo files at root
  const rootFiles = readdirSync('.');
  const demoFiles = rootFiles.filter(f => 
    f.includes('demo') && (f.endsWith('.js') || f.endsWith('.html'))
  );
  
  for (const file of demoFiles) {
    const category = categorizeExample(file);
    const targetPath = join('examples', category, file);
    
    console.log(`🏠 ${file} → examples/${category}/`);
    
    try {
      renameSync(file, targetPath);
      moved++;
    } catch (error) {
      console.error(`❌ Failed to move ${file}:`, error.message);
    }
  }
  
  // Clean up empty demos directory
  if (existsSync('demos')) {
    try {
      const demoContents = readdirSync('demos');
      if (demoContents.length === 0) {
        rmSync('demos', { recursive: true });
        console.log('🗑️  Removed empty demos/ directory');
      }
    } catch (error) {
      console.log('ℹ️  Could not remove demos/ directory (may contain files)');
    }
  }
  
  console.log(`\n✅ Organized ${moved} example files`);
  console.log('\n🎮 Examples structure:');
  
  // Show final examples structure
  const exampleDirs = ['tutorials', 'playground', 'snippets'];
  for (const dir of exampleDirs) {
    const dirPath = join('examples', dir);
    if (existsSync(dirPath)) {
      const files = readdirSync(dirPath);
      console.log(`   examples/${dir}/ (${files.length} files)`);
      files.slice(0, 3).forEach(f => console.log(`     - ${f}`));
      if (files.length > 3) {
        console.log(`     ... and ${files.length - 3} more`);
      }
    }
  }
  
  // Create README files for each category
  createExampleREADMEs();
}

function createExampleREADMEs() {
  const readmes = {
    'tutorials': {
      title: 'Tutorials',
      description: 'Step-by-step learning materials and basic examples for getting started with Synopticon API.',
      content: 'Perfect for beginners who want to learn the fundamentals of face detection, eye tracking, and multi-modal analysis.'
    },
    'playground': {
      title: 'Interactive Playground',
      description: 'Complex demos and interactive examples showcasing advanced features and real-world use cases.',
      content: 'Explore advanced functionality like multi-pipeline coordination, real-time streaming, and research applications.'
    },
    'snippets': {
      title: 'Code Snippets',
      description: 'Small, focused code examples demonstrating specific features or utility functions.',
      content: 'Quick reference implementations for common tasks and integration patterns.'
    }
  };
  
  for (const [dir, info] of Object.entries(readmes)) {
    const readmePath = join('examples', dir, 'README.md');
    const content = `# ${info.title}

${info.description}

${info.content}

## Files in this directory

${existsSync(join('examples', dir)) ? 
  readdirSync(join('examples', dir))
    .filter(f => f !== 'README.md')
    .map(f => `- \`${f}\` - [Add description]`)
    .join('\n') : 'No files yet.'}

## Usage

Each example includes inline documentation and can be run independently. Check the file headers for specific requirements and setup instructions.
`;
    
    try {
      require('fs').writeFileSync(readmePath, content);
      console.log(`📝 Created ${readmePath}`);
    } catch (error) {
      console.error(`❌ Failed to create README for ${dir}:`, error.message);
    }
  }
}

// Run the organization
organizeExamples();