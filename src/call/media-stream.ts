import type { FastifyRequest } from 'fastify';
import type { CallSession } from './types';
import { setupTwilioEventHandler } from './twilio-message';
import { openAIRealtimeClient } from '../providers/openai-realtime';
import { setupOpenAIRealtimeClient } from './openai-realtime';
import type WebSocket from 'ws';
import { logger } from '../utils/console-logger';

const loggerContext = 'MediaStream';

export const handleMediaStream = (
  twilioWs: WebSocket,
  req: FastifyRequest,
  sessions: Map<string, CallSession>
) => {
  logger.log(
    'Client connected',
    undefined, // { connection }
    loggerContext
  );

  // Get or create session
  const now = Date.now();
  const sessionId = [req.headers['x-twilio-call-sid']].flat()[0] || `session_${now}`;
  const session: CallSession = sessions.get(sessionId) || {
    id: sessionId,
    createdAt: now,
    transcript: '',
  };
  sessions.set(sessionId, session);

  setupOpenAIRealtimeClient(openAIRealtimeClient, twilioWs, session);

  setupTwilioEventHandler(twilioWs, openAIRealtimeClient, session, sessions);
};
