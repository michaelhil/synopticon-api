/**
 * Tobii 5 Eye Tracking Visualization Demo
 * Real-time visualization of Tobii 5 eye tracking data
 */

class TobiiVisualizationDemo {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.startTime = null;
        this.dataPoints = [];
        this.frameCount = 0;
        this.lastFrameTime = 0;
        
        this.canvas = null;
        this.ctx = null;
        
        this.currentGaze = null;
        this.currentHead = null;
        this.scanPath = [];
        this.fixations = [];
        
        this.cognitiveLoad = 0;
        this.attentionZone = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.startRenderLoop();
        
        console.log('Tobii 5 Demo initialized');
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('gazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    setupEventListeners() {
        // Connection form handling
        document.getElementById('hostInput').addEventListener('change', (e) => {
            this.host = e.target.value;
        });
        
        document.getElementById('portInput').addEventListener('change', (e) => {
            this.port = parseInt(e.target.value);
        });
    }
    
    toggleConnection() {
        if (this.connected) {
            this.disconnect();
        } else {
            this.connect();
        }
    }
    
    connect() {
        const host = document.getElementById('hostInput').value || 'localhost';
        const port = document.getElementById('portInput').value || '8080';
        
        const wsUrl = `ws://${host}:${port}`;
        
        console.log(`Connecting to Tobii bridge: ${wsUrl}`);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to Tobii bridge');
                this.connected = true;
                this.startTime = Date.now();
                this.updateConnectionStatus('Connected', true);
                
                document.getElementById('connectBtn').textContent = 'Disconnect';
                document.getElementById('calibrateBtn').disabled = false;
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from Tobii bridge');
                this.connected = false;
                this.updateConnectionStatus('Disconnected', false);
                
                document.getElementById('connectBtn').textContent = 'Connect';
                document.getElementById('calibrateBtn').disabled = true;
                
                // Clear visualization
                this.clearVisualization();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('Connection Error', false);
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.updateConnectionStatus('Connection Failed', false);
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'tobii-data') {
                this.processGazeData(message);
            } else if (message.type === 'tobii-status') {
                this.processStatusUpdate(message);
            } else if (message.type === 'tobii-calibration') {
                this.processCalibrationUpdate(message);
            }
            
            this.frameCount++;
            
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    
    processGazeData(message) {
        const data = message.data;
        const timestamp = message.timestamp;
        
        // Update current gaze position
        if (data.hasGaze && data.gaze) {
            this.currentGaze = {
                x: data.gaze.x,
                y: data.gaze.y,
                confidence: data.gaze.confidence,
                timestamp: timestamp
            };
            
            // Add to scan path
            this.addToScanPath(this.currentGaze.x, this.currentGaze.y, timestamp);
            
            // Update gaze point visualization
            this.updateGazePoint(this.currentGaze.x, this.currentGaze.y);
            
            // Update attention zone
            this.updateAttentionZone(this.currentGaze.x, this.currentGaze.y);
        }
        
        // Update head pose
        if (data.hasHead && data.head) {
            this.currentHead = {
                yaw: data.head.yaw,
                pitch: data.head.pitch,
                roll: data.head.roll,
                position: data.head.position,
                confidence: data.head.confidence
            };
            
            // Update head orientation visualization
            this.updateHeadOrientation(this.currentHead);
        }
        
        // Update UI metrics
        this.updateMetricsUI(data, timestamp);
        
        // Update cognitive load (simplified calculation)
        this.updateCognitiveLoad();
    }
    
    addToScanPath(x, y, timestamp) {
        // Convert screen coordinates to canvas coordinates
        const canvasX = (x / 1920) * this.canvas.width;  // Assuming 1920px screen width
        const canvasY = (y / 1080) * this.canvas.height; // Assuming 1080px screen height
        
        this.scanPath.push({
            x: canvasX,
            y: canvasY,
            timestamp: timestamp
        });
        
        // Keep only recent scan path data (last 5 seconds)
        const cutoffTime = timestamp - 5000;
        this.scanPath = this.scanPath.filter(point => point.timestamp > cutoffTime);
        
        // Detect fixations (simplified)
        this.detectFixations();
    }
    
