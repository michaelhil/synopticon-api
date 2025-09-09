/**
 * Native SimConnect Protocol Implementation
 * Zero-dependency implementation of MSFS SimConnect binary protocol
 */

// SimConnect protocol constants
export const SIMCONNECT_PROTOCOL = {
  VERSION: 0x4, // SP2/Acceleration protocol version
  MAGIC_NUMBER: 0x53494D43, // 'SIMC' in little-endian
  RECV_ID_NULL: 0x00000000,
  RECV_ID_EXCEPTION: 0x00000001,
  RECV_ID_OPEN: 0x00000002,
  RECV_ID_QUIT: 0x00000003,
  RECV_ID_EVENT: 0x00000004,
  RECV_ID_SIMOBJECT_DATA: 0x00000005,
  RECV_ID_SIMOBJECT_DATA_BYTYPE: 0x00000006,
  RECV_ID_CLIENT_DATA: 0x00000007
} as const;

// Message IDs for requests
export const SIMCONNECT_MESSAGE_ID = {
  REQUEST_DATA_ON_SIM_OBJECT: 0x00000001,
  SET_DATA_ON_SIM_OBJECT: 0x00000002,
  MAP_CLIENT_EVENT_TO_SIM_EVENT: 0x00000003,
  TRANSMIT_CLIENT_EVENT: 0x00000004,
  REQUEST_SYSTEM_STATE: 0x00000005,
  ADD_TO_DATA_DEFINITION: 0x00000006,
  CLEAR_DATA_DEFINITION: 0x00000007,
  SUBSCRIBE_TO_SYSTEM_EVENT: 0x00000008
} as const;

// Data types for SimConnect variables
export const SIMCONNECT_DATATYPE = {
  INVALID: 0,
  INT32: 1,
  INT64: 2,
  FLOAT32: 3,
  FLOAT64: 4,
  STRING8: 5,
  STRING32: 6,
  STRING64: 7,
  STRING128: 8,
  STRING256: 9,
  STRING260: 10,
  STRINGV: 11,
  INITPOSITION: 12,
  MARKERSTATE: 13,
  WAYPOINT: 14,
  LATLONALT: 15,
  XYZ: 16
} as const;

// SimConnect message header structure
export interface SimConnectHeader {
  size: number;
  version: number;
  id: number;
  callIndex: number;
}

// Binary message parser utilities
export const createMessageParser = () => {
  const parseHeader = (buffer: Uint8Array, offset = 0): SimConnectHeader => {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    return {
      size: view.getUint32(0, true), // little-endian
      version: view.getUint32(4, true),
      id: view.getUint32(8, true),
      callIndex: view.getUint32(12, true)
    };
  };

  const parseString = (buffer: Uint8Array, offset: number, maxLength: number): string => {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    let str = '';
    for (let i = 0; i < maxLength; i++) {
      const char = view.getUint8(i);
      if (char === 0) break;
      str += String.fromCharCode(char);
    }
    return str;
  };

  const parseFloat32 = (buffer: Uint8Array, offset: number): number => {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    return view.getFloat32(0, true);
  };

  const parseInt32 = (buffer: Uint8Array, offset: number): number => {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    return view.getInt32(0, true);
  };

  const parseFloat64 = (buffer: Uint8Array, offset: number): number => {
    const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
    return view.getFloat64(0, true);
  };

  return {
    parseHeader,
    parseString,
    parseFloat32,
    parseInt32,
    parseFloat64
  };
};

// Binary message serializer utilities
export const createMessageSerializer = () => {
  const createHeader = (messageId: number, size: number, callIndex = 0): Uint8Array => {
    const buffer = new Uint8Array(16);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, size, true); // total message size
    view.setUint32(4, SIMCONNECT_PROTOCOL.VERSION, true);
    view.setUint32(8, messageId, true);
    view.setUint32(12, callIndex, true);
    return buffer;
  };

  const serializeString = (str: string, maxLength: number): Uint8Array => {
    const buffer = new Uint8Array(maxLength);
    for (let i = 0; i < Math.min(str.length, maxLength - 1); i++) {
      buffer[i] = str.charCodeAt(i);
    }
    buffer[Math.min(str.length, maxLength - 1)] = 0; // null terminator
    return buffer;
  };

  const serializeUint32 = (value: number): Uint8Array => {
    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, value, true);
    return buffer;
  };

  const serializeFloat64 = (value: number): Uint8Array => {
    const buffer = new Uint8Array(8);
    const view = new DataView(buffer.buffer);
    view.setFloat64(0, value, true);
    return buffer;
  };

  const combineBuffers = (buffers: Uint8Array[]): Uint8Array => {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  };

  return {
    createHeader,
    serializeString,
    serializeUint32,
    serializeFloat64,
    combineBuffers
  };
};

