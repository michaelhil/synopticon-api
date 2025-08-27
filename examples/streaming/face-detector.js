/**
 * Face Detector Module - MediaPipe Face Mesh Integration
 */

/* global FaceMesh */

export const createFaceDetector = async () => {
    let faceMesh = null;
    
    const initialize = async () => {
        try {
            console.log('Starting Face Mesh initialization...');
            
            // Check if FaceMesh is available
            if (typeof FaceMesh === 'undefined') {
                throw new Error('FaceMesh not loaded - check MediaPipe scripts');
            }
            
            // Create Face Mesh instance
            faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });
            
            console.log('FaceMesh instance created');
            
            // Set up result handler first
            let initResolver = null;
            const _initPromise = new Promise((resolve) => {
                initResolver = resolve;
            });
            
            faceMesh.onResults((_results) => {
                if (initResolver) {
                    console.log('First results received - initialization complete');
                    initResolver();
                    initResolver = null;
                }
            });
            
            // Configure Face Mesh
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            console.log('FaceMesh options set, initializing...');
            
            // Initialize and wait for first result
            await faceMesh.initialize();
            console.log('MediaPipe base initialization complete');
            
            console.log('MediaPipe Face Mesh ready');
            return true;
            
        } catch (error) {
            console.error('Face detector initialization failed:', error);
            throw error;
        }
    };
    
    const detectFaces = async (videoElement) => {
        if (!faceMesh) {
            throw new Error('Face detector not initialized');
        }
        
        return new Promise((resolve) => {
            faceMesh.onResults((results) => {
                resolve(results);
            });
            
            faceMesh.send({ image: videoElement });
        });
    };
    
    // Initialize immediately
    await initialize();
    
    return {
        detectFaces
    };
};