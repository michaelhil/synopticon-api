/**
 * Overlay Renderer Module - Canvas Face Mesh Visualization
 */

export const createOverlayRenderer = (canvasElement) => {
    let ctx = null;
    let videoElement = null;
    
    const setupCanvas = (video) => {
        videoElement = video;
        
        console.log('Setting up canvas:', {
            video,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            canvasElement
        });
        
        // Set canvas dimensions to match video
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        
        // Also set CSS dimensions to match video display size
        const videoRect = video.getBoundingClientRect();
        canvasElement.style.width = `${videoRect.width  }px`;
        canvasElement.style.height = `${videoRect.height  }px`;
        
        // Get 2D context
        ctx = canvasElement.getContext('2d');
        
        console.log('Canvas setup complete:', {
            canvasWidth: canvasElement.width,
            canvasHeight: canvasElement.height,
            cssWidth: canvasElement.style.width,
            cssHeight: canvasElement.style.height,
            hasContext: !!ctx
        });
        
        // Test draw immediately
        if (ctx) {
            ctx.fillStyle = 'blue';
            ctx.fillRect(0, 0, 100, 50);
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.fillText('SETUP TEST', 5, 25);
            console.log('Canvas test draw completed');
        }
    };
    
    const clear = () => {
        if (ctx) {
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
    };
    
    const drawLandmarks = (landmarks) => {
        if (!ctx || !landmarks || landmarks.length === 0) return;
        
        const {width} = canvasElement;
        const {height} = canvasElement;
        
        // Draw face mesh points
        ctx.fillStyle = '#00FF00';
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1;
        
        // Draw all landmarks as small circles
        landmarks.forEach(landmark => {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // Draw face outline
        if (landmarks.length >= 468) {
            const faceOutline = [
                10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 
                397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 
                172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
            ];
            
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            faceOutline.forEach((index, i) => {
                if (landmarks[index]) {
                    const x = landmarks[index].x * width;
                    const y = landmarks[index].y * height;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            
            ctx.closePath();
            ctx.stroke();
        }
    };
    
    const renderFaces = (results) => {
        console.log('Renderer: renderFaces called', {
            hasResults: !!results,
            hasMultiFaceLandmarks: !!results?.multiFaceLandmarks,
            faceCount: results?.multiFaceLandmarks?.length || 0
        });
        
        // Clear previous frame
        clear();
        
        // Test - draw a red rectangle to verify canvas is working
        if (ctx) {
            ctx.fillStyle = 'red';
            ctx.fillRect(10, 10, 50, 30);
        }
        
        // Draw detected faces
        if (results.multiFaceLandmarks) {
            console.log('Drawing faces:', results.multiFaceLandmarks.length);
            results.multiFaceLandmarks.forEach((landmarks, index) => {
                console.log(`Drawing face ${index} with ${landmarks.length} landmarks`);
                drawLandmarks(landmarks);
            });
        } else {
            console.log('No faces detected');
        }
    };
    
    return {
        setupCanvas,
        clear,
        renderFaces
    };
};