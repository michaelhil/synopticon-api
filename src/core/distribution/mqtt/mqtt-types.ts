/**
 * MQTT Type Definitions
 * TypeScript interfaces for built-in MQTT implementation
 */

export type MqttQoS = 0 | 1 | 2;

export interface MqttClientOptions {
  host?: string;
  port?: number;
  clientId?: string;
  keepAlive?: number;
  reconnectInterval?: number;
  username?: string;
  password?: string;
  cleanSession?: boolean;
  maxReconnectAttempts?: number;
}

export interface MqttClientState {
  connected: boolean;
  connecting: boolean;
  messageId: number;
  lastActivity: number;
  reconnectAttempts: number;
}

export interface MqttMessage {
  topic: string;
  payload: Uint8Array;
  qos: MqttQoS;
  retain: boolean;
}

export interface MqttSubscription {
  id: string;
  topics: string[];
  handler: (message: MqttMessage) => void;
  qos: MqttQoS;
  unsubscribe: () => Promise<void>;
}

export interface MqttConnectOptions {
  clientId: string;
  username?: string;
  password?: string;
  keepAlive: number;
  cleanSession: boolean;
}

export interface MqttPublishOptions {
  topic: string;
  payload: Uint8Array;
  qos: MqttQoS;
  retain: boolean;
  messageId: number;
}

export interface MqttSubscribeOptions {
  topics: Array<{ topic: string; qos: MqttQoS }>;
  messageId: number;
}

export interface MqttUnsubscribeOptions {
  topics: string[];
  messageId: number;
}

export interface MqttPacket {
  type: string;
  flags?: number;
  messageId?: number;
  data?: Uint8Array;
}

export interface MqttConnAckPacket extends MqttPacket {
  type: 'CONNACK';
  returnCode: number;
  sessionPresent: boolean;
}

export interface MqttPublishPacket extends MqttPacket {
  type: 'PUBLISH';
  topic: string;
  payload: Uint8Array;
  qos: MqttQoS;
  retain: boolean;
  dup: boolean;
}

export interface MqttPubAckPacket extends MqttPacket {
  type: 'PUBACK';
  messageId: number;
}

export interface MqttSubAckPacket extends MqttPacket {
  type: 'SUBACK';
  messageId: number;
  qos: MqttQoS[];
}

export interface MqttConnectionConfig {
  host: string;
  port: number;
  timeout?: number;
}

export interface MqttConnectionEvents {
  connect: () => void;
  data: (data: Uint8Array) => void;
  error: (error: Error) => void;
  close: () => void;
}
