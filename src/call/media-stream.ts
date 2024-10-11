import type { FastifyRequest } from 'fastify';
import type { CallSession } from './types';
import { openAIRealtimeClient } from '../providers/openai-realtime';
import {
  handleOpenAIRealtimeWsOpen,
  handleOpenAIRealtimeWsClose,
  handleOpenAIRealtimeWsError,
  handleOpenAIMessage,
} from './openai-realtime';
import { handleTwilioMessage, handleTwilioWsClose } from './twilio-message';
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
    // util.inspect({ connection }, { depth: 3, colors: true }),
    undefined,
    loggerContext
  );

  const now = Date.now();
  const sessionId = [req.headers['x-twilio-call-sid']].flat()[0] || `session_${now}`;
  const session: CallSession = sessions.get(sessionId) || {
    id: sessionId,
    createdAt: now,
    transcript: '',
  };
  sessions.set(sessionId, session);

  // Open event for OpenAI WebSocket
  openAIRealtimeClient.on('open', () => handleOpenAIRealtimeWsOpen(openAIRealtimeClient, session));

  // Listen for messages from the OpenAI WebSocket
  openAIRealtimeClient.on('message', (data: WebSocket.RawData, isBinary: boolean) =>
    handleOpenAIMessage(data, isBinary, session, twilioWs)
  );

  // Handle WebSocket close and errors
  openAIRealtimeClient.on('close', handleOpenAIRealtimeWsClose);
  openAIRealtimeClient.on('error', handleOpenAIRealtimeWsError);

  openAIRealtimeClient.connect();

  // Handle incoming messages from Twilio
  twilioWs.on('message', (data) => handleTwilioMessage(data, session, openAIRealtimeClient));

  // Handle connection close and log transcript
  twilioWs.on('close', () => handleTwilioWsClose(openAIRealtimeClient, session, sessions));

  twilioWs.on('error', async (error) => {
    logger.error('Error in Twilio WebSocket:', error, undefined, loggerContext);

    // Close the WebSocket connection
    twilioWs.close();
  });
};
