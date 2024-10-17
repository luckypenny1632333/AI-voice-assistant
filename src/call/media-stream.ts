import type { FastifyRequest } from 'fastify';
import type WebSocket from 'ws';

import { openAIRealtimeClient } from '@/providers/openai-realtime';
import { callSessionService } from '@/services/call-session';
import { logger } from '@/utils/console-logger';

import { setupOpenAIRealtimeClient } from './openai-realtime';
import { setupTwilioEventHandler } from './twilio-message';

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
