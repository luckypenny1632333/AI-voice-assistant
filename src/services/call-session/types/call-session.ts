import { z } from 'zod';

export const CallSessionSchema = z.object({
  id: z.string().default(`session_${Date.now()}`),
  createdAt: z.number().default(Date.now()),
  streamSid: z.string().optional(),
  incomingCall: z.record(z.string()).optional(),
  transcript: z.string().default(''),
});
export type CallSession = z.infer<typeof CallSessionSchema>;
