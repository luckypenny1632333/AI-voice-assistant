import { z } from 'zod';

const CallSessionSchema = z.object({
  id: z.string().default(`session_${Date.now()}`),
  createdAt: z.number().default(Date.now()),
  transcript: z.string().default(''),
  streamSid: z.string().optional(),
  userId: z.string().optional(),
  incomingCall: z.record(z.string()).optional(),
});
export type CallSession = z.infer<typeof CallSessionSchema>;
