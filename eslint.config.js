/**
 * ESLint Configuration for Synopticon API
 * Optimized for Bun runtime and functional programming patterns
 */

export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Bun globals
        Bun: "readonly",
        
        // Browser globals for demo pages
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        
        // Node.js globals (for server-side code)
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        
        // Timer globals
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        
        // Web APIs (available in both browser and server contexts)
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        
        // Text encoding/decoding
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        
        // Crypto
        crypto: "readonly",
        
        // Performance
        performance: "readonly",
        
        // Browser APIs (may be polyfilled on server)
        WebSocket: "readonly",
        ReadableStream: "readonly",
        Blob: "readonly",
        ImageData: "readonly",
        Image: "readonly",
        ResizeObserver: "readonly",
        
        // Canvas and WebGL
        HTMLCanvasElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        WebGLRenderingContext: "readonly",
        
        // HTML Media Elements
        HTMLImageElement: "readonly",
        HTMLVideoElement: "readonly",
        HTMLMediaElement: "readonly",
        
        // Animation
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        
        // Storage (browser only, but defined for compatibility)
        localStorage: "readonly",
        
        // Bun/Node specific
        global: "readonly",
        
        // Browser events
        CustomEvent: "readonly",
        
        // Third-party libraries
        THREE: "readonly"
      }
    },
    
    files: ["src/**/*.js", "examples/**/*.js"],
    ignores: ["examples/**/*.html"],
    
    rules: {
      // ES6+ and modern JavaScript
      "prefer-const": "error",
      "no-var": "error",
      "prefer-arrow-callback": "warn",
      "prefer-template": "error",
      "object-shorthand": "warn",
      
      // Functional programming alignment
      "func-style": ["warn", "expression", { "allowArrowFunctions": true }],
      "prefer-destructuring": "warn",
      "no-param-reassign": "warn",
      
      // Code quality
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_" 
      }],
      "no-console": "off", // Allow console in development codebase
      "no-debugger": "error",
      "no-alert": "error",
      
      // Complexity management (realistic limits)
      "complexity": ["warn", 20],
      "max-lines-per-function": ["warn", { "max": 150, "skipBlankLines": true, "skipComments": true }],
      "max-depth": ["warn", 5],
      "max-nested-callbacks": ["warn", 5],
      "max-statements": ["warn", 40],
      "max-params": ["warn", 6],
      "max-len": ["warn", { "code": 150, "tabWidth": 2, "ignoreUrls": true, "ignoreStrings": true, "ignoreComments": true }],
      
      // Error prevention
      "no-undef": "error",
      "no-unused-expressions": "error",
      "no-unreachable": "error",
      "no-duplicate-imports": "error",
      
      // Best practices
      "eqeqeq": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-assign": "error",
      
      // Zero-dependency enforcement and Bun-first patterns
      "no-restricted-imports": ["error", {
        "patterns": [
          {
            "group": ["express", "fastify", "koa", "hapi"],
            "message": "Use Bun.serve instead of external web frameworks"
          },
          {
            "group": ["lodash", "underscore", "ramda", "fp-ts"],
            "message": "Use native JavaScript methods instead"
          },
          {
            "group": ["axios", "node-fetch", "got", "request"],
            "message": "Use native fetch API or Bun.fetch"
          },
          {
            "group": ["moment", "date-fns"],
            "message": "Use native Date API or Temporal (when available)"
          },
          {
            "group": ["ws", "socket.io"],
            "message": "Use native WebSocket or Bun WebSocket"
          }
        ]
      }],
      
      // Performance-oriented rules (relaxed for current codebase)
      "no-await-in-loop": "off", // Too many violations, disable for now
      "require-atomic-updates": "off", // Too strict for current patterns
      "no-constant-condition": ["error", { "checkLoops": false }],
      
      // Memory management
      "no-delete-var": "error",
      "no-global-assign": "error",
      
      // Factory function patterns
      "prefer-object-spread": "error",
      "no-useless-constructor": "error",
      "no-class-assign": "error",
      
      // Bun-specific best practices
      "no-restricted-globals": ["error", {
        "name": "require",
        "message": "Use import statements instead of require() in ESM modules"
      }],
      
      // Code organization
      "sort-imports": ["warn", {
        "ignoreCase": false,
        "ignoreDeclarationSort": true,
        "ignoreMemberSort": false
      }],
      
      // Security
      "no-script-url": "warn", // Warn only
      
      // Consistency
      "consistent-return": "warn",
      "no-mixed-operators": "warn",
      "no-nested-ternary": "warn"
    }
  },
  
  // Specific configuration for server-side code
  {
    files: ["src/services/**/*.js"],
    languageOptions: {
      globals: {
        Bun: "readonly",
        process: "readonly"
      }
    },
    rules: {
      // Server-side specific rules
      "no-console": "off", // Allow console for server logging
      "no-process-exit": "warn"
    }
  },
  
  // Specific configuration for browser-side demo code
  {
    files: ["examples/**/*.html", "examples/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
        MediaRecorder: "readonly",
        MediaDevices: "readonly",
        HTMLCanvasElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        WebGLRenderingContext: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly"
      }
    },
    rules: {
      // Browser-specific adjustments
      "no-console": "off", // Allow console for demos
      "no-undef": "warn",   // More lenient for demo code
      "max-lines-per-function": ["warn", { "max": 200 }], // Demos can be longer
      "complexity": ["warn", 20] // Demo complexity allowed
    }
  },
  
  // Configuration for test files (if/when added)
  {
    files: ["tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "max-lines-per-function": "off", // Tests can be longer
      "complexity": "off",
      "max-statements": "off",
      "no-magic-numbers": "off" // Tests often use magic numbers
    }
  }
];