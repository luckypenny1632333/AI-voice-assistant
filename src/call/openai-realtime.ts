import type WebSocket from 'ws';
import type { RealtimeClient } from '@openai/realtime-api-beta';
import { getDuration } from '../utils/datetime';
import { logger } from '../utils/console-logger';
import type { CallSession } from '../services/call-session';
import { getSystemMessage, VOICE } from './agent/agent';
import { agentTools } from './agent/tools';
import { endCall } from '../providers/twilio';

// List of Event Types to log to the console
const LOG_EVENT_TYPES = [
    'response.content.done',
    // "rate_limits.updated",
    // "conversation.item.created",
    // "response.created",
    'response.done',
    // "input_audio_buffer.committed",
    // "input_audio_buffer.speech_stopped",
    // "input_audio_buffer.speech_started",
    // "session.created",
    'response.text.done',
    'conversation.item.input_audio_transcription.completed',
    // "response.audio_transcript.delta",
];
const LOG_EVENT_TYPES_EXCLUDE = [
    'response.audio.delta', // raw audio of same `response.audio_transcript.delta` item_id
    'response.audio_transcript.delta',
];

const loggerContext = 'OpenAI';

export const setupOpenAIRealtimeClient = (
    openAIRealtimeClient: RealtimeClient,
    twilioWs: WebSocket,
    session: CallSession
) => {
    // Listen for messages from the OpenAI WebSocket
    openAIRealtimeClient.realtime.on('server.*', (data: any) => {
        // logger.log(`DEBUG realtime server.*: ${sessionId}`, data, loggerContext);
        handleOpenAIMessage(openAIRealtimeClient, data, session, twilioWs);
    });

    // Handle WebSocket close and errors
    openAIRealtimeClient.realtime.on('close', handleOpenAIRealtimeClose);
    openAIRealtimeClient.realtime.on('error', handleOpenAIRealtimeError);

    // // all events, can use for logging, debugging, or manual event handling
    // openAIRealtimeClient.on(
    //   'realtime.event',
    //   ({ time, source, event }: { time: string; source: 'server' | 'client'; event: any }) => {
    //     // time is an ISO timestamp
    //     // source is 'client' or 'server'
    //     // event is the raw event payload (json)
    //     logger.log(`DEBUG realtime.event`, { time, source, event }, loggerContext);
    //   }
    // );
    openAIRealtimeClient.on('conversation.interrupted', ({ ...rest }: any) => {
        logger.log(`Received event: conversation.interrupted`, rest, loggerContext);
    });
    openAIRealtimeClient.on('conversation.updated', ({ ...rest }: any) => {
        logger.log(`Received event: conversation.updated`, rest, loggerContext);
    });
    openAIRealtimeClient.on('conversation.item.appended', ({ ...rest }: any) => {
        logger.log(`Received event: conversation.item.appended`, rest, loggerContext);
    });
    openAIRealtimeClient.on('conversation.item.completed', ({ ...rest }: any) => {
        logger.log(`Received event: conversation.item.completed`, rest, loggerContext);
    });
    // openAIRealtimeClient.realtime.on('client.*', ({ ...rest }: any) =>
    //   logger.log(`Received event: realtime client.*: ${session.id}`, rest, loggerContext)
    // );

    openAIRealtimeClient
        .connect()
        .then((res) => {
            logger.log(
                `Connected to OpenAI Realtime: ${res} ${openAIRealtimeClient.realtime.isConnected()}`,
                undefined,
                loggerContext
            );
            handleOpenAIRealtimeConnected(openAIRealtimeClient, session);
        })
        .catch((err) =>
            logger.error('Error connecting to OpenAI Realtime API', err, undefined, loggerContext)
        );
};

const sendSessionUpdate = (openAIRealtimeClient: RealtimeClient, session: CallSession) => {
    logger.log(
        'Sending session update',
        undefined, // sessionUpdate,
        loggerContext
    ),
        openAIRealtimeClient.updateSession({
            turn_detection: {
                type: 'server_vad',
                threshold: 0.6,
                prefix_padding_ms: 500,
                silence_duration_ms: 1000,
            },
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            voice: VOICE,
            instructions: getSystemMessage(session),
            modalities: ['text', 'audio'],
            temperature: 0.8,
            tools: [],
            tool_choice: 'auto',
            input_audio_transcription: {
                model: 'whisper-1',
                // prompt: "Hallo, Willkommen in Eddys Hundehaare Laden.", // not working -> destroys the stream, see: https://platform.openai.com/docs/guides/speech-to-text/prompting
            },
        });
};

