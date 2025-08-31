/**
 * SimConnect Transport Layer
 * Handles TCP and Named Pipes communication with MSFS
 */

import { connect as netConnect, type Socket } from 'net';
import type { SimConnectHeader } from './simconnect-protocol';
import { createMessageParser } from './simconnect-protocol';

export interface TransportConfig {
  endpoint: string;
  port?: number;
  useNamedPipes?: boolean;
  timeout?: number;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface TransportStatus {
  connected: boolean;
  transport: 'tcp' | 'namedpipe';
  endpoint: string;
  port?: number;
  lastData: number;
  errors: number;
  reconnectAttempts: number;
}

// Transport interface for abstraction
export interface SimConnectTransport {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<boolean>;
  onMessage(callback: (data: Uint8Array) => void): void;
  getStatus(): TransportStatus;
  isConnected(): boolean;
}

// TCP Transport implementation
const createTCPTransport = (config: Required<TransportConfig>): SimConnectTransport => {
  let socket: Socket | null = null;
  let isConnected = false;
  let messageCallback: ((data: Uint8Array) => void) | null = null;
  let status: TransportStatus = {
    connected: false,
    transport: 'tcp',
    endpoint: config.endpoint,
    port: config.port,
    lastData: 0,
    errors: 0,
    reconnectAttempts: 0,
  };

  // Buffer for handling partial messages
  let messageBuffer = new Uint8Array(0);
  const parser = createMessageParser();

  const processIncomingData = (data: Uint8Array) => {
    // Combine with any buffered data
    const combined = new Uint8Array(messageBuffer.length + data.length);
    combined.set(messageBuffer);
    combined.set(data, messageBuffer.length);
    
    let offset = 0;
    
    while (offset < combined.length) {
      // Need at least header size (16 bytes)
      if (combined.length - offset < 16) {
        messageBuffer = combined.slice(offset);
        return;
      }
      
      // Parse message header to get total size
      const header = parser.parseHeader(combined, offset);
      
      // Check if we have the complete message
      if (combined.length - offset < header.size) {
        messageBuffer = combined.slice(offset);
        return;
      }
      
      // Extract complete message and notify callback
      const message = combined.slice(offset, offset + header.size);
      if (messageCallback) {
        try {
          messageCallback(message);
          status.lastData = Date.now();
        } catch (error) {
          console.error('TCP transport message callback error:', error);
          status.errors++;
        }
      }
      
      offset += header.size;
    }
    
    // Clear buffer if all messages processed
    messageBuffer = new Uint8Array(0);
  };

  const connectTCP = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to MSFS via TCP: ${config.endpoint}:${config.port}`);
      
      socket = netConnect({
        host: config.endpoint,
        port: config.port,
        timeout: config.timeout,
      });

      return new Promise((resolve) => {
        const onConnect = () => {
          isConnected = true;
          status.connected = true;
          status.reconnectAttempts = 0;
          console.log(`TCP connection established to ${config.endpoint}:${config.port}`);
          
          // Set up data handler
          socket!.on('data', (data: Buffer) => {
            processIncomingData(new Uint8Array(data));
          });
          
          socket!.on('error', (error) => {
            console.error('TCP socket error:', error);
            status.errors++;
            isConnected = false;
            status.connected = false;
          });
          
          socket!.on('close', () => {
            console.log('TCP connection closed');
            isConnected = false;
            status.connected = false;
          });
          
          resolve(true);
        };

        const onError = (error: Error) => {
          console.error('TCP connection failed:', error);
          status.errors++;
          status.reconnectAttempts++;
          isConnected = false;
          status.connected = false;
          resolve(false);
        };

        const onTimeout = () => {
          console.error('TCP connection timeout');
          status.errors++;
          status.reconnectAttempts++;
          isConnected = false;
          status.connected = false;
          resolve(false);
        };

        socket!.once('connect', onConnect);
        socket!.once('error', onError);
        socket!.once('timeout', onTimeout);
      });
    } catch (error) {
      console.error('TCP transport connection error:', error);
      status.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (socket) {
      socket.destroy();
      socket = null;
    }
    isConnected = false;
    status.connected = false;
    messageBuffer = new Uint8Array(0);
    console.log('TCP transport disconnected');
  };

  const send = async (data: Uint8Array): Promise<boolean> => {
    if (!socket || !isConnected) {
      return false;
    }
    
    try {
      return new Promise((resolve) => {
        socket!.write(Buffer.from(data), (error) => {
          if (error) {
            console.error('TCP send error:', error);
            status.errors++;
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('TCP transport send error:', error);
      status.errors++;
      return false;
    }
  };

  const onMessage = (callback: (data: Uint8Array) => void) => {
    messageCallback = callback;
  };

  const getStatus = (): TransportStatus => ({ ...status });

  const isConnectedStatus = (): boolean => isConnected;

  return {
    connect: connectTCP,
    disconnect,
    send,
    onMessage,
    getStatus,
    isConnected: isConnectedStatus,
  };
};

// Named Pipes transport implementation (Windows-specific)
const createNamedPipeTransport = (config: Required<TransportConfig>): SimConnectTransport => {
  let socket: Socket | null = null;
  let isConnected = false;
  let messageCallback: ((data: Uint8Array) => void) | null = null;
  let status: TransportStatus = {
    connected: false,
    transport: 'namedpipe',
    endpoint: config.endpoint,
    lastData: 0,
    errors: 0,
    reconnectAttempts: 0,
  };

  let messageBuffer = new Uint8Array(0);
  const parser = createMessageParser();

  const processIncomingData = (data: Uint8Array) => {
    const combined = new Uint8Array(messageBuffer.length + data.length);
    combined.set(messageBuffer);
    combined.set(data, messageBuffer.length);
    
    let offset = 0;
    
    while (offset < combined.length) {
      if (combined.length - offset < 16) {
        messageBuffer = combined.slice(offset);
        return;
      }
      
      const header = parser.parseHeader(combined, offset);
      
      if (combined.length - offset < header.size) {
        messageBuffer = combined.slice(offset);
        return;
      }
      
      const message = combined.slice(offset, offset + header.size);
      if (messageCallback) {
        try {
          messageCallback(message);
          status.lastData = Date.now();
        } catch (error) {
          console.error('Named pipe message callback error:', error);
          status.errors++;
        }
      }
      
      offset += header.size;
    }
    
    messageBuffer = new Uint8Array(0);
  };

  const connectNamedPipe = async (): Promise<boolean> => {
    try {
      // Named pipe path for SimConnect (Windows format)
      const pipePath = `\\\\.\\pipe\\${config.endpoint}`;
      console.log(`Connecting to MSFS via Named Pipe: ${pipePath}`);
      
      socket = netConnect(pipePath);

      return new Promise((resolve) => {
        const onConnect = () => {
          isConnected = true;
          status.connected = true;
          status.reconnectAttempts = 0;
          console.log(`Named pipe connection established: ${pipePath}`);
          
          socket!.on('data', (data: Buffer) => {
            processIncomingData(new Uint8Array(data));
          });
          
          socket!.on('error', (error) => {
            console.error('Named pipe error:', error);
            status.errors++;
            isConnected = false;
            status.connected = false;
          });
          
          socket!.on('close', () => {
            console.log('Named pipe connection closed');
            isConnected = false;
            status.connected = false;
          });
          
          resolve(true);
        };

        const onError = (error: Error) => {
          console.error('Named pipe connection failed:', error);
          status.errors++;
          status.reconnectAttempts++;
          isConnected = false;
          status.connected = false;
          resolve(false);
        };

        socket!.once('connect', onConnect);
        socket!.once('error', onError);
      });
    } catch (error) {
      console.error('Named pipe transport connection error:', error);
      status.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (socket) {
      socket.destroy();
      socket = null;
    }
    isConnected = false;
    status.connected = false;
    messageBuffer = new Uint8Array(0);
    console.log('Named pipe transport disconnected');
  };

  const send = async (data: Uint8Array): Promise<boolean> => {
    if (!socket || !isConnected) {
      return false;
    }
    
    try {
      return new Promise((resolve) => {
        socket!.write(Buffer.from(data), (error) => {
          if (error) {
            console.error('Named pipe send error:', error);
            status.errors++;
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Named pipe transport send error:', error);
      status.errors++;
      return false;
    }
  };

  const onMessage = (callback: (data: Uint8Array) => void) => {
    messageCallback = callback;
  };

  const getStatus = (): TransportStatus => ({ ...status });

  const isConnectedStatus = (): boolean => isConnected;

  return {
    connect: connectTCP,
    disconnect,
    send,
    onMessage,
    getStatus,
    isConnected: isConnectedStatus,
  };
};

// Transport factory function
export const createSimConnectTransport = (config: TransportConfig): SimConnectTransport => {
  const settings: Required<TransportConfig> = {
    endpoint: 'localhost',
    port: 500,
    useNamedPipes: false,
    timeout: 5000,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
    ...config,
  };

  // Choose transport based on platform and configuration
  if (settings.useNamedPipes && process.platform === 'win32') {
    return createNamedPipeTransport(settings);
  } else {
    return createTCPTransport(settings);
  }
};

// Connection helper with auto-discovery
export const createConnectionHelper = (remoteHosts: string[] = []) => {
  const tryConnections = async (configs: TransportConfig[]): Promise<SimConnectTransport | null> => {
    for (const config of configs) {
      const transport = createSimConnectTransport(config);
      
      try {
        const connected = await transport.connect();
        if (connected) {
          console.log(`Successfully connected via ${transport.getStatus().transport} to ${config.endpoint}:${config.port}`);
          return transport;
        }
        await transport.disconnect();
      } catch (error) {
        console.warn(`Connection attempt failed for ${config.endpoint}:`, error);
        await transport.disconnect();
      }
    }
    
    return null;
  };

  const discoverConnection = async (): Promise<SimConnectTransport | null> => {
    const connectionConfigs: TransportConfig[] = [
      // Try named pipes first on Windows (local only)
      ...(process.platform === 'win32' ? [
        { endpoint: 'Microsoft Flight Simulator\\SimConnect', useNamedPipes: true },
        { endpoint: 'SimConnect', useNamedPipes: true },
      ] : []),
      
      // Local TCP connections
      { endpoint: 'localhost', port: 500 },
      { endpoint: '127.0.0.1', port: 500 },
      { endpoint: 'localhost', port: 1024 },
      { endpoint: '127.0.0.1', port: 1024 },
      
      // Remote TCP connections (if specified)
      ...remoteHosts.flatMap(host => [
        { endpoint: host, port: 500, useNamedPipes: false },
        { endpoint: host, port: 1024, useNamedPipes: false },
      ]),
    ];

    console.log(`Attempting auto-discovery of SimConnect connection (${remoteHosts.length > 0 ? 'including remote hosts' : 'local only'})...`);
    const transport = await tryConnections(connectionConfigs);
    
    if (transport) {
      console.log('SimConnect connection established via auto-discovery');
      return transport;
    } else {
      console.error('SimConnect auto-discovery failed - no working connection found');
      return null;
    }
  };

  return { tryConnections, discoverConnection };
};