// SimConnect data definitions for MSFS variables
export const MSFS_VARIABLES = {
  // Position and orientation
  PLANE_LATITUDE: 'PLANE LATITUDE',
  PLANE_LONGITUDE: 'PLANE LONGITUDE',
  PLANE_ALTITUDE: 'PLANE ALTITUDE',
  PLANE_HEADING_DEGREES_TRUE: 'PLANE HEADING DEGREES TRUE',
  PLANE_PITCH_DEGREES: 'PLANE PITCH DEGREES',
  PLANE_BANK_DEGREES: 'PLANE BANK DEGREES',
  
  // Velocity and motion
  AIRSPEED_INDICATED: 'AIRSPEED INDICATED',
  AIRSPEED_TRUE: 'AIRSPEED TRUE',
  GROUND_VELOCITY: 'GROUND VELOCITY',
  VERTICAL_SPEED: 'VERTICAL SPEED',
  
  // Controls
  THROTTLE_LOWER_LIMIT: 'THROTTLE LOWER LIMIT',
  ELEVATOR_POSITION: 'ELEVATOR POSITION',
  AILERON_POSITION: 'AILERON POSITION',
  RUDDER_POSITION: 'RUDDER POSITION',
  
  // Engine and systems
  ENGINE_RPM: 'GENERAL ENG RPM:1',
  FUEL_TOTAL_QUANTITY: 'FUEL TOTAL QUANTITY',
  
  // Environment
  AMBIENT_TEMPERATURE: 'AMBIENT TEMPERATURE',
  AMBIENT_WIND_VELOCITY: 'AMBIENT WIND VELOCITY',
  AMBIENT_WIND_DIRECTION: 'AMBIENT WIND DIRECTION'
} as const;

// Data definition structure for organizing variables
export interface DataDefinition {
  id: number;
  variables: Array<{
    name: string;
    unit: string;
    dataType: number;
    epsilon?: number;
  }>;
}

// Create standard flight data definition
export const createFlightDataDefinition = (): DataDefinition => ({
  id: 1,
  variables: [
    { name: MSFS_VARIABLES.PLANE_LATITUDE, unit: 'degrees', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.PLANE_LONGITUDE, unit: 'degrees', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.PLANE_ALTITUDE, unit: 'feet', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.PLANE_HEADING_DEGREES_TRUE, unit: 'degrees', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.AIRSPEED_INDICATED, unit: 'knots', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.VERTICAL_SPEED, unit: 'feet per minute', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.ENGINE_RPM, unit: 'rpm', dataType: SIMCONNECT_DATATYPE.FLOAT64 },
    { name: MSFS_VARIABLES.FUEL_TOTAL_QUANTITY, unit: 'gallons', dataType: SIMCONNECT_DATATYPE.FLOAT64 }
  ]
});

// Message builders for common operations
export const createMessageBuilders = () => {
  const serializer = createMessageSerializer();
  
  const buildDataDefinitionMessage = (definition: DataDefinition): Uint8Array => {
    const messages: Uint8Array[] = [];
    
    definition.variables.forEach((variable, index) => {
      const nameBuffer = serializer.serializeString(variable.name, 256);
      const unitBuffer = serializer.serializeString(variable.unit, 256);
      const dataTypeBuffer = serializer.serializeUint32(variable.dataType);
      const epsilonBuffer = serializer.serializeFloat64(variable.epsilon || 0);
      const defIdBuffer = serializer.serializeUint32(definition.id);
      
      const messageBody = serializer.combineBuffers([
        defIdBuffer,
        nameBuffer,
        unitBuffer,
        dataTypeBuffer,
        epsilonBuffer
      ]);
      
      const header = serializer.createHeader(
        SIMCONNECT_MESSAGE_ID.ADD_TO_DATA_DEFINITION,
        16 + messageBody.length
      );
      
      messages.push(serializer.combineBuffers([header, messageBody]));
    });
    
    return serializer.combineBuffers(messages);
  };
  
  const buildDataRequestMessage = (definitionId: number, requestId: number): Uint8Array => {
    const defIdBuffer = serializer.serializeUint32(definitionId);
    const reqIdBuffer = serializer.serializeUint32(requestId);
    const objectIdBuffer = serializer.serializeUint32(1); // USER aircraft
    const periodBuffer = serializer.serializeUint32(1); // SIMCONNECT_PERIOD_VISUAL_FRAME
    const flagsBuffer = serializer.serializeUint32(0);
    const originBuffer = serializer.serializeUint32(0);
    const intervalBuffer = serializer.serializeUint32(0);
    const limitBuffer = serializer.serializeUint32(0);
    
    const messageBody = serializer.combineBuffers([
      reqIdBuffer,
      defIdBuffer,
      objectIdBuffer,
      periodBuffer,
      flagsBuffer,
      originBuffer,
      intervalBuffer,
      limitBuffer
    ]);
    
    const header = serializer.createHeader(
      SIMCONNECT_MESSAGE_ID.REQUEST_DATA_ON_SIM_OBJECT,
      16 + messageBody.length
    );
    
    return serializer.combineBuffers([header, messageBody]);
  };
  
  return {
    buildDataDefinitionMessage,
    buildDataRequestMessage
  };
};

