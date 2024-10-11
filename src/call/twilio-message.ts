import type WebSocket from 'ws';
import type { RealtimeClient } from '@openai/realtime-api-beta';
import type { CallSession } from './types';
import { processTranscriptAndSend } from './call-summary';
import { logger } from '../utils/console-logger';

const loggerContext = 'Twilio';

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

    switch (message.event) {
      case 'media':
        if (openAIRealtimeClient.isConnected()) {
          // const audioAppend = {
          //   type: "input_audio_buffer.append",
          //   audio: message.media.payload,
          // };

          openAIRealtimeClient.appendInputAudio(message.media.payload);

          // openAiWs.send(JSON.stringify(audioAppend));
        }
        break;
      case 'start':
        session.streamSid = message.start.streamSid;
        session.incomingCall = JSON.parse(
          decodeURIComponent(message.start.customParameters.incomingCall.slice(1))
        );
        logger.log(
          'Incoming stream has started',
          { streamSid: session.streamSid, incomingCall: session.incomingCall },
          // util.inspect(
          //     { data },
          //     { depth: null, colors: true },
          // ),
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
  session: CallSession,
  sessions: Map<string, CallSession>
) => {
  if (openAIRealtimeClient.isConnected()) openAIRealtimeClient.disconnect();

  logger.log(`Client disconnected (${session.id})`, undefined, loggerContext);
  logger.debug('Full Transcript', { transcript: session.transcript }, loggerContext);

  await processTranscriptAndSend(session);

  // Clean up the session
  sessions.delete(session.id);
};
