/**
 * WebRTC Client Module - Factory-based WebRTC implementation
 * Follows two-phase signaling: Discovery (broadcast) + Direct signaling (targeted)
 */

interface WebRTCMessage {
  type: 'webrtc_seek_broadcaster' | 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice';
  deviceId: string;
  timestamp: number;
  targetSession?: string;
  sourceSession?: string;
  sdp?: RTCSessionDescription;
  candidate?: RTCIceCandidate;
}

interface WebRTCConfig {
  wsUrl: string;
  role: 'broadcaster' | 'receiver';
  onConnection?: (connection: RTCPeerConnection) => void;
  onDisconnection?: () => void;
  onError?: (error: Error) => void;
  onLog?: (message: string, level?: 'info' | 'error' | 'success') => void;
}

interface WebRTCClient {
  connect: () => Promise<void>;
  disconnect: () => void;
  startBroadcasting: (stream: MediaStream) => Promise<void>;
  seekBroadcaster: () => void;
  getConnectionState: () => RTCPeerConnectionState | null;
  cleanup: () => void;
}

export const createWebRTCClient = (config: WebRTCConfig): WebRTCClient => {
  let ws: WebSocket | null = null;
  let sessionId: string | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  const connectedPeers = new Set<string>();
  
  const log = (message: string, level: 'info' | 'error' | 'success' = 'info') => {
    config.onLog?.(message, level);
  };

  const createPeerConnection = (): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && sessionId) {
        connectedPeers.forEach(peerId => {
          sendSignalMessage({
            type: 'webrtc_ice',
            deviceId: sessionId!,
            targetSession: peerId,
            timestamp: Date.now(),
            candidate: event.candidate!
          });
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      log(`WebRTC connection state: ${state}`);
      
      if (state === 'connected') {
        config.onConnection?.(pc);
      } else if (state === 'failed' || state === 'disconnected') {
        config.onDisconnection?.();
      }
    };

    return pc;
  };

  const sendSignalMessage = (message: WebRTCMessage) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log('WebSocket not connected', 'error');
      return;
    }
    
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      log(`Failed to send signaling message: ${error}`, 'error');
    }
  };

  return {
    connect: async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          ws = new WebSocket(config.wsUrl);
          
          ws.onopen = () => {
            sessionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            log(`Connected to WebSocket server (${sessionId})`, 'success');
            resolve();
          };

          ws.onerror = (error) => {
            const err = new Error('WebSocket connection failed');
            config.onError?.(err);
            reject(err);
          };

          ws.onmessage = (event) => {
            try {
              const message: WebRTCMessage = JSON.parse(event.data);
              handleSignalMessage(message);
            } catch (error) {
              log(`Failed to parse WebSocket message: ${error}`, 'error');
            }
          };

        } catch (error) {
          reject(error as Error);
        }
      });
    },

    disconnect: () => {
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      if (ws) {
        ws.close();
        ws = null;
      }
      
      connectedPeers.clear();
      sessionId = null;
    },

    startBroadcasting: async (stream: MediaStream): Promise<void> => {
      if (!peerConnection) {
        peerConnection = createPeerConnection();
      }
      
      stream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, stream);
      });
      
      log('Started broadcasting - waiting for receivers', 'success');
    },

    seekBroadcaster: () => {
      if (!sessionId) {
        log('Not connected to WebSocket server', 'error');
        return;
      }
      
      sendSignalMessage({
        type: 'webrtc_seek_broadcaster',
        deviceId: sessionId,
        timestamp: Date.now()
      });
      
      log('Seeking broadcasters...');
    },

    getConnectionState: (): RTCPeerConnectionState | null => {
      return peerConnection?.connectionState || null;
    },

    cleanup: () => {
      if (peerConnection) {
        peerConnection.close();
      }
      if (ws) {
        ws.close();
      }
    }
  };

  // Handle incoming signaling messages
  function handleSignalMessage(message: WebRTCMessage) {
    if (!sessionId || !message.sourceSession) return;

    switch (message.type) {
    case 'webrtc_seek_broadcaster':
      handleSeekBroadcaster(message);
      break;
    case 'webrtc_offer':
      handleOffer(message);
      break;
    case 'webrtc_answer':
      handleAnswer(message);
      break;
    case 'webrtc_ice':
      handleIceCandidate(message);
      break;
    }
  }

  async function handleSeekBroadcaster(message: WebRTCMessage) {
    if (config.role !== 'broadcaster' || !peerConnection || !sessionId) return;
    
    const peerId = message.sourceSession!;
    log(`Receiver ${peerId} is seeking broadcaster`);
    
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      connectedPeers.add(peerId);
      
      sendSignalMessage({
        type: 'webrtc_offer',
        deviceId: sessionId,
        targetSession: peerId,
        timestamp: Date.now(),
        sdp: offer
      });
      
      log(`Sent offer to receiver ${peerId}`);
    } catch (error) {
      log(`Failed to create offer: ${error}`, 'error');
    }
  }

  async function handleOffer(message: WebRTCMessage) {
    if (config.role !== 'receiver' || !message.sdp || !sessionId) return;
    
    if (!peerConnection) {
      peerConnection = createPeerConnection();
    }
    
    const peerId = message.sourceSession!;
    log(`Received offer from broadcaster ${peerId}`);
    
    try {
      await peerConnection.setRemoteDescription(message.sdp);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      connectedPeers.add(peerId);
      
      sendSignalMessage({
        type: 'webrtc_answer',
        deviceId: sessionId,
        targetSession: peerId,
        timestamp: Date.now(),
        sdp: answer
      });
      
      log(`Sent answer to broadcaster ${peerId}`);
    } catch (error) {
      log(`Failed to handle offer: ${error}`, 'error');
    }
  }

  async function handleAnswer(message: WebRTCMessage) {
    if (config.role !== 'broadcaster' || !message.sdp || !peerConnection) return;
    
    const peerId = message.sourceSession!;
    log(`Received answer from receiver ${peerId}`);
    
    try {
      await peerConnection.setRemoteDescription(message.sdp);
      log(`WebRTC connection established with ${peerId}`, 'success');
    } catch (error) {
      log(`Failed to handle answer: ${error}`, 'error');
    }
  }

  async function handleIceCandidate(message: WebRTCMessage) {
    if (!message.candidate || !peerConnection) return;
    
    try {
      await peerConnection.addIceCandidate(message.candidate);
    } catch (error) {
      log(`Failed to add ICE candidate: ${error}`, 'error');
    }
  }
};
