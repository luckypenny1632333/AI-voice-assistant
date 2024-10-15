import { z } from 'zod';

const IncomingCallSchema = z.object({
  ApiVersion: z.string(), // "2010-04-01"
  AccountSid: z.string(), // "AC..."
  CallSid: z.string(), // "CA..."
  CallStatus: z.string(), // "ringring"
  Direction: z.string(), // "inbound"
  Caller: z.string(), // "+49..."
  CallerZip: z.string(), // ""
  CallerCity: z.string(), // ""
  CallerState: z.string(), // ""
  CallerCountry: z.string(), // "DE"
  From: z.string(), // "+49..."
  FromZip: z.string(), // ""
  FromCity: z.string(), // ""
  FromState: z.string(), // ""
  FromCountry: z.string(), // "DE"
  Called: z.string(), // "+48732106545"
  CalledZip: z.string(), // ""
  CalledCity: z.string(), // ""
  CalledState: z.string(), // ""
  CalledCountry: z.string(), // "PL"
  To: z.string(), // "+48732106545"
  ToZip: z.string(), // ""
  ToCity: z.string(), // ""
  ToState: z.string(), // ""
  ToCountry: z.string(), // "PL"
})
export type IncomingCall = z.infer<typeof IncomingCallSchema>;

export const CallSessionSchema = z.object({
  id: z.string().default(`session_${Date.now()}`),
  createdAt: z.number().default(Date.now()),
  streamSid: z.string().optional(),
  incomingCall: IncomingCallSchema.optional(),
  appId: z.string().optional(),
  callerId: z.string().optional(),
  transcript: z.string().default(''),
});
export type CallSession = z.infer<typeof CallSessionSchema>;
