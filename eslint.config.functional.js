/**
 * Strict Functional Programming ESLint Configuration
 * Enforces the user's functional programming preferences
 */

import js from '@eslint/js';
import fp from 'eslint-plugin-fp';
import functional from 'eslint-plugin-functional';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // Base configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'readonly',
        require: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        ResizeObserver: 'readonly',
        // WebRTC and Media APIs
        RTCPeerConnection: 'readonly',
        MediaStream: 'readonly',
        RTCSessionDescription: 'readonly',
        RTCIceCandidate: 'readonly',
        MediaRecorder: 'readonly',
        // Three.js
        THREE: 'readonly',
        // Browser APIs  
        URL: 'readonly',
        performance: 'readonly',
        // Others
        FaceMesh: 'readonly',
        Bun: 'readonly'
      }
    },
    plugins: {
      fp,
      functional
    },
    rules: {
      ...js.configs.recommended.rules,
      
      // Functional Programming Rules (practical enforcement)
      'fp/no-class': 'error',
      'fp/no-this': 'warn', // Allow for existing code, warn for new
      'fp/no-mutating-methods': 'warn', // Allow for existing, warn for new
      'fp/no-mutation': 'off', // Too strict for existing codebase
      'functional/no-classes': 'error',
      'functional/immutable-data': 'off', // Requires type information
      'functional/no-let': 'warn',
      'functional/prefer-immutable-types': 'off',
      
      // Core functional patterns
      'no-var': 'error',
      'prefer-const': 'error',
      'no-new': 'warn', // Allow new for built-in constructors
      
      // Pure functions and immutability
      'no-param-reassign': ['error', { props: true }],
      'prefer-arrow-callback': 'error',
      'arrow-spacing': 'error',
      'no-loop-func': 'error',
      'no-implicit-coercion': 'error',
      
      // Code quality
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'max-lines-per-function': ['warn', 200], // More lenient for existing code
      'max-params': ['error', 4],
      'complexity': ['warn', 10],
      'prefer-template': 'error',
      
      // Object and array patterns
      'prefer-destructuring': ['error', {
        VariableDeclarator: {
          array: false,
          object: true
        },
        AssignmentExpression: {
          array: false, 
          object: true
        }
      }],
      'object-shorthand': 'error',
      'prefer-object-spread': 'error',
      'prefer-spread': 'error',
      'no-array-constructor': 'error',
      
      // Error handling
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'error',
      
      // Modern JavaScript
      'prefer-rest-params': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      
      // Formatting (enforce consistency)
      'comma-dangle': ['error', 'never'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2],
      'eol-last': 'error',
      'no-console': 'off' // Allow console for this project
    }
  },
  
  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      fp,
      functional
    },
    rules: {
      // TypeScript-specific functional programming (basic rules only)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-function-type': 'off', // Requires type info
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Requires type info
      '@typescript-eslint/prefer-optional-chain': 'off', // Requires type info
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires type info
      '@typescript-eslint/prefer-readonly': 'off', // Requires type info
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      
      // Override base rules for TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }]
    }
  },
  
  // Test files - more lenient rules
  {
    files: ['**/*.test.js', '**/*.test.ts', '**/test-*.js', '**/test-*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
      'fp/no-mutation': 'off', // Allow mutations in tests
      'functional/immutable-data': 'off'
    }
  }
];