import dotenv from 'dotenv';
import { type CallSession, CallSessionSchema } from './types/call-session';

const loggerContext = 'CallSessionService';

dotenv.config(); // Load environment variables from .env

export class CallSessionService {
  constructor(public readonly sessions: Map<string, CallSession> = new Map()) {}

  startSession(sessionId?: CallSession['id']): CallSession {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        return session;
      }
    }

    const now = Date.now();
    const newSession = CallSessionSchema.parse({
      id: `session_${now}`,
      createdAt: now,
    });
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  stopSession(sessionId: CallSession['id']): void {
    this.sessions.delete(sessionId);
  }

  static getAppId(session: CallSession): string | undefined {
    if (!session.incomingCall) {
      return;
    }
    const appName = process.env.APP_NAME;
    return `${appName}_${CallSessionService.mapCallNumberToAppId(session.incomingCall.Callee)}`;
  }

  static getCallerId(session: CallSession): string | undefined {
    if (!session.incomingCall) {
      return;
    }
    return session.incomingCall.Caller;
  }

  static mapCallNumberToAppId(callNumber: string): string {
    // add custom mapping here
    return callNumber;
  }
}
export const callSessionService = new CallSessionService();
