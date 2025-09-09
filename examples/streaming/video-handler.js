/**
 * Video Handler Module - Camera and Stream Management
 */

export const createVideoHandler = () => {
    let currentStream = null;
    
    const startCamera = async () => {
        try {
            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            currentStream = stream;
            console.log('Camera stream acquired');
            return stream;
            
        } catch (_error) {
            console.error('Camera access failed:', _error);
            throw new Error(`Camera access denied: ${_error.message}`);
        }
    };
    
    const stopCamera = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            console.log('Camera stream stopped');
        }
    };
    
    const getStream = () => currentStream;
    
    return {
        startCamera,
        stopCamera,
        getStream
    };
};