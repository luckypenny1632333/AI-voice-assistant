import { CallSessionService } from '@/services/call-session';

export const testSession = {
  id: `session_${Date.now()}`,
  createdAt: Date.now(),
  streamSid: 'sid-123',
  incomingCall: {
    Caller: '+4917012345678',
    CallerCountry: 'DE',
    Callee: '+4821012345678',
  },
  appId: CallSessionService.getAppId({
    incomingCall: {
      Callee: '+4821012345678',
    },
  }),
  callerId: CallSessionService.getCallerId({
    incomingCall: {
      Caller: '+4917012345678',
      CallerCountry: 'DE',
    },
  }),
  transcript: '',
};
