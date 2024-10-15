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

  static setIncomingCall(session: CallSession, incomingCall: CallSession['incomingCall']): void {
    session.incomingCall = incomingCall;
    session.appId = CallSessionService.getAppId(session);
    session.callerId = CallSessionService.getCallerId(session);
  }

  static getAppId(session: Pick<CallSession, 'incomingCall'>): string | undefined {
    if (!session.incomingCall) {
      return;
    }
    const appName = process.env.APP_NAME;
    return `${appName}_${CallSessionService.mapCalleeNumberToAppId(session.incomingCall.Callee)}`;
  }

  static getCallerId(session: Pick<CallSession, 'incomingCall'>): string | undefined {
    if (!session.incomingCall) {
      return;
    }
    return session.incomingCall.Caller.replace('+', '');
  }

  static mapCalleeNumberToAppId(callNumber: string): string {
    // add custom mapping here
    return callNumber.replace('+', '');
  }
}
export const callSessionService = new CallSessionService();
