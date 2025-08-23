# Netlify Deployment Guide

## 🚀 Deploy to Netlify

This demo is ready for static deployment to Netlify. Here's how to deploy it:

### Option 1: Drag and Drop
1. Create a ZIP file of the entire project directory
2. Go to [netlify.com](https://netlify.com) and sign up/login
3. Drag the ZIP file to the Netlify deploy area
4. Your demo will be live at a generated URL

### Option 2: Git Integration
1. Push this repository to GitHub/GitLab
2. Connect your repository to Netlify
3. Set build settings:
   - Build command: (leave empty)
   - Publish directory: `.` (root)
4. Deploy automatically on push

### Option 3: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy from project root
netlify deploy --prod --dir .
```

## 📁 File Structure

The demo is configured for static hosting with:

- `index.html` - Landing page with demo links
- `demo-mediapipe.html` - Main MediaPipe demo
- `netlify.toml` - Netlify configuration
- `src/` - JavaScript modules (served as static files)
- All dependencies loaded from CDN

## 🔧 Features Included

✅ **MediaPipe Face Mesh** - 468 landmark detection  
✅ **6DOF Pose Tracking** - Full head position/rotation  
✅ **Eye Tracking** - Iris tracking with gaze vectors  
✅ **Gaze Trace History** - Customizable movement trails  
✅ **Automatic Calibration** - Both pose and eye calibration  
✅ **Help System** - Tooltips for all features  
✅ **Performance Monitoring** - FPS, latency, pipeline comparison  
✅ **Smooth Rendering** - Anti-flicker numerical displays  

## 🌐 HTTPS Requirement

**Important**: The demo requires HTTPS to access the camera. Netlify provides HTTPS by default, so this works perfectly for deployment.

## 📱 Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: MediaPipe support varies
- Mobile: Works on iOS Safari, Android Chrome

## 🎯 Demo URL Structure

After deployment:
- `https://your-app.netlify.app/` → Landing page
- `https://your-app.netlify.app/demo-mediapipe.html` → Main demo

## 🛠️ Configuration

The `netlify.toml` file includes:
- Redirects for clean URLs
- CORS headers for MediaPipe CDN
- Camera permission headers
- Caching settings

## 🔍 Testing Locally

To test before deployment:
```bash
# Using the built-in dev server
bun demo

# Or using any static server
npx serve .
python -m http.server 8000
```

## 📊 Performance

Expected performance on Netlify:
- **Loading**: ~2-3 seconds for MediaPipe models
- **FPS**: 30-60 FPS depending on device
- **Latency**: 15-30ms processing time
- **Features**: All features work identically to local version