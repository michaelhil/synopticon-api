/**
 * Synopticon Development Guardrail Validator
 * Automated enforcement of development standards and architectural compliance
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Validation result types
interface ValidationResult {
  file: string;
  line?: number;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

interface ValidationSummary {
  totalFiles: number;
  violations: ValidationResult[];
  errors: number;
  warnings: number;
  passed: boolean;
}

// Configuration
const VALIDATION_CONFIG = {
  maxFileLength: 300,
  maxFunctionLength: 50,
  sourcePatterns: [
    'src/**/*.ts',
    'src/**/*.js',
    'scripts/**/*.ts',
    'tests/**/*.ts'
  ],
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    '**/*.d.ts',
    '**/*.backup'
  ]
} as const;

// Factory function for validator
export const createGuardrailValidator = () => {
  const violations: ValidationResult[] = [];

  const addViolation = (
    file: string, 
    rule: string, 
    message: string, 
    severity: 'error' | 'warning' = 'error',
    line?: number
  ) => {
    violations.push({ file, rule, message, severity, line });
  };

  const validateFileLength = (filePath: string, content: string) => {
    const lines = content.split('\n').length;
    if (lines > VALIDATION_CONFIG.maxFileLength) {
      addViolation(
        filePath,
        'file-length',
        `File has ${lines} lines, exceeds limit of ${VALIDATION_CONFIG.maxFileLength}`,
        'error'
      );
    }
  };

  const validateFunctionLength = (filePath: string, content: string) => {
    const lines = content.split('\n');
    let currentFunction = '';
    let functionStart = 0;
    let braceCount = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Function detection patterns
      const functionPatterns = [
        /^(export\s+)?(const|let|var)\s+\w+\s*=\s*\(/,
        /^(export\s+)?(async\s+)?function\s+\w+\s*\(/,
        /^\s*\w+\s*:\s*(async\s+)?\(/,
        /^\s*\w+\s*\(/
      ];

      // Check for function start
      if (!inFunction && functionPatterns.some(pattern => pattern.test(trimmed))) {
        inFunction = true;
        functionStart = i + 1;
        currentFunction = trimmed.split(/[(:=]/)[0].trim();
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else if (inFunction) {
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        // Check for function end
        if (braceCount <= 0 && (trimmed.includes('}') || trimmed.includes(');'))) {
          const functionLength = i - functionStart + 1;
          if (functionLength > VALIDATION_CONFIG.maxFunctionLength) {
            addViolation(
              filePath,
              'function-length',
              `Function '${currentFunction}' has ${functionLength} lines, exceeds limit of ${VALIDATION_CONFIG.maxFunctionLength}`,
              'error',
              functionStart
            );
          }
          inFunction = false;
          braceCount = 0;
        }
      }
    }
  };

  const validatePlaceholderCode = (filePath: string, content: string) => {
    const forbiddenPatterns = [
      /\/\/\s*TODO:\s*Implement/i,
      /throw new Error\(['"`]Not implemented['"`]\)/,
      /\/\/\s*Placeholder\s+for/i,
      /const\s+mockData\s*=/,
      /return\s+null;\s*\/\/\s*temporary/i
    ];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      forbiddenPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          addViolation(
            filePath,
            'placeholder-code',
            `Placeholder code detected: ${line.trim()}`,
            'error',
            index + 1
          );
        }
      });
    });
  };

  const validateClassUsage = (filePath: string, content: string) => {
    const classPattern = /\bclass\s+\w+/g;
    const constructorPattern = /\bconstructor\s*\(/g;
    
    if (classPattern.test(content)) {
      addViolation(
        filePath,
        'no-classes',
        'ES6 classes are forbidden, use factory functions instead',
        'error'
      );
    }
    
    if (constructorPattern.test(content)) {
      addViolation(
        filePath,
        'no-constructors',
        'Constructor functions are forbidden, use factory functions instead',
        'error'
      );
    }
  };

  const validateRuntimeUsage = (filePath: string, content: string) => {
    const nodeOnlyPatterns = [
      /require\s*\(\s*['"`]fs['"`]\s*\)/,
      /import.*from\s*['"`]fs['"`]/,
      /process\.env(?!\.|$)/,
    ];

    nodeOnlyPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        addViolation(
          filePath,
          'bun-compatibility',
          'Potential Node.js-only API usage detected, ensure Bun compatibility',
          'warning'
        );
      }
    });
  };

  const validateFile = async (filePath: string): Promise<void> => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      validateFileLength(filePath, content);
      validateFunctionLength(filePath, content);
      validatePlaceholderCode(filePath, content);
      validateClassUsage(filePath, content);
      validateRuntimeUsage(filePath, content);
      
    } catch (error) {
      addViolation(
        filePath,
        'file-access',
        `Could not read file: ${error}`,
        'error'
      );
    }
  };

  const findSourceFiles = (dir: string): string[] => {
    const files: string[] = [];
    
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!VALIDATION_CONFIG.excludePatterns.some(pattern => 
            fullPath.includes(pattern.replace('/**', '')))) {
            files.push(...findSourceFiles(fullPath));
          }
        } else if (entry.isFile()) {
          // Include TypeScript and JavaScript files
          const ext = extname(entry.name);
          if (['.ts', '.js'].includes(ext) && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  };

  const validateProject = async (): Promise<ValidationSummary> => {
    const sourceFiles: string[] = [];
    
    // Collect files from source directories
    const sourceDirs = ['src', 'scripts', 'tests'];
    for (const dir of sourceDirs) {
      sourceFiles.push(...findSourceFiles(dir));
    }

    // Validate each file
    for (const file of sourceFiles) {
      await validateFile(file);
    }

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;

    return {
      totalFiles: sourceFiles.length,
      violations,
      errors,
      warnings,
      passed: errors === 0
    };
  };

  return {
    validateFile,
    validateProject,
    getViolations: () => [...violations]
  };
};

// CLI execution
const runValidation = async () => {
  console.log('🛡️ Synopticon Guardrail Validator');
  console.log('===================================');
  
  const validator = createGuardrailValidator();
  const summary = await validator.validateProject();
  
  // Display results
  console.log(`\nValidated ${summary.totalFiles} files`);
  console.log(`Errors: ${summary.errors}`);
  console.log(`Warnings: ${summary.warnings}`);
  
  if (summary.violations.length > 0) {
    console.log('\nViolations:');
    summary.violations.forEach(violation => {
      const location = violation.line ? `:${violation.line}` : '';
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${violation.file}${location}`);
      console.log(`   ${violation.rule}: ${violation.message}`);
    });
  }
  
  if (summary.passed) {
    console.log('\n✅ All guardrail checks passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Guardrail violations found');
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.main) {
  runValidation().catch(console.error);
}