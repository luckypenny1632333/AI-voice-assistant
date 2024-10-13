import type { FastifyRequest } from 'fastify';
import { setupTwilioEventHandler } from './twilio-message';
import { openAIRealtimeClient } from '../providers/openai-realtime';
import { setupOpenAIRealtimeClient } from './openai-realtime';
import type WebSocket from 'ws';
import { logger } from '../utils/console-logger';
import { callSessionService } from '../services/call-session';

const loggerContext = 'MediaStream';

export const handleMediaStream = (twilioWs: WebSocket, req: FastifyRequest) => {
  logger.log(
    'Client connected',
    undefined, // { connection }
    loggerContext
  );

  const sessionId = [req.headers['x-twilio-call-sid']].flat()[0];
  const session = callSessionService.startSession(sessionId);

  setupOpenAIRealtimeClient(openAIRealtimeClient, twilioWs, session);

  setupTwilioEventHandler(twilioWs, openAIRealtimeClient, session);
};