const addTools = (openAIRealtimeClient: RealtimeClient, session: CallSession) => {
    agentTools.forEach((tool) =>
        openAIRealtimeClient.addTool(tool.definition, tool.handler(openAIRealtimeClient, session))
    );
};

const sendInitiateConversation = (openAIRealtimeClient: RealtimeClient) => {
    logger.log(
        'Sending initiate conversation',
        undefined, // initiateConversation,
        loggerContext
    );
    openAIRealtimeClient.sendUserMessageContent([{ type: 'input_text', text: `Hallo!` }]);
};

export const handleOpenAIRealtimeConnected = (
    openAIRealtimeClient: RealtimeClient,
    session: CallSession
) => {
    logger.log('Connected to the OpenAI Realtime API', undefined, loggerContext);
    sendSessionUpdate(openAIRealtimeClient, session);
    addTools(openAIRealtimeClient, session);

    setTimeout(() => sendInitiateConversation(openAIRealtimeClient), 500);
};

export const handleOpenAIRealtimeClose = (code: number, reason?: Buffer) => {
    logger.log(
        'Disconnected from the OpenAI Realtime API',
        {
            code,
            reason: reason?.toString(),
        },
        loggerContext
    );
};

export const handleOpenAIRealtimeError = (error: Error) => {
    logger.error('Error in the OpenAI WebSocket:', error, undefined, loggerContext);
};

export const handleOpenAIMessage = (
    openAIRealtimeClient: RealtimeClient,
    message: any,
    session: CallSession,
    mediaStreamWs: WebSocket
) => {
    try {
        const timePrefix = `[${getDuration(session.createdAt)}]`;

        // Log received events
        if (!LOG_EVENT_TYPES_EXCLUDE.includes(message.type)) {
            logger.log(
                `Received event: ${message.type}`,
                LOG_EVENT_TYPES.includes(message.type) ? message : undefined,
                loggerContext
            );
        }

        // User message transcription handling
        if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const userMessage = message.transcript.trim();

            if (userMessage) {
                session.transcript += `${timePrefix} User: ${userMessage}\n`;
                logger.log(
                    `${timePrefix} User (${session.id}): ${userMessage}`,
                    undefined,
                    loggerContext
                );
            } else {
                logger.log(
                    `${timePrefix} User audio transcript is empty`,
                    undefined,
                    loggerContext
                );
            }
        }

        // Agent message handling
        if (message.type === 'response.done') {
            const { status, status_details, usage } = message.response;
            const agentMessage = message.response.output[0]?.content
                ?.find(
                    (content: unknown) =>
                        typeof content === 'object' &&
                        content !== null &&
                        'transcript' in content &&
                        content.transcript
                )
                ?.transcript.trim();

            if (agentMessage) {
                session.transcript += `${timePrefix} Agent: ${agentMessage}\n`;
                logger.log(
                    `${timePrefix} Agent (${session.id}): ${agentMessage}`,
                    undefined,
                    loggerContext
                );
            } else {
                logger.log(`${timePrefix} Agent message is empty`, undefined, loggerContext);
            }

            // Insufficient OpenAI quota -> end call
            if (status === 'failed' && status_details.error.code === 'insufficient_quota') {
                logger.error('Insufficient quota', undefined, undefined, loggerContext);

                // disconnect call
                if (session.incomingCall?.CallSid) {
                    endCall(session.incomingCall.CallSid, session.incomingCall.CallerCountry)
                        .then(() => {
                            logger.log(
                                `Call ${session.incomingCall?.CallSid} ended`,
                                undefined,
                                loggerContext
                            );
                        })
                        .catch((err) =>
                            logger.error('Error ending call', err, undefined, loggerContext)
                        );
                }

                // mediaStreamWs.close();
            }
        }

        if (message.type === 'session.updated') {
            logger.log('Session updated successfully', message, loggerContext);
        }

        if (message.type === 'response.audio.delta' && message.delta) {
            const audioDelta = {
                event: 'media',
                streamSid: session.streamSid,
                media: {
                    payload: Buffer.from(message.delta, 'base64').toString('base64'),
                },
            };
            mediaStreamWs.send(JSON.stringify(audioDelta));
        }

        if (message.type === 'input_audio_buffer.speech_started') {
            logger.log('Speech Start:', message.type, loggerContext);

            // Clear any ongoing speech on Twilio side
            mediaStreamWs.send(
                JSON.stringify({
                    streamSid: session.streamSid,
                    event: 'clear',
                })
            );

            logger.log('Cancelling AI speech from the server', undefined, loggerContext);

            // Send interrupt message to OpenAI to cancel ongoing response
            openAIRealtimeClient.realtime.send('response.cancel', {});
        }
    } catch (error) {
        logger.error('Error processing OpenAI message', error, { message }, loggerContext);
    }
};