    detectFixations() {
        if (this.scanPath.length < 10) return;
        
        const recent = this.scanPath.slice(-10);
        const centroid = this.calculateCentroid(recent);
        const dispersion = this.calculateDispersion(recent, centroid);
        
        // If dispersion is low, it's likely a fixation
        if (dispersion < 50) { // pixels
            const existingFixation = this.fixations.find(f => 
                Math.abs(f.x - centroid.x) < 50 && Math.abs(f.y - centroid.y) < 50
            );
            
            if (existingFixation) {
                existingFixation.duration += 100; // Approximate
                existingFixation.lastUpdate = recent[recent.length - 1].timestamp;
            } else {
                this.fixations.push({
                    x: centroid.x,
                    y: centroid.y,
                    duration: 100,
                    startTime: recent[0].timestamp,
                    lastUpdate: recent[recent.length - 1].timestamp
                });
            }
        }
        
        // Remove old fixations
        const now = Date.now();
        this.fixations = this.fixations.filter(f => (now - f.lastUpdate) < 3000);
    }
    
    calculateCentroid(points) {
        const sum = points.reduce(
            (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
            { x: 0, y: 0 }
        );
        
        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }
    
    calculateDispersion(points, centroid) {
        let maxDistance = 0;
        
        for (const point of points) {
            const distance = Math.sqrt(
                Math.pow(point.x - centroid.x, 2) +
                Math.pow(point.y - centroid.y, 2)
            );
            maxDistance = Math.max(maxDistance, distance);
        }
        
        return maxDistance;
    }
    
    updateGazePoint(x, y) {
        const gazePoint = document.getElementById('gazePoint');
        
        if (x >= 0 && y >= 0) {
            // Convert screen coordinates to viewport coordinates
            const viewportX = (x / 1920) * window.innerWidth;
            const viewportY = (y / 1080) * window.innerHeight;
            
            gazePoint.style.left = `${viewportX}px`;
            gazePoint.style.top = `${viewportY + 60}px`; // Account for header
            gazePoint.style.display = 'block';
        } else {
            gazePoint.style.display = 'none';
        }
    }
    
    updateAttentionZone(x, y) {
        // Calculate which zone the gaze is in
        const normalizedX = x / 1920;
        const normalizedY = y / 1080;
        
        let zone = 'peripheral';
        
        if (normalizedX >= 0.3 && normalizedX <= 0.7 && normalizedY >= 0.3 && normalizedY <= 0.7) {
            zone = 'center';
        } else if (normalizedY < 0.3) {
            zone = 'top';
        } else if (normalizedY > 0.7) {
            zone = 'bottom';
        } else if (normalizedX < 0.3) {
            zone = 'left';
        } else if (normalizedX > 0.7) {
            zone = 'right';
        }
        
        this.attentionZone = zone;
        
        // Update zone visualization
        document.querySelectorAll('.zone').forEach(el => {
            el.classList.remove('active');
        });
        
        const activeZone = document.querySelector(`[data-zone="${zone}"]`);
        if (activeZone) {
            activeZone.classList.add('active');
        }
        
        // Update UI
        document.getElementById('attentionZone').textContent = zone.toUpperCase();
    }
    
    updateHeadOrientation(headData) {
        const indicator = document.getElementById('headIndicator');
        
        // Simple visualization of head yaw and pitch
        const yawOffset = headData.yaw * 2; // Scale for visualization
        const pitchOffset = headData.pitch * 2;
        
        indicator.style.transform = `translate(${yawOffset}px, ${pitchOffset}px)`;
        
        // Update UI metrics
        document.getElementById('headYaw').textContent = `${headData.yaw.toFixed(1)}°`;
        document.getElementById('headPitch').textContent = `${headData.pitch.toFixed(1)}°`;
        document.getElementById('headRoll').textContent = `${headData.roll.toFixed(1)}°`;
    }
    
    updateMetricsUI(data, timestamp) {
        // Gaze position
        if (data.hasGaze && data.gaze) {
            const pos = `${data.gaze.x.toFixed(0)}, ${data.gaze.y.toFixed(0)}`;
            document.getElementById('gazePosition').textContent = pos;
            
            // Gaze quality
            const quality = (data.gaze.confidence * 100).toFixed(0);
            document.getElementById('gazeQuality').style.width = `${quality}%`;
        }
        
        // User presence
        document.getElementById('userPresent').textContent = data.present ? 'YES' : 'NO';
        
        // Overall quality
        if (data.overallQuality !== undefined) {
            const quality = (data.overallQuality * 100).toFixed(0);
            document.getElementById('overallQuality').style.width = `${quality}%`;
        }
        
        // Data rate calculation
        const now = Date.now();
        if (now - this.lastFrameTime >= 1000) {
            const fps = this.frameCount;
            document.getElementById('dataRate').textContent = `${fps} Hz`;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
        
        // Latency
        if (timestamp) {
            const latency = Date.now() - timestamp;
            document.getElementById('latency').textContent = `${latency} ms`;
        }
        
        // Uptime
        if (this.startTime) {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(uptime / 60);
            const seconds = uptime % 60;
            document.getElementById('uptime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    updateCognitiveLoad() {
        // Simple cognitive load calculation based on gaze activity
        if (this.scanPath.length < 5) return;
        
        const recent = this.scanPath.slice(-30); // Last 30 points (~0.5 seconds)
        let totalDistance = 0;
        
        for (let i = 1; i < recent.length; i++) {
            const dx = recent[i].x - recent[i-1].x;
            const dy = recent[i].y - recent[i-1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        
        // Normalize to 0-1 scale
        const avgDistance = totalDistance / recent.length;
        this.cognitiveLoad = Math.min(1, avgDistance / 100); // Adjust scaling as needed
        
        // Update UI
        const loadPercent = (this.cognitiveLoad * 100).toFixed(0);
        document.getElementById('cognitiveLoadFill').style.width = `${loadPercent}%`;
    }
    
    updateConnectionStatus(status, connected) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        indicator.classList.toggle('connected', connected);
        text.textContent = status;
    }
    
    startCalibration() {
        if (!this.connected || !this.ws) return;
        
        const command = {
            type: 'start-calibration',
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(command));
        
        // Disable calibration button temporarily
        const btn = document.getElementById('calibrateBtn');
        btn.disabled = true;
        btn.textContent = 'Calibrating...';
        
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Calibrate';
        }, 5000);
    }
    
    processStatusUpdate(message) {
        console.log('Status update:', message);
    }
    
    processCalibrationUpdate(message) {
        console.log('Calibration update:', message);
        
        // Re-enable calibration button
        const btn = document.getElementById('calibrateBtn');
        btn.disabled = false;
        btn.textContent = 'Calibrate';
    }
    
    clearVisualization() {
        // Hide gaze point
        document.getElementById('gazePoint').style.display = 'none';
        
        // Clear zones
        document.querySelectorAll('.zone').forEach(el => {
            el.classList.remove('active');
        });
        
        // Reset metrics
        document.getElementById('gazePosition').textContent = '--';
        document.getElementById('attentionZone').textContent = '--';
        document.getElementById('headYaw').textContent = '--°';
        document.getElementById('headPitch').textContent = '--°';
        document.getElementById('headRoll').textContent = '--°';
        document.getElementById('userPresent').textContent = '--';
        document.getElementById('dataRate').textContent = '-- Hz';
        document.getElementById('latency').textContent = '-- ms';
        document.getElementById('uptime').textContent = '--';
        
        // Reset quality bars
        document.getElementById('gazeQuality').style.width = '0%';
        document.getElementById('overallQuality').style.width = '0%';
        document.getElementById('cognitiveLoadFill').style.width = '0%';
        
        // Clear data
        this.scanPath = [];
        this.fixations = [];
        this.currentGaze = null;
        this.currentHead = null;
    }
    
    startRenderLoop() {
        const render = () => {
            this.renderCanvas();
            requestAnimationFrame(render);
        };
        render();
    }
    
    renderCanvas() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw scan path
        if (this.scanPath.length > 1) {
            this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.scanPath[0].x, this.scanPath[0].y);
            
            for (let i = 1; i < this.scanPath.length; i++) {
                this.ctx.lineTo(this.scanPath[i].x, this.scanPath[i].y);
            }
            
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Draw fixations
        this.ctx.fillStyle = 'rgba(255, 165, 2, 0.8)';
        this.ctx.strokeStyle = 'rgba(255, 107, 53, 1)';
        this.ctx.lineWidth = 2;
        
        for (const fixation of this.fixations) {
            const radius = Math.min(20, Math.max(5, fixation.duration / 50));
            
            this.ctx.beginPath();
            this.ctx.arc(fixation.x, fixation.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        // Draw current gaze point on canvas
        if (this.currentGaze) {
            const canvasX = (this.currentGaze.x / 1920) * this.canvas.width;
            const canvasY = (this.currentGaze.y / 1080) * this.canvas.height;
            
            this.ctx.strokeStyle = 'rgba(0, 255, 136, 1)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(canvasX, canvasY, 15, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
}

// Global functions for button handlers
function toggleConnection() {
    demo.toggleConnection();
}

function startCalibration() {
    demo.startCalibration();
}

// Initialize demo when page loads
let demo;
window.addEventListener('DOMContentLoaded', () => {
    demo = new TobiiVisualizationDemo();
});