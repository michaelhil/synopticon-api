/**
 * WebRTC Client Module
 * Handles peer-to-peer connections, signaling, and data channels
 */

/* global RTCPeerConnection */

export const createWebRTCClient = (config = {}) => {
    const {
        stunServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        onRemoteStream = () => {},
        onDataChannelMessage = () => {},
        onConnectionStateChange = () => {},
        logger = console
    } = config;

    let peerConnection = null;
    let dataChannel = null;
    let ws = null;
    let sessionId = null;
    let isStreamer = false;
    let connectionHealthTimer = null;

    const rtcConfig = {
        iceServers: stunServers,
        iceCandidatePoolSize: 10
    };

    const connectWebSocket = (wsUrl) => {
        return new Promise((resolve, reject) => {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
                ws = null;
            }

            logger.log('Connecting to signaling server...');
            ws = new WebSocket(wsUrl);
            
            let resolved = false;
            
            ws.onopen = () => {
                sessionId = `ws_${  Date.now()  }_${  Math.random().toString(36).substr(2, 16)}`;
                logger.log(`WebSocket connected (${sessionId})`);
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };
            
            ws.onmessage = handleSignalingMessage;
            
            ws.onerror = (error) => {
                logger.error('WebSocket error:', error);
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            };
            
            ws.onclose = (event) => {
                logger.log(`WebSocket closed (${event.code}: ${event.reason})`);
            };
            
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    };

    const setupPeerConnection = (localStream = null) => {
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        // Set up data channel for MediaPipe analysis
        if (isStreamer) {
            dataChannel = peerConnection.createDataChannel('mediapipe', {
                ordered: false,
                maxRetransmits: 0
            });
            
            dataChannel.onopen = () => {
                logger.log('MediaPipe data channel opened');
            };
            
            dataChannel.onclose = () => {
                logger.log('MediaPipe data channel closed');
            };
            
            dataChannel.onerror = (error) => {
                logger.error('Data channel error:', error);
            };
        } else {
            peerConnection.ondatachannel = (event) => {
                const {channel} = event;
                logger.log(`Received data channel: ${channel.label}`);
                
                channel.onmessage = (event) => {
                    onDataChannelMessage(event.data);
                };
            };
        }
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignaling({
                    type: 'webrtc_ice',
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.ontrack = (event) => {
            logger.log('Received remote stream');
            onRemoteStream(event.streams[0]);
        };
        
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            logger.log(`WebRTC connection state: ${state}`);
            onConnectionStateChange(state);
            
            if (state === 'failed' || state === 'disconnected') {
                logger.log('WebRTC connection failed/disconnected');
            } else if (state === 'connected') {
                logger.log('WebRTC connection established successfully');
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            logger.log(`ICE connection state: ${state}`);
        };

        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
    };

    const createOffer = async () => {
        if (!peerConnection) return;
        
        try {
            logger.log('Creating WebRTC offer...');
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            sendSignaling({
                type: 'webrtc_offer',
                sdp: offer
            });
        } catch (error) {
            logger.error('Error creating offer:', error);
        }
    };

    const handleSignalingMessage = async (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'webrtc_offer':
                if (!isStreamer && peerConnection) {
                    logger.log('Received offer, creating answer...');
                    await peerConnection.setRemoteDescription(message.sdp);
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    sendSignaling({
                        type: 'webrtc_answer',
                        sdp: answer,
                        targetSession: message.sourceSession
                    });
                }
                break;
                
            case 'webrtc_answer':
                if (isStreamer && peerConnection) {
                    logger.log('Received answer, connection establishing...');
                    await peerConnection.setRemoteDescription(message.sdp);
                }
                break;
                
            case 'webrtc_ice':
                if (peerConnection) {
                    logger.log('Adding ICE candidate');
                    await peerConnection.addIceCandidate(message.candidate);
                }
                break;
                
            case 'request_offer':
                if (isStreamer && peerConnection) {
                    if (peerConnection) peerConnection.close();
                    setupPeerConnection();
                    setTimeout(() => createOffer(), 200);
                }
                break;
        }
    };

    const sendSignaling = (message) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                ...message,
                sourceSession: sessionId
            }));
        }
    };

    const sendAnalysisData = (analysisData) => {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(analysisData));
        }
    };

    const startConnectionHealthMonitoring = () => {
        connectionHealthTimer = setInterval(() => {
            if (peerConnection) {
                const state = peerConnection.connectionState;
                if (state === 'failed' || state === 'disconnected') {
                    logger.log('Connection health check failed');
                    onConnectionStateChange(state);
                }
            }
        }, 5000);
    };

    const stopConnectionHealthMonitoring = () => {
        if (connectionHealthTimer) {
            clearInterval(connectionHealthTimer);
            connectionHealthTimer = null;
        }
    };

    const requestOffer = () => {
        sendSignaling({ type: 'request_offer' });
    };

    const cleanup = () => {
        stopConnectionHealthMonitoring();
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (ws) {
            ws.close();
            ws = null;
        }
    };

    return {
        connectWebSocket,
        setupPeerConnection,
        createOffer,
        sendAnalysisData,
        requestOffer,
        startConnectionHealthMonitoring,
        stopConnectionHealthMonitoring,
        cleanup,
        setStreamerMode: (mode) => { isStreamer = mode; },
        getConnectionState: () => peerConnection?.connectionState || 'new',
        isConnected: () => peerConnection?.connectionState === 'connected'
    };
};