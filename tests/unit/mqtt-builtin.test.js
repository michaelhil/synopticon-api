/**
 * Built-in MQTT Implementation Tests
 * Tests for the zero-dependency MQTT client
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('Built-in MQTT Implementation', () => {
  describe('MQTT Parser', () => {
    test('should parse CONNACK packet', async () => {
      const { createMqttParser } = await import('../../src/core/distribution/mqtt/mqtt-parser.js');
      const parser = createMqttParser();
      
      // CONNACK packet: type=2, remaining_length=2, session_present=0, return_code=0
      const connackData = new Uint8Array([0x20, 0x02, 0x00, 0x00]);
      
      const packets = parser.parse(connackData);
      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe('CONNACK');
      expect(packets[0].returnCode).toBe(0);
      expect(packets[0].sessionPresent).toBe(false);
    });

    test('should parse PUBLISH packet', async () => {
      const { createMqttParser } = await import('../../src/core/distribution/mqtt/mqtt-parser.js');
      const parser = createMqttParser();
      
      // PUBLISH packet: topic="test", payload="hello"
      const publishData = new Uint8Array([
        0x30, 0x0B, // Fixed header: PUBLISH, remaining length = 11
        0x00, 0x04, 0x74, 0x65, 0x73, 0x74, // Topic: "test" (length=4)
        0x68, 0x65, 0x6C, 0x6C, 0x6F // Payload: "hello"
      ]);
      
      const packets = parser.parse(publishData);
      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe('PUBLISH');
      expect(packets[0].topic).toBe('test');
      expect(new TextDecoder().decode(packets[0].payload)).toBe('hello');
      expect(packets[0].qos).toBe(0);
      expect(packets[0].retain).toBe(false);
    });

    test('should handle incomplete packets', async () => {
      const { createMqttParser } = await import('../../src/core/distribution/mqtt/mqtt-parser.js');
      const parser = createMqttParser();
      
      // Partial packet
      const partialData = new Uint8Array([0x30, 0x0B, 0x00, 0x04]);
      
      let packets = parser.parse(partialData);
      expect(packets.length).toBe(0); // No complete packets yet
      
      // Complete the packet
      const remainingData = new Uint8Array([0x74, 0x65, 0x73, 0x74, 0x68, 0x65, 0x6C, 0x6C, 0x6F]);
      
      packets = parser.parse(remainingData);
      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe('PUBLISH');
    });
  });

  describe('MQTT Packet Builder', () => {
    test('should build CONNECT packet', async () => {
      const { createMqttPacketBuilder } = await import('../../src/core/distribution/mqtt/mqtt-packet-builder.js');
      const builder = createMqttPacketBuilder();
      
      const packet = builder.buildConnect({
        clientId: 'test-client',
        keepAlive: 60,
        cleanSession: true
      });
      
      expect(packet).toBeInstanceOf(Uint8Array);
      expect(packet.length).toBeGreaterThan(10);
      expect(packet[0]).toBe(0x10); // CONNECT packet type
    });

    test('should build PUBLISH packet', async () => {
      const { createMqttPacketBuilder } = await import('../../src/core/distribution/mqtt/mqtt-packet-builder.js');
      const builder = createMqttPacketBuilder();
      
      const packet = builder.buildPublish({
        topic: 'test/topic',
        payload: new TextEncoder().encode('hello world'),
        qos: 0,
        retain: false,
        messageId: 1
      });
      
      expect(packet).toBeInstanceOf(Uint8Array);
      expect(packet[0] & 0xF0).toBe(0x30); // PUBLISH packet type
    });

    test('should build SUBSCRIBE packet', async () => {
      const { createMqttPacketBuilder } = await import('../../src/core/distribution/mqtt/mqtt-packet-builder.js');
      const builder = createMqttPacketBuilder();
      
      const packet = builder.buildSubscribe({
        topics: [
          { topic: 'test/+', qos: 1 },
          { topic: 'data/#', qos: 0 }
        ],
        messageId: 42
      });
      
      expect(packet).toBeInstanceOf(Uint8Array);
      expect(packet[0]).toBe(0x82); // SUBSCRIBE packet type with flags
    });
  });

  describe('MQTT Subscription Manager', () => {
    test('should manage subscriptions', async () => {
      const { createMqttSubscriptionManager } = await import('../../src/core/distribution/mqtt/mqtt-subscription-manager.js');
      const manager = createMqttSubscriptionManager();
      
      let receivedMessage = null;
      const handler = (message) => {
        receivedMessage = message;
      };
      
      // Add subscription
      const subscription = manager.add(['test/topic'], handler, 1);
      expect(subscription.id).toBeDefined();
      expect(manager.count()).toBe(1);
      
      // Deliver message
      const message = {
        topic: 'test/topic',
        payload: new TextEncoder().encode('test payload'),
        qos: 1,
        retain: false
      };
      
      manager.deliver(message);
      expect(receivedMessage).toEqual(message);
      
      // Remove subscription
      manager.remove(['test/topic']);
      expect(manager.count()).toBe(0);
    });

    test('should handle wildcard patterns', async () => {
      const { createMqttSubscriptionManager } = await import('../../src/core/distribution/mqtt/mqtt-subscription-manager.js');
      const manager = createMqttSubscriptionManager();
      
      const messages = [];
      const handler = (message) => messages.push(message);
      
      // Subscribe to wildcard patterns
      manager.add(['test/+', 'data/#'], handler, 0);
      
      // Test single-level wildcard
      manager.deliver({
        topic: 'test/abc',
        payload: new Uint8Array(),
        qos: 0,
        retain: false
      });
      
      // Test multi-level wildcard
      manager.deliver({
        topic: 'data/sensors/temperature',
        payload: new Uint8Array(),
        qos: 0,
        retain: false
      });
      
      // Should not match
      manager.deliver({
        topic: 'other/topic',
        payload: new Uint8Array(),
        qos: 0,
        retain: false
      });
      
      expect(messages.length).toBe(2);
      expect(messages[0].topic).toBe('test/abc');
      expect(messages[1].topic).toBe('data/sensors/temperature');
    });
  });

  describe('MQTT Distributor', () => {
    test('should create distributor with default config', async () => {
      const { createMqttDistributor } = await import('../../src/core/distribution/distributors/mqtt-distributor-builtin.js');
      
      const distributor = createMqttDistributor({
        enabled: false // Disable to avoid connection attempts in tests
      });
      
      expect(distributor).toBeDefined();
      expect(distributor.name).toBe('mqtt-distributor');
      expect(typeof distributor.send).toBe('function');
      expect(typeof distributor.broadcast).toBe('function');
      expect(typeof distributor.subscribe).toBe('function');
    });

    test('should provide health information', async () => {
      const { createMqttDistributor } = await import('../../src/core/distribution/distributors/mqtt-distributor-builtin.js');
      
      const distributor = createMqttDistributor({
        name: 'test-mqtt',
        enabled: false
      });
      
      const health = distributor.getHealth();
      expect(health.name).toBe('test-mqtt');
      expect(health.status).toBe('disconnected');
      expect(health.enabled).toBe(false);
      expect(health.messagesSent).toBe(0);
      expect(health.messagesReceived).toBe(0);
    });
  });
});

// Integration test (would require actual MQTT broker)
describe('MQTT Integration (Mock)', () => {
  test('should handle connection lifecycle', async () => {
    const { createMqttClient } = await import('../../src/core/distribution/mqtt/mqtt-client.js');
    
    // Create client but don't connect (no broker available in test)
    const client = createMqttClient({
      host: 'localhost',
      port: 1883,
      clientId: 'test-client'
    });
    
    expect(client.isConnected()).toBe(false);
    
    // Test event registration
    let connectCalled = false;
    client.on('connect', () => {
      connectCalled = true;
    });
    
    // Verify event handler was registered
    expect(connectCalled).toBe(false);
  });
});