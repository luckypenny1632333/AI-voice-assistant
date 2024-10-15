import { CallSessionService, type CallSession } from '@/services/call-session';

export const testIncomingCall = {
  ApiVersion:  "2010-04-01",
  AccountSid: "AC00000000000000000000000000000000",
  CallSid:  "CA00000000000000000000000000000000",
  CallStatus: "ringring",
  Direction:  "inbound",
  Caller:  "+491700000000",
  CallerZip:  "",
  CallerCity:  "",
  CallerState:  "",
  CallerCountry:  "DE",
  From:  "+491700000000",
  FromZip:  "",
  FromCity: "",
  FromState:  "",
  FromCountry:  "DE",
  Called:  "+48732106545",
  CalledZip:  "",
  CalledCity:  "",
  CalledState:  "",
  CalledCountry: "PL",
  To:  "+48732106545",
  ToZip:  "",
  ToCity:  "",
  ToState:  "",
  ToCountry:  "PL",
}

export const testSession: CallSession = {
  id: `session_${Date.now()}`,
  createdAt: Date.now(),
  streamSid: 'sid-123',
  incomingCall: testIncomingCall,
  appId: CallSessionService.getAppId({
    incomingCall: testIncomingCall,
  }),
  callerId: CallSessionService.getCallerId({
    incomingCall: testIncomingCall,
  }),
  transcript: '',
};
