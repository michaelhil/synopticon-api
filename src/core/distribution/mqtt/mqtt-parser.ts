/**
 * MQTT Packet Parser
 * Parses incoming MQTT packets from byte streams
 */

import type {
  MqttPacket,
  MqttConnAckPacket,
  MqttPublishPacket,
  MqttPubAckPacket,
  MqttSubAckPacket,
  MqttQoS
} from './mqtt-types.js';

/**
 * MQTT packet type constants
 */
const PACKET_TYPES = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  PUBREC: 5,
  PUBREL: 6,
  PUBCOMP: 7,
  SUBSCRIBE: 8,
  SUBACK: 9,
  UNSUBSCRIBE: 10,
  UNSUBACK: 11,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14
} as const;

/**
 * Creates MQTT packet parser
 */
export const createMqttParser = () => {
  let buffer = new Uint8Array(0);

  /**
   * Parse remaining length field
   */
  const parseRemainingLength = (data: Uint8Array, offset: number): { length: number; bytes: number } => {
    let multiplier = 1;
    let length = 0;
    let bytes = 0;
    
    while (bytes < 4) {
      if (offset + bytes >= data.length) {
        throw new Error('Incomplete remaining length');
      }
      
      const byte = data[offset + bytes];
      length += (byte & 0x7F) * multiplier;
      bytes++;
      
      if ((byte & 0x80) === 0) {
        break;
      }
      
      multiplier *= 128;
    }
    
    return { length, bytes };
  };

  /**
   * Parse UTF-8 string
   */
  const parseString = (data: Uint8Array, offset: number): { value: string; bytes: number } => {
    if (offset + 2 > data.length) {
      throw new Error('Incomplete string length');
    }
    
    const length = (data[offset] << 8) | data[offset + 1];
    
    if (offset + 2 + length > data.length) {
      throw new Error('Incomplete string data');
    }
    
    const stringData = data.slice(offset + 2, offset + 2 + length);
    const value = new TextDecoder().decode(stringData);
    
    return { value, bytes: 2 + length };
  };

  /**
   * Parse CONNACK packet
   */
  const parseConnAck = (data: Uint8Array, offset: number): MqttConnAckPacket => {
    if (offset + 2 > data.length) {
      throw new Error('Incomplete CONNACK packet');
    }
    
    const sessionPresent = (data[offset] & 0x01) === 1;
    const returnCode = data[offset + 1];
    
    return {
      type: 'CONNACK',
      sessionPresent,
      returnCode
    };
  };

  /**
   * Parse PUBLISH packet
   */
  const parsePublish = (data: Uint8Array, offset: number, flags: number, remainingLength: number): MqttPublishPacket => {
    const dup = (flags & 0x08) !== 0;
    const qos = ((flags & 0x06) >> 1) as MqttQoS;
    const retain = (flags & 0x01) !== 0;
    
    let currentOffset = offset;
    
    // Parse topic
    const topicResult = parseString(data, currentOffset);
    const topic = topicResult.value;
    currentOffset += topicResult.bytes;
    
    // Parse message ID (only for QoS 1 and 2)
    let messageId: number | undefined;
    if (qos > 0) {
      if (currentOffset + 2 > data.length) {
        throw new Error('Incomplete PUBLISH message ID');
      }
      messageId = (data[currentOffset] << 8) | data[currentOffset + 1];
      currentOffset += 2;
    }
    
    // Parse payload
    const payloadLength = remainingLength - (currentOffset - offset);
    if (currentOffset + payloadLength > data.length) {
      throw new Error('Incomplete PUBLISH payload');
    }
    
    const payload = data.slice(currentOffset, currentOffset + payloadLength);
    
    return {
      type: 'PUBLISH',
      topic,
      payload,
      qos,
      retain,
      dup,
      messageId
    };
  };

  /**
   * Parse PUBACK packet
   */
  const parsePubAck = (data: Uint8Array, offset: number): MqttPubAckPacket => {
    if (offset + 2 > data.length) {
      throw new Error('Incomplete PUBACK packet');
    }
    
    const messageId = (data[offset] << 8) | data[offset + 1];
    
    return {
      type: 'PUBACK',
      messageId
    };
  };

  /**
   * Parse SUBACK packet
   */
  const parseSubAck = (data: Uint8Array, offset: number, remainingLength: number): MqttSubAckPacket => {
    if (offset + 2 > data.length) {
      throw new Error('Incomplete SUBACK packet');
    }
    
    const messageId = (data[offset] << 8) | data[offset + 1];
    const qosLength = remainingLength - 2;
    
    if (offset + 2 + qosLength > data.length) {
      throw new Error('Incomplete SUBACK QoS codes');
    }
    
    const qos: MqttQoS[] = [];
    for (let i = 0; i < qosLength; i++) {
      const qosCode = data[offset + 2 + i];
      if (qosCode === 0x80) {
        throw new Error('Subscription failed');
      }
      qos.push(qosCode as MqttQoS);
    }
    
    return {
      type: 'SUBACK',
      messageId,
      qos
    };
  };

  /**
   * Parse single packet from data
   */
  const parsePacket = (data: Uint8Array, offset: number): { packet: MqttPacket; bytesConsumed: number } => {
    if (offset >= data.length) {
      throw new Error('No data to parse');
    }
    
    const firstByte = data[offset];
    const packetType = (firstByte >> 4) & 0x0F;
    const flags = firstByte & 0x0F;
    
    // Parse remaining length
    const remainingLengthResult = parseRemainingLength(data, offset + 1);
    const remainingLength = remainingLengthResult.length;
    const remainingLengthBytes = remainingLengthResult.bytes;
    
    const headerLength = 1 + remainingLengthBytes;
    const totalLength = headerLength + remainingLength;
    
    if (offset + totalLength > data.length) {
      throw new Error('Incomplete packet');
    }
    
    const payloadOffset = offset + headerLength;
    
    let packet: MqttPacket;
    
    switch (packetType) {
    case PACKET_TYPES.CONNACK:
      packet = parseConnAck(data, payloadOffset);
      break;
        
    case PACKET_TYPES.PUBLISH:
      packet = parsePublish(data, payloadOffset, flags, remainingLength);
      break;
        
    case PACKET_TYPES.PUBACK:
      packet = parsePubAck(data, payloadOffset);
      break;
        
    case PACKET_TYPES.SUBACK:
      packet = parseSubAck(data, payloadOffset, remainingLength);
      break;
        
    case PACKET_TYPES.UNSUBACK:
      packet = {
        type: 'UNSUBACK',
        messageId: (data[payloadOffset] << 8) | data[payloadOffset + 1]
      };
      break;
        
    case PACKET_TYPES.PINGRESP:
      packet = { type: 'PINGRESP' };
      break;
        
    default:
      packet = {
        type: 'UNKNOWN',
        flags,
        data: data.slice(payloadOffset, payloadOffset + remainingLength)
      };
    }
    
    return { packet, bytesConsumed: totalLength };
  };

  /**
   * Parse incoming data and return complete packets
   */
  const parse = (data: Uint8Array): MqttPacket[] => {
    // Append new data to buffer
    const newBuffer = new Uint8Array(buffer.length + data.length);
    newBuffer.set(buffer);
    newBuffer.set(data, buffer.length);
    buffer = newBuffer;
    
    const packets: MqttPacket[] = [];
    let offset = 0;
    
    while (offset < buffer.length) {
      try {
        const result = parsePacket(buffer, offset);
        packets.push(result.packet);
        offset += result.bytesConsumed;
      } catch (error) {
        // Not enough data for complete packet
        // console.error('Parser error:', error.message, 'at offset:', offset, 'buffer length:', buffer.length);
        break;
      }
    }
    
    // Update buffer with remaining data
    if (offset > 0) {
      buffer = buffer.slice(offset);
    }
    
    return packets;
  };

  /**
   * Reset parser state
   */
  const reset = (): void => {
    buffer = new Uint8Array(0);
  };

  return {
    parse,
    reset
  };
};