// Error handling utilities
export interface SimConnectError {
  code: number;
  name: string;
  description: string;
}

export const SIMCONNECT_EXCEPTIONS = {
  0x00000001: { name: 'NONE', description: 'No error' },
  0x00000002: { name: 'ERROR', description: 'Unspecified error' },
  0x00000003: { name: 'SIZE_MISMATCH', description: 'Packet size doesn\'t match' },
  0x00000004: { name: 'UNRECOGNIZED_ID', description: 'Unknown ID' },
  0x00000005: { name: 'UNOPENED', description: 'SimConnect not opened' },
  0x00000006: { name: 'VERSION_MISMATCH', description: 'Version mismatch' },
  0x00000007: { name: 'TOO_MANY_GROUPS', description: 'Too many groups' },
  0x00000008: { name: 'NAME_UNRECOGNIZED', description: 'Name not recognized' },
  0x00000009: { name: 'TOO_MANY_EVENT_NAMES', description: 'Too many event names' },
  0x0000000A: { name: 'EVENT_ID_DUPLICATE', description: 'Duplicate event ID' },
  0x0000000B: { name: 'TOO_MANY_MAPS', description: 'Too many maps' },
  0x0000000C: { name: 'TOO_MANY_OBJECTS', description: 'Too many objects' },
  0x0000000D: { name: 'TOO_MANY_REQUESTS', description: 'Too many requests' },
  0x0000000E: { name: 'WEATHER_INVALID_PORT', description: 'Invalid weather port' },
  0x0000000F: { name: 'WEATHER_INVALID_METAR', description: 'Invalid METAR data' },
  0x00000010: { name: 'WEATHER_UNABLE_TO_GET_OBSERVATION', description: 'Unable to get weather' },
  0x00000011: { name: 'WEATHER_UNABLE_TO_CREATE_STATION', description: 'Unable to create weather station' },
  0x00000012: { name: 'WEATHER_UNABLE_TO_REMOVE_STATION', description: 'Unable to remove weather station' },
  0x00000013: { name: 'INVALID_DATA_TYPE', description: 'Invalid data type' },
  0x00000014: { name: 'INVALID_DATA_SIZE', description: 'Invalid data size' },
  0x00000015: { name: 'DATA_ERROR', description: 'Data error' },
  0x00000016: { name: 'INVALID_ARRAY', description: 'Invalid array' },
  0x00000017: { name: 'CREATE_OBJECT_FAILED', description: 'Failed to create object' },
  0x00000018: { name: 'LOAD_FLIGHTPLAN_FAILED', description: 'Failed to load flight plan' },
  0x00000019: { name: 'OPERATION_INVALID_FOR_OBJECT_TYPE', description: 'Operation invalid for object type' },
  0x0000001A: { name: 'ILLEGAL_OPERATION', description: 'Illegal operation' },
  0x0000001B: { name: 'ALREADY_SUBSCRIBED', description: 'Already subscribed' },
  0x0000001C: { name: 'INVALID_ENUM', description: 'Invalid enumeration' },
  0x0000001D: { name: 'DEFINITION_ERROR', description: 'Definition error' },
  0x0000001E: { name: 'DUPLICATE_ID', description: 'Duplicate ID' },
  0x0000001F: { name: 'DATUM_ID', description: 'Datum ID error' },
  0x00000020: { name: 'OUT_OF_BOUNDS', description: 'Out of bounds' },
  0x00000021: { name: 'KILL_USED', description: 'Kill used' },
  0x00000022: { name: 'KILL_EXTERNAL_SIM', description: 'External sim kill' }
} as const;

export const createErrorHandler = () => {
  const parseException = (buffer: Uint8Array, offset: number): SimConnectError => {
    const parser = createMessageParser();
    const exceptionCode = parser.parseInt32(buffer, offset + 16);
    const exception = SIMCONNECT_EXCEPTIONS[exceptionCode as keyof typeof SIMCONNECT_EXCEPTIONS];
    
    return {
      code: exceptionCode,
      name: exception?.name || 'UNKNOWN',
      description: exception?.description || `Unknown exception code: 0x${exceptionCode.toString(16)}`
    };
  };
  
  return { parseException };
};
