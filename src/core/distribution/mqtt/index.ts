/**
 * Built-in MQTT Implementation
 * Zero-dependency MQTT client and utilities for Synopticon API
 */

export { createMqttClient } from './mqtt-client.js';
export { createMqttConnection } from './mqtt-connection.js';
export { createMqttParser } from './mqtt-parser.js';
export { createMqttPacketBuilder } from './mqtt-packet-builder.js';
export { createMqttSubscriptionManager } from './mqtt-subscription-manager.js';

export type {
  MqttClient,
  MqttClientOptions,
  MqttClientState,
  MqttMessage,
  MqttSubscription,
  MqttQoS,
  MqttConnectOptions,
  MqttPublishOptions,
  MqttSubscribeOptions,
  MqttUnsubscribeOptions,
  MqttPacket,
  MqttConnAckPacket,
  MqttPublishPacket,
  MqttPubAckPacket,
  MqttSubAckPacket,
  MqttConnectionConfig,
  MqttConnectionEvents
} from './mqtt-types.js';
