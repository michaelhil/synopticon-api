/**
 * Communication Manager Types and Interfaces
 */

export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface QueueItem {
  id?: string;
  data: any;
  priority: Priority;
  timestamp: number;
}

export interface ConversationTurn {
  role: string;
  content: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface Conversation {
  id: string;
  turns: ConversationTurn[];
  context: Record<string, any>;
  startTime: number;
  lastActivity: number;
  metadata: Record<string, any>;
}

export interface Session {
  id: string;
  websocket?: any;
  connected: number;
  lastMessage: number | null;
}

export interface Message {
  type: string;
  content?: any;
  timestamp?: number;
  priority?: Priority;
  sessionId?: string;
  [key: string]: any;
}

export interface Alert {
  id?: string;
  type: string;
  message: string;
  priority: Priority;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface SimulatorCommand {
  action: string;
  parameters?: Record<string, any>;
  callback?: (result: any) => void;
}

export interface SimulatorState {
  running: boolean;
  scenarioId?: string;
  progress?: number;
  metrics?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  confidence?: number;
  reasoning?: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface DialogueContext {
  sessionId: string;
  intent?: string;
  entities?: Record<string, any>;
  sentiment?: string;
  history?: ConversationTurn[];
}

export interface CommunicationConfig {
  maxConversationTurns?: number;
  maxConversationAge?: number;
  cleanupInterval?: number;
  enableLogging?: boolean;
  logLevel?: number;
  aiConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  simulatorConfig?: {
    endpoint?: string;
    timeout?: number;
  };
}

export interface PriorityQueue {
  enqueue: (item: any, priority?: Priority) => void;
  dequeue: () => any | null;
  peek: () => any | null;
  size: () => number;
}

export interface ConversationManager {
  getOrCreate: (sessionId: string) => Conversation;
  addTurn: (sessionId: string, role: string, content: string, metadata?: Record<string, any>) => void;
  getContext: (sessionId: string, maxTurns?: number) => ConversationTurn[];
  updateContext: (sessionId: string, key: string, value: any) => void;
  cleanup: (maxAge?: number) => void;
}

export interface HumanInterfaceChannel {
  connect: (sessionId: string, ws: any) => void;
  disconnect: (sessionId: string) => void;
  send: (sessionId: string, message: Message) => boolean;
  broadcast: (message: Message, filter?: (session: Session) => boolean) => number;
  notify: (alert: Alert) => number;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  getSession: (id: string) => Session | undefined;
  getSessions: () => Session[];
}

export interface SimulatorControlChannel {
  connect: (endpoint: string) => Promise<boolean>;
  disconnect: () => void;
  sendCommand: (command: SimulatorCommand) => Promise<any>;
  getState: () => SimulatorState;
  startScenario: (scenarioId: string, parameters?: Record<string, any>) => Promise<void>;
  stopScenario: () => Promise<void>;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
}

export interface AIDialogueChannel {
  processMessage: (message: string, context: DialogueContext) => Promise<AIResponse>;
  generateResponse: (intent: string, entities: Record<string, any>) => Promise<string>;
  analyzeConversation: (turns: ConversationTurn[]) => Promise<any>;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
}