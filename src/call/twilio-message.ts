import type WebSocket from 'ws';
import { type RealtimeClient, RealtimeUtils } from '@openai/realtime-api-beta';
import { processTranscriptAndSend } from './call-summary';
import { logger } from '../utils/console-logger';
import { callSessionService, type CallSession } from '../services/call-session';

const loggerContext = 'Twilio';

const LOG_EVENT_TYPES_EXCLUDE = ['media'];

export const setupTwilioEventHandler = (
  twilioWs: WebSocket,
  openAIRealtimeClient: RealtimeClient,
  session: CallSession
) => {
  // Handle incoming messages from Twilio
  twilioWs.on('message', (data) => handleTwilioMessage(data, session, openAIRealtimeClient));

  // Handle connection close and log transcript
  twilioWs.on('close', () => handleTwilioWsClose(openAIRealtimeClient, session));

  twilioWs.on('error', async (error) => {
    logger.error('Error in Twilio WebSocket:', error, undefined, loggerContext);

    // Close the WebSocket connection
    twilioWs.close();
  });
};

export const handleTwilioMessage = (
  data: WebSocket.RawData,
  session: CallSession,
  openAIRealtimeClient: RealtimeClient
) => {
  try {
    const getStringFromRawData = (data: WebSocket.RawData): string | undefined => {
      if (Buffer.isBuffer(data)) {
        return data.toString('utf-8');
      } else if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString('utf-8');
      } else {
        logger.log('Received unknown data type', { data }, loggerContext);
      }
    };

    const message = JSON.parse(getStringFromRawData(data) ?? '{}');

    if (!LOG_EVENT_TYPES_EXCLUDE.includes(message.event)) {
      logger.log(`Received event: ${message.event}`, message, loggerContext);
    }

    switch (message.event) {
      case 'media':
        if (openAIRealtimeClient.isConnected()) {
          // logger.log(`Received ${message.media.track} media event`, message, loggerContext);
          openAIRealtimeClient.appendInputAudio(
            RealtimeUtils.base64ToArrayBuffer(message.media.payload)
          );
        } else {
          logger.log(
            `Dropped ${message.media.track} media event: OpenAI Realtime API not connected`,
            undefined,
            loggerContext
          );
        }
        break;
      case 'start':
        session.streamSid = message.start.streamSid;
        session.incomingCall = JSON.parse(
          decodeURIComponent(message.start.customParameters.incomingCall.slice(1))
        );
        logger.log(
          'Incoming stream has started',
          {
            streamSid: session.streamSid,
            incomingCall: session.incomingCall,
          },
          loggerContext
        );
        break;
      default:
        logger.log(
          `Received non-media event: ${message.event}`,
          {
            event: message.event,
            message,
          },
          loggerContext
        );
        break;
    }
  } catch (error) {
    logger.error('Error parsing message', error, { message: data }, loggerContext);
  }
};

export const handleTwilioWsClose = async (
  openAIRealtimeClient: RealtimeClient,
  session: CallSession
) => {
  if (openAIRealtimeClient.isConnected()) openAIRealtimeClient.disconnect();

  logger.log(`Client disconnected (${session.id})`, undefined, loggerContext);
  logger.debug('Full Transcript', { transcript: session.transcript }, loggerContext);

  await processTranscriptAndSend(session);

  // Clean up the session
  callSessionService.stopSession(session.id);
};
