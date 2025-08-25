/**
 * Type declarations for distribution-session-manager.js
 */

export interface DistributionSession {
  id: string;
  config: any;
  distributors: Map<string, any>;
  status: 'active' | 'stopped' | 'error';
  startTime: number;
}

export interface SessionManager {
  createSession(sessionId: string, config: any): Promise<DistributionSession>;
  endSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): DistributionSession | null;
  getActiveSessions(): DistributionSession[];
  routeEvent(sessionId: string, eventType: string, data: any): Promise<void>;
  getSessionStatus(sessionId: string): any;
  cleanup(): Promise<void>;
}

export function createDistributionSessionManager(config?: any): SessionManager;
