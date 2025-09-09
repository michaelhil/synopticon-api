/**
 * MQTT Connection Handler
 * Manages TCP connection to MQTT broker using Bun's native TCP
 */

import type { MqttConnectionConfig, MqttConnectionEvents } from './mqtt-types.js';

/**
 * Creates MQTT TCP connection
 */
export const createMqttConnection = (config: MqttConnectionConfig) => {
  let socket: import('bun').TCPSocket | null = null;
  const eventHandlers: Partial<MqttConnectionEvents> = {};

  /**
   * Connect to MQTT broker
   */
  const connect = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        socket = Bun.connect({
          hostname: config.host,
          port: config.port,
          socket: {
            open() {
              eventHandlers.connect?.();
              resolve();
            },
            
            data(socket, data) {
              const uint8Data = new Uint8Array(data);
              eventHandlers.data?.(uint8Data);
            },
            
            error(socket, error) {
              eventHandlers.error?.(error);
              reject(error);
            },
            
            close() {
              eventHandlers.close?.();
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Send data to broker
   */
  const send = async (data: Uint8Array): Promise<void> => {
    if (!socket) {
      throw new Error('Not connected');
    }
    
    return new Promise((resolve, reject) => {
      try {
        socket.write(data);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Register event handler
   */
  const on = <K extends keyof MqttConnectionEvents>(
    event: K,
    handler: MqttConnectionEvents[K]
  ): void => {
    eventHandlers[event] = handler;
  };

  /**
   * Register data handler
   */
  const onData = (handler: (data: Uint8Array) => void): void => {
    eventHandlers.data = handler;
  };

  /**
   * Close connection
   */
  const close = (): void => {
    if (socket) {
      socket.end();
      socket = null;
    }
  };

  /**
   * Check if connected
   */
  const isConnected = (): boolean => {
    return socket !== null && socket.readyState === 1;
  };

  return {
    connect,
    send,
    on,
    onData,
    close,
    isConnected
  };
};
