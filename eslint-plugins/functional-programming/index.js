/**
 * Custom ESLint rules for strict functional programming patterns
 * Enforces the user's preferences for factory functions over classes
 */

module.exports = {
  rules: {
    'no-classes': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow ES6 classes in favor of factory functions',
          category: 'Functional Programming'
        },
        fixable: null,
        schema: []
      },
      create: function(context) {
        return {
          ClassDeclaration(node) {
            context.report({
              node,
              message: 'Classes are not allowed. Use factory functions instead. Example: const createMyObject = (config) => ({ ... })'
            });
          },
          ClassExpression(node) {
            context.report({
              node,
              message: 'Class expressions are not allowed. Use factory functions instead.'
            });
          }
        };
      }
    },
    
    'prefer-factory-functions': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prefer factory functions over constructor functions',
          category: 'Functional Programming'
        },
        fixable: null,
        schema: []
      },
      create: function(context) {
        return {
          FunctionDeclaration(node) {
            // Check if function name starts with capital letter (constructor pattern)
            if (node.id && /^[A-Z]/.test(node.id.name) && 
                node.id.name !== node.id.name.toUpperCase()) {
              context.report({
                node,
                message: `Function '${node.id.name}' appears to be a constructor. Consider using a factory function like 'create${node.id.name}' instead.`
              });
            }
          },
          NewExpression(node) {
            // Allow built-in constructors like Map, Set, Array, etc.
            const allowedConstructors = [
              'Map', 'Set', 'WeakMap', 'WeakSet', 'Array', 'Object',
              'Date', 'RegExp', 'Error', 'Promise', 'URL', 'URLSearchParams',
              'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
              'Float32Array', 'Float64Array', 'ArrayBuffer', 'DataView'
            ];
            
            if (node.callee.type === 'Identifier' && 
                !allowedConstructors.includes(node.callee.name)) {
              context.report({
                node,
                message: `Avoid 'new ${node.callee.name}()'. Use factory functions instead.`
              });
            }
          }
        };
      }
    },

    'require-factory-naming': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce factory function naming convention',
          category: 'Functional Programming'
        },
        fixable: null,
        schema: []
      },
      create: function(context) {
        return {
          VariableDeclarator(node) {
            if (node.init && node.init.type === 'ArrowFunctionExpression' &&
                node.id.type === 'Identifier') {
              const functionName = node.id.name;
              
              // Check if it looks like a factory function but doesn't follow naming convention
              if (node.init.body.type === 'ObjectExpression' && 
                  !functionName.startsWith('create') && 
                  !functionName.includes('Factory') &&
                  functionName !== functionName.toLowerCase()) {
                context.report({
                  node,
                  message: `Consider naming factory function '${functionName}' with 'create' prefix: 'create${functionName.charAt(0).toUpperCase() + functionName.slice(1)}'`
                });
              }
            }
          }
        };
      }
    },

    'no-mutating-methods': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow array methods that mutate the original array',
          category: 'Functional Programming'
        },
        fixable: null,
        schema: []
      },
      create: function(context) {
        const mutatingMethods = [
          'push', 'pop', 'shift', 'unshift', 'splice', 
          'reverse', 'sort', 'fill', 'copyWithin'
        ];
        
        return {
          CallExpression(node) {
            if (node.callee.type === 'MemberExpression' &&
                node.callee.property.type === 'Identifier' &&
                mutatingMethods.includes(node.callee.property.name)) {
              
              const alternatives = {
                'push': 'Use [...array, newItem] or array.concat(newItem)',
                'pop': 'Use array.slice(0, -1)',
                'shift': 'Use array.slice(1)',
                'unshift': 'Use [newItem, ...array]',
                'splice': 'Use array.slice() with spread operator',
                'reverse': 'Use [...array].reverse() or array.slice().reverse()',
                'sort': 'Use [...array].sort() or array.slice().sort()',
                'fill': 'Use Array.from() or map()',
                'copyWithin': 'Use slice() and spread operator'
              };
              
              context.report({
                node,
                message: `Avoid mutating array method '${node.callee.property.name}'. ${alternatives[node.callee.property.name]}`
              });
            }
          }
        };
      }
    }
  }
};