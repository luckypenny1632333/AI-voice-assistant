import WebSocket from "ws";
import { getDuration } from "../utils/datetime";
import { logger } from "../utils/console-logger";
import { getStringFromRawData } from "../utils/websocket";
import type { CallSession } from "./types";
import { getSystemMessage, VOICE } from "./agent/agent";

// List of Event Types to log to the console
const LOG_EVENT_TYPES = [
    "response.content.done",
    // "rate_limits.updated",
    "response.done",
    // "input_audio_buffer.committed",
    // "input_audio_buffer.speech_stopped",
    // "input_audio_buffer.speech_started",
    "session.created",
    "response.text.done",
    "conversation.item.input_audio_transcription.completed",
    // "response.audio_transcript.delta",
];
// TODO: add suffix ` (num)` of same stdout line count
const LOG_EVENT_TYPES_EXCLUDE = [
    "response.audio.delta", // raw audio of same `response.audio_transcript.delta` item_id
    "response.audio_transcript.delta",
];

const sendSessionUpdate = (openAiWs: WebSocket, session: CallSession) => {
    const sessionUpdate = {
        type: "session.update",
        session: {
            turn_detection: {
                type: "server_vad",
                threshold: 0.6,
                prefix_padding_ms: 500,
                silence_duration_ms: 1000,
            },
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            voice: VOICE,
            instructions: getSystemMessage(session),
            modalities: ["text", "audio"],
            temperature: 0.8,
            tools: [],
            tool_choice: "auto",
            input_audio_transcription: {
                model: "whisper-1",
                // prompt: "Hallo, Willkommen in Eddys Hundehaare Laden.", // not working -> destroys the stream
            },
        },
    };

    logger.log("Sending session update:", sessionUpdate);
    openAiWs.send(JSON.stringify(sessionUpdate));
};

const sendInitiateConversation = (openAiWs: WebSocket) => {
    const initiateConversation = {
        type: "conversation.item.create",
        item: {
            type: "message",
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: "Hallo!",
                },
            ],
        },
    };

    logger.log("Sending initiate conversation:", initiateConversation);
    openAiWs.send(JSON.stringify(initiateConversation));
    openAiWs.send(JSON.stringify({ type: "response.create" }));
};

export const handleOpenAiWsOpen = (
    openAiWs: WebSocket,
    session: CallSession,
) => {
    logger.log("Connected to the OpenAI Realtime API");
    setTimeout(() => sendSessionUpdate(openAiWs, session), 250);
    setTimeout(() => sendInitiateConversation(openAiWs), 500);
};

export const handleOpenAIMessage = (
    data: WebSocket.RawData,
    session: CallSession,
    mediaStreamWs: WebSocket,
) => {
    try {
        const message = JSON.parse(getStringFromRawData(data) ?? "{}");

        const timePrefix = `[${getDuration(session.createdAt)}]`;

        // Log received events
        if (!LOG_EVENT_TYPES_EXCLUDE.includes(message.type)) {
            logger.log(
                `Received event: ${message.type}`,
                LOG_EVENT_TYPES.includes(message.type) ? message : undefined,
            );
        }

        // User message transcription handling
        if (
            message.type ===
            "conversation.item.input_audio_transcription.completed"
        ) {
            const userMessage = message.transcript.trim();

            if (userMessage) {
                session.transcript += `${timePrefix} User: ${userMessage}\n`;
                logger.log(
                    `${timePrefix} User (${session.id}): ${userMessage}`,
                );
            } else {
                logger.log(`${timePrefix} User audio transcript is blank`);
            }
        }

        // Agent message handling
        if (message.type === "response.done") {
            const agentMessage = message.response.output[0]?.content?.find(
                (content: unknown) =>
                    typeof content === "object" &&
                    content !== null &&
                    "transcript" in content &&
                    content.transcript,
            )?.transcript;
            if (agentMessage) {
                session.transcript += `${timePrefix} Agent: ${agentMessage}\n`;
                logger.log(
                    `${timePrefix} Agent (${session.id}): ${agentMessage}`,
                );
            } else {
                logger.log(`${timePrefix} Agent message not found`);
            }
        }

        if (message.type === "session.updated") {
            logger.log("Session updated successfully:", message);
        }

        if (message.type === "response.audio.delta" && message.delta) {
            const audioDelta = {
                event: "media",
                streamSid: session.streamSid,
                media: {
                    payload: Buffer.from(message.delta, "base64").toString(
                        "base64",
                    ),
                },
            };
            mediaStreamWs.send(JSON.stringify(audioDelta));
        }
    } catch (error) {
        logger.error("Error processing OpenAI message", error, { data });
    }
};
