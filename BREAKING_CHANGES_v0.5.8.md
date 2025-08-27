# Breaking Changes - v0.5.8

## Overview
This release removes all backward compatibility code, legacy support, and fallback mechanisms to simplify the codebase and improve maintainability. This is a **breaking change** release that modernizes the API.

## Removed Features

### 1. Speech Recognition Fallbacks
- **Removed**: `fallback-backend.js` and `fallback-ui-creator.js`
- **Impact**: Speech recognition now requires Web Speech API support
- **Migration**: Use browsers that support Web Speech API (Chrome, Edge)

### 2. Express.js Support
- **Removed**: All Express.js optional dependencies
  - `express`
  - `express-rate-limit` 
  - `express-validator`
  - `helmet`
  - `morgan`
  - `cors`
- **Impact**: Only Bun.serve native HTTP server supported
- **Migration**: Use Bun runtime exclusively

### 3. Compatibility Comments and Layers
- **Removed**: All "backward compatibility", "legacy", and "compatibility layer" code
- **Impact**: Cleaner codebase, but no fallback support
- **Migration**: Update integrations to use current APIs

### 4. Browser Compatibility Tests
- **Removed**: `tests/e2e/browser-test.js`
- **Impact**: No more legacy browser testing
- **Migration**: Target modern browsers only

## API Changes

### Speech Recognition
```js
// OLD (Removed)
import { createFallbackBackend } from './recognition/fallback-backend.js';

// NEW (Only option)
import { createWebSpeechAPIBackend } from './recognition/web-speech-backend.js';
```

### Comments Cleaned Up
- Removed "backward compatibility" references
- Removed "legacy support" comments
- Simplified interface documentation

## Runtime Requirements

### Before v0.5.8
- Bun runtime (recommended)
- Node.js fallback support
- Express.js optional support
- Fallback mechanisms for unsupported features

### After v0.5.8
- **Bun runtime required** (>=1.0.0)
- **No Node.js support**
- **No Express.js support**
- **No fallback mechanisms**

## Migration Guide

### 1. Runtime Migration
```bash
# Ensure Bun is installed
bun --version

# Remove any Node.js dependencies
rm -rf node_modules package-lock.json
bun install
```

### 2. Server Migration
```js
// OLD (No longer supported)
import express from 'express';
const app = express();

// NEW (Required)
import { serve } from 'bun';
serve({
  port: 3000,
  fetch: handler
});
```

### 3. Speech Recognition Migration
```js
// OLD (Removed)
const recognition = createSpeechRecognition({
  fallback: true
});

// NEW (Web Speech API only)
const recognition = createSpeechRecognition({
  // Web Speech API required
});
```

## Benefits of Breaking Changes

### Code Quality
- **Reduced complexity**: 50+ compatibility references removed
- **Cleaner codebase**: No legacy code paths
- **Simplified maintenance**: Single runtime target
- **Better performance**: No compatibility overhead

### Developer Experience  
- **Clear requirements**: Bun-only eliminates confusion
- **Modern patterns**: Current best practices only
- **Faster builds**: No compatibility checking
- **Simplified documentation**: Single path forward

## Compatibility Matrix

| Feature | v0.5.7 | v0.5.8 |
|---------|--------|--------|
| Bun Runtime | ✅ | ✅ |
| Node.js Runtime | ⚠️ | ❌ |
| Express.js | ⚠️ | ❌ |
| Web Speech API | ✅ | ✅ |
| Speech Fallback | ✅ | ❌ |
| Legacy Comments | ✅ | ❌ |

## Upgrade Checklist

- [ ] Verify Bun runtime installed (>=1.0.0)
- [ ] Remove Node.js-specific code
- [ ] Remove Express.js dependencies
- [ ] Update speech recognition to require Web Speech API
- [ ] Test on target browsers (Chrome/Edge)
- [ ] Update deployment scripts for Bun-only
- [ ] Review CI/CD for Bun runtime

## Risk Assessment

### High Risk
- **Runtime dependency**: Must use Bun
- **Browser support**: Web Speech API required for speech features
- **Deployment changes**: Bun-specific deployment needed

### Medium Risk  
- **Integration updates**: Remove compatibility code from integrations
- **Testing updates**: Update test suites for Bun-only

### Low Risk
- **Documentation**: Already Bun-focused
- **Core functionality**: Face detection, MCP integration unchanged

## Support

For migration assistance:
- Review MCP setup guides (Bun-native)
- Check examples for Bun patterns
- Use issues for migration questions

---

**Note**: This breaking change release modernizes Synopticon API for better performance and maintainability. The benefits outweigh the migration effort for most users already using Bun runtime.