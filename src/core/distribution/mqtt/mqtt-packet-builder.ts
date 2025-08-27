/**
 * MQTT Packet Builder
 * Creates MQTT protocol packets for sending to broker
 */

import type {
  MqttConnectOptions,
  MqttPublishOptions,
  MqttSubscribeOptions,
  MqttUnsubscribeOptions,
  MqttQoS
} from './mqtt-types.js';

/**
 * MQTT packet type constants
 */
const PACKET_TYPES = {
  CONNECT: 1,
  PUBLISH: 3,
  PUBACK: 4,
  SUBSCRIBE: 8,
  UNSUBSCRIBE: 10,
  PINGREQ: 12,
  DISCONNECT: 14
} as const;

/**
 * Creates MQTT packet builder
 */
export const createMqttPacketBuilder = () => {

  /**
   * Encode remaining length field
   */
  const encodeRemainingLength = (length: number): Uint8Array => {
    const result: number[] = [];
    
    do {
      let byte = length % 128;
      length = Math.floor(length / 128);
      
      if (length > 0) {
        byte |= 0x80;
      }
      
      result.push(byte);
    } while (length > 0);
    
    return new Uint8Array(result);
  };

  /**
   * Encode UTF-8 string with length prefix
   */
  const encodeString = (str: string): Uint8Array => {
    const stringBytes = new TextEncoder().encode(str);
    const result = new Uint8Array(2 + stringBytes.length);
    
    // Length prefix (big-endian)
    result[0] = (stringBytes.length >> 8) & 0xFF;
    result[1] = stringBytes.length & 0xFF;
    
    // String data
    result.set(stringBytes, 2);
    
    return result;
  };

  /**
   * Build CONNECT packet
   */
  const buildConnect = (options: MqttConnectOptions): Uint8Array => {
    const protocolName = encodeString('MQTT');
    const protocolLevel = 4; // MQTT 3.1.1
    
    // Calculate connect flags
    let connectFlags = 0;
    if (options.cleanSession) connectFlags |= 0x02;
    if (options.username) connectFlags |= 0x80;
    if (options.password) connectFlags |= 0x40;
    
    // Variable header
    const variableHeader = new Uint8Array(10);
    variableHeader.set(protocolName, 0);
    variableHeader[protocolName.length] = protocolLevel;
    variableHeader[protocolName.length + 1] = connectFlags;
    variableHeader[protocolName.length + 2] = (options.keepAlive >> 8) & 0xFF;
    variableHeader[protocolName.length + 3] = options.keepAlive & 0xFF;
    
    // Payload
    const clientIdBytes = encodeString(options.clientId);
    const usernameBytes = options.username ? encodeString(options.username) : new Uint8Array(0);
    const passwordBytes = options.password ? encodeString(options.password) : new Uint8Array(0);
    
    const payloadLength = clientIdBytes.length + usernameBytes.length + passwordBytes.length;
    const payload = new Uint8Array(payloadLength);
    
    let offset = 0;
    payload.set(clientIdBytes, offset);
    offset += clientIdBytes.length;
    
    if (usernameBytes.length > 0) {
      payload.set(usernameBytes, offset);
      offset += usernameBytes.length;
    }
    
    if (passwordBytes.length > 0) {
      payload.set(passwordBytes, offset);
    }
    
    // Complete packet
    const remainingLength = variableHeader.length + payload.length;
    const remainingLengthBytes = encodeRemainingLength(remainingLength);
    
    const packet = new Uint8Array(1 + remainingLengthBytes.length + remainingLength);
    
    // Fixed header
    packet[0] = (PACKET_TYPES.CONNECT << 4);
    packet.set(remainingLengthBytes, 1);
    
    // Variable header and payload
    packet.set(variableHeader, 1 + remainingLengthBytes.length);
    packet.set(payload, 1 + remainingLengthBytes.length + variableHeader.length);
    
    return packet;
  };

  /**
   * Build PUBLISH packet
   */
  const buildPublish = (options: MqttPublishOptions): Uint8Array => {
    const topicBytes = encodeString(options.topic);
    const hasMessageId = options.qos > 0;
    const messageIdBytes = hasMessageId ? 2 : 0;
    
    // Variable header
    const variableHeaderLength = topicBytes.length + messageIdBytes;
    const variableHeader = new Uint8Array(variableHeaderLength);
    
    let offset = 0;
    variableHeader.set(topicBytes, offset);
    offset += topicBytes.length;
    
    if (hasMessageId) {
      variableHeader[offset] = (options.messageId >> 8) & 0xFF;
      variableHeader[offset + 1] = options.messageId & 0xFF;
    }
    
    // Complete packet
    const remainingLength = variableHeader.length + options.payload.length;
    const remainingLengthBytes = encodeRemainingLength(remainingLength);
    
    const packet = new Uint8Array(1 + remainingLengthBytes.length + remainingLength);
    
    // Fixed header
    let flags = 0;
    flags |= (options.qos << 1);
    if (options.retain) flags |= 0x01;
    
    packet[0] = (PACKET_TYPES.PUBLISH << 4) | flags;
    packet.set(remainingLengthBytes, 1);
    
    // Variable header and payload
    packet.set(variableHeader, 1 + remainingLengthBytes.length);
    packet.set(options.payload, 1 + remainingLengthBytes.length + variableHeader.length);
    
    return packet;
  };

  /**
   * Build PUBACK packet
   */
  const buildPubAck = (messageId: number): Uint8Array => {
    const remainingLength = 2;
    const remainingLengthBytes = encodeRemainingLength(remainingLength);
    
    const packet = new Uint8Array(1 + remainingLengthBytes.length + remainingLength);
    
    packet[0] = PACKET_TYPES.PUBACK << 4;
    packet.set(remainingLengthBytes, 1);
    packet[1 + remainingLengthBytes.length] = (messageId >> 8) & 0xFF;
    packet[1 + remainingLengthBytes.length + 1] = messageId & 0xFF;
    
    return packet;
  };

  /**
   * Build SUBSCRIBE packet
   */
  const buildSubscribe = (options: MqttSubscribeOptions): Uint8Array => {
    // Variable header (message ID)
    const variableHeader = new Uint8Array(2);
    variableHeader[0] = (options.messageId >> 8) & 0xFF;
    variableHeader[1] = options.messageId & 0xFF;
    
    // Payload
    let payloadLength = 0;
    const topicBytes: Uint8Array[] = [];
    
    for (const topic of options.topics) {
      const encoded = encodeString(topic.topic);
      topicBytes.push(encoded);
      payloadLength += encoded.length + 1; // +1 for QoS byte
    }
    
    const payload = new Uint8Array(payloadLength);
    let offset = 0;
    
    for (let i = 0; i < options.topics.length; i++) {
      payload.set(topicBytes[i], offset);
      offset += topicBytes[i].length;
      payload[offset] = options.topics[i].qos;
      offset += 1;
    }
    
    // Complete packet
    const remainingLength = variableHeader.length + payload.length;
    const remainingLengthBytes = encodeRemainingLength(remainingLength);
    
    const packet = new Uint8Array(1 + remainingLengthBytes.length + remainingLength);
    
    // Fixed header (SUBSCRIBE packets must have flags = 0010)
    packet[0] = (PACKET_TYPES.SUBSCRIBE << 4) | 0x02;
    packet.set(remainingLengthBytes, 1);
    
    // Variable header and payload
    packet.set(variableHeader, 1 + remainingLengthBytes.length);
    packet.set(payload, 1 + remainingLengthBytes.length + variableHeader.length);
    
    return packet;
  };

  /**
   * Build UNSUBSCRIBE packet
   */
  const buildUnsubscribe = (options: MqttUnsubscribeOptions): Uint8Array => {
    // Variable header (message ID)
    const variableHeader = new Uint8Array(2);
    variableHeader[0] = (options.messageId >> 8) & 0xFF;
    variableHeader[1] = options.messageId & 0xFF;
    
    // Payload
    let payloadLength = 0;
    const topicBytes: Uint8Array[] = [];
    
    for (const topic of options.topics) {
      const encoded = encodeString(topic);
      topicBytes.push(encoded);
      payloadLength += encoded.length;
    }
    
    const payload = new Uint8Array(payloadLength);
    let offset = 0;
    
    for (const encoded of topicBytes) {
      payload.set(encoded, offset);
      offset += encoded.length;
    }
    
    // Complete packet
    const remainingLength = variableHeader.length + payload.length;
    const remainingLengthBytes = encodeRemainingLength(remainingLength);
    
    const packet = new Uint8Array(1 + remainingLengthBytes.length + remainingLength);
    
    // Fixed header (UNSUBSCRIBE packets must have flags = 0010)
    packet[0] = (PACKET_TYPES.UNSUBSCRIBE << 4) | 0x02;
    packet.set(remainingLengthBytes, 1);
    
    // Variable header and payload
    packet.set(variableHeader, 1 + remainingLengthBytes.length);
    packet.set(payload, 1 + remainingLengthBytes.length + variableHeader.length);
    
    return packet;
  };

  /**
   * Build PINGREQ packet
   */
  const buildPingReq = (): Uint8Array => {
    return new Uint8Array([PACKET_TYPES.PINGREQ << 4, 0]);
  };

  /**
   * Build DISCONNECT packet
   */
  const buildDisconnect = (): Uint8Array => {
    return new Uint8Array([PACKET_TYPES.DISCONNECT << 4, 0]);
  };

  return {
    buildConnect,
    buildPublish,
    buildPubAck,
    buildSubscribe,
    buildUnsubscribe,
    buildPingReq,
    buildDisconnect
  };
};