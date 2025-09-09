/**
 * Canvas Rendering Module
 * Handles MediaPipe landmark visualization and canvas operations
 */

export const createCanvasRenderer = () => {
    
    const drawLandmarks = (ctx, landmarks) => {
        if (!ctx || !landmarks) {
            console.log('Canvas renderer: Missing context or landmarks', { hasCtx: !!ctx, hasLandmarks: !!landmarks });
            return;
        }
        
        console.log('Canvas renderer: Drawing landmarks', {
            canvasSize: `${ctx.canvas.width}x${ctx.canvas.height}`,
            hasRegions: !!landmarks.regions,
            regionCount: landmarks.regions ? Object.keys(landmarks.regions).length : 0,
            regionNames: landmarks.regions ? Object.keys(landmarks.regions) : [],
            hasKeyPoints: !!landmarks.keyPoints
        });
        
        const {canvas} = ctx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw all facial regions with different colors
        if (landmarks.regions) {
            // Face outline - green
            drawLandmarkRegion(ctx, landmarks.regions.faceOutline, '#4CAF50', 2, true);
            
            // Eyes - blue
            drawLandmarkRegion(ctx, landmarks.regions.leftEye, '#2196F3', 1.5, true);
            drawLandmarkRegion(ctx, landmarks.regions.rightEye, '#2196F3', 1.5, true);
            
            // Eyebrows - cyan
            drawLandmarkRegion(ctx, landmarks.regions.leftEyebrow, '#00BCD4', 1.5, true);
            drawLandmarkRegion(ctx, landmarks.regions.rightEyebrow, '#00BCD4', 1.5, true);
            
            // Nose - orange
            drawLandmarkRegion(ctx, landmarks.regions.nose, '#FF9800', 1, false);
            
            // Mouth - red
            drawLandmarkRegion(ctx, landmarks.regions.mouth, '#F44336', 2, true);
            
            // Cheeks - purple
            drawLandmarkRegion(ctx, landmarks.regions.leftCheek, '#9C27B0', 1, false);
            drawLandmarkRegion(ctx, landmarks.regions.rightCheek, '#9C27B0', 1, false);
            
            // Jaw - yellow
            drawLandmarkRegion(ctx, landmarks.regions.jaw, '#FFEB3B', 1.5, true);
        }
        
        // Draw key points
        if (landmarks.keyPoints) {
            drawKeyPoint(ctx, landmarks.keyPoints.leftEye, '#2196F3', 4);
            drawKeyPoint(ctx, landmarks.keyPoints.rightEye, '#2196F3', 4);
            drawKeyPoint(ctx, landmarks.keyPoints.noseTip, '#FF9800', 4);
            drawKeyPoint(ctx, landmarks.keyPoints.mouthCenter, '#F44336', 4);
        }
    };

    const drawLandmarkRegion = (ctx, points, color, lineWidth, connect) => {
        if (!points || points.length === 0) return;
        
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color  }20`; // Add transparency
        ctx.lineWidth = lineWidth;
        
        ctx.beginPath();
        
        // Move to first point
        const [firstPoint] = points;
        ctx.moveTo(firstPoint.x * ctx.canvas.width, firstPoint.y * ctx.canvas.height);
        
        // Draw lines to subsequent points
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            ctx.lineTo(point.x * ctx.canvas.width, point.y * ctx.canvas.height);
        }
        
        if (connect) {
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.stroke();
        
        // Draw individual points
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(
                point.x * ctx.canvas.width, 
                point.y * ctx.canvas.height, 
                1, 0, 2 * Math.PI
            );
            ctx.fillStyle = color;
            ctx.fill();
        });
    };

    const drawKeyPoint = (ctx, point, color, size) => {
        if (!point) return;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
            point.x * ctx.canvas.width,
            point.y * ctx.canvas.height,
            size, 0, 2 * Math.PI
        );
        ctx.fill();
        
        // Add white border for visibility
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
    };

    const setupOverlayCanvas = (videoElement, canvasElement) => {
        if (!videoElement || !canvasElement) return null;

        const setupCanvas = () => {
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                
                const ctx = canvasElement.getContext('2d');
                return ctx;
            }
            return null;
        };

        // Try immediate setup
        let ctx = setupCanvas();
        
        // If not ready, wait for video metadata
        if (!ctx) {
            return new Promise((resolve) => {
                const onReady = () => {
                    ctx = setupCanvas();
                    if (ctx) {
                        resolve(ctx);
                    } else {
                        setTimeout(onReady, 100);
                    }
                };
                
                videoElement.addEventListener('loadedmetadata', onReady);
                videoElement.addEventListener('canplay', onReady);
                onReady(); // Try once more
            });
        }
        
        return Promise.resolve(ctx);
    };

    const clearCanvas = (ctx) => {
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    };

    return {
        drawLandmarks,
        setupOverlayCanvas,
        clearCanvas,
        drawKeyPoint,
        drawLandmarkRegion
    };
};