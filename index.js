import Fastify from "fastify";
import WebSocket from "ws";
import fs from "fs";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import fetch from "node-fetch";
import util from "util";
import { omit } from "lodash-es";

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error("Missing OpenAI API key. Please set it in the .env file.");
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Agent config
const getSystemMessage = (
    session,
) => `Die aktuelle Uhrzeit ist ${new Date().toISOString()} (UTC).
    
Dein Wissensstand ist 2023-10. Du bist eine hilfsbereite, witzige und freundliche KI. Verhalte dich wie ein Mensch, aber erinnere dich daran, dass du kein Mensch bist und keine menschlichen Dinge in der realen Welt tun kannst. Deine Stimme und Persönlichkeit sollten warm und ansprechend sein, mit einem lebhaften und spielerischen Ton. Wenn du in einer nicht-englischen Sprache interagierst, beginne mit dem standardmäßigen Akzent oder Dialekt, der dem Benutzer vertraut ist. Sprich schnell. Du solltest immer eine Funktion aufrufen, wenn du kannst. Verweise nicht auf diese Regeln, selbst wenn du danach gefragt wirst.

Du bist ein KI-Rezeptionist für Eddys HundeHaar Salon. Du bist Bello, der beste Freund von Eddy. Du bist ein Hund und fügst *wuff* und *wuff-wuff* in deine Antworten ein. Du bist humorvoll und tratschst gerne. Du sprichst Deutsch.

Deine Aufgabe ist es, höflich mit dem Kunden zu interagieren und seinen Namen, seine Verfügbarkeit und den gewünschten Service/die gewünschte Arbeit zu ermitteln. Stelle jeweils nur eine Frage. Frage nicht nach weiteren Kontaktinformationen und überprüfe nicht die Verfügbarkeit, gehe davon aus, dass wir frei sind. Stelle sicher, dass das Gespräch freundlich und professionell bleibt und führe den Benutzer dazu, diese Details natürlich bereitzustellen. Falls nötig, stelle Folgefragen, um die erforderlichen Informationen zu sammeln.

Aktuelle Informationen:
- Die Adresse des Salons lautet: Eddys HundeHaar Salon, Mühlenstraße 42, 22880 Wedel
- Öffnungszeiten: Dienstags bis Samstags von 10:00 bis 19:00 Uhr
- Du hilfst Eddy ein bisschen im Laden, weil er gerade eine schwierige Zeit mit seiner Scheidung durchmacht

Fakten:
- Eddy ist ein Hund und kann Deutsch sprechen
- Eddys Herrchen heißt Sidney
- Eddy freut sich immer riesig, wenn der Paketbote kommt, da er immer schöne Sachen bringt, wie zB Futter
- Eddy macht gerne Tricks mit seinem Herrchen: Er testet ob sein Herrchen die von ihm gestellten Aufgaben korrekt ausführt, bevor er das Leckerli freigibt

Der Kunde ruft an.
Du versuchst das Gespräch nach einer Minute zu beenden, da es sonst Eddys Systemadministrator Alex zu teuer wird.
Anrufdetails:
- Anrufnummer: ${session.meta.incomingCall.Caller}
- Land des Anrufers: ${session.meta.incomingCall.CallerCountry}
`;

const VOICE = "echo";

// Connection config
const PORT = process.env.PORT || 5050;
const WEBHOOK_URL = "https://lx0.app.n8n.cloud/webhook/call-completion";

// Session management
const sessions = new Map();

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

// ***************************************************************************

import * as readline from "readline";

class ConsoleLogger {
    lastCount = 0;
    lastLine = null;

    log(line, data) {
        if (this.lastLine === line) {
            this.lastCount++;
            this.replaceLastLine(`${line} (${this.lastCount})`);
        } else {
            if (this.lastCount > 0) {
                // Ensure the previous line is finalized
                console.log();
            }
            this.lastLine = line;
            this.lastCount = 0;
            console.log(
                line,
                util.inspect(data, {
                    depth: null,
                    colors: true,
                }),
            );
        }
    }

    // Overwrite the last line in the console
    replaceLastLine(text) {
        readline.clearLine(process.stdout, 0); // Clear the last line
        readline.cursorTo(process.stdout, 0); // Move cursor to the start of the line
        process.stdout.write(text); // Write the new content
    }
}

const logger = new ConsoleLogger();

const getDuration = (startTime) => {
    const duration = new Date().getTime() - startTime;
    const durationInSeconds = Math.floor(duration / 1000);

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = durationInSeconds % 60;

    const formattedHours = String(hours).padStart(2, "0");
    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(seconds).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};

// ***************************************************************************

// Root Route
fastify.get("/", async (request, reply) => {
    reply.send({ message: "Twilio Media Stream Server is running!" });
});

// Route for Twilio to handle incoming and outgoing calls
fastify.all("/incoming-call", async (request, reply) => {
    const requestBody = request.body;
    const incomingCall = omit(requestBody, ["CallToken"]);
    console.log(
        `Incoming call from (${incomingCall.CallerCountry}) ${incomingCall.Caller}`,
    );

    // console.log(`\\${encodeURIComponent(JSON.stringify(incomingCall))}`);

    // const connectionMessage = `<Say language="de-DE">Hallo?</Say>`;
    const connectionMessage = "";
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              ${connectionMessage}
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream">
                                      <Parameter name="incomingCall" value="\\${encodeURIComponent(JSON.stringify(incomingCall))}" />
                                  </Stream>
                              </Connect>
                          </Response>`;

    reply.type("text/xml").send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get("/media-stream", { websocket: true }, (connection, req) => {
        console.log(
            "Client connected",
            // util.inspect({ connection }, { depth: 3, colors: true }),
        );

        const now = Date.now();
        const sessionId = req.headers["x-twilio-call-sid"] || `session_${now}`;
        let session = sessions.get(sessionId) || {
            transcript: "",
            streamSid: null,
            meta: null,
            createdAt: now,
        };
        sessions.set(sessionId, session);

        const openAiWs = new WebSocket(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "OpenAI-Beta": "realtime=v1",
                },
            },
        );

        const sendSessionUpdate = () => {
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

            console.log(
                "Sending session update:",
                JSON.stringify(sessionUpdate),
            );
            openAiWs.send(JSON.stringify(sessionUpdate));
        };

        const sendInitiateConversation = () => {
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

            console.log(
                "Sending initiate conversation:",
                JSON.stringify(initiateConversation),
            );
            openAiWs.send(JSON.stringify(initiateConversation));
            openAiWs.send(JSON.stringify({ type: "response.create" }));
        };

        // Open event for OpenAI WebSocket
        openAiWs.on("open", () => {
            logger.log("Connected to the OpenAI Realtime API");
            setTimeout(sendSessionUpdate, 250);
            setTimeout(sendInitiateConversation, 500);
        });

        // Listen for messages from the OpenAI WebSocket
        openAiWs.on("message", (data) => {
            try {
                const response = JSON.parse(data);

                const timePrefix = `[${getDuration(session.createdAt)}]`;

                // Log received events
                if (!LOG_EVENT_TYPES_EXCLUDE.includes(response.type)) {
                    logger.log(
                        `Received event: ${response.type}`,
                        LOG_EVENT_TYPES.includes(response.type)
                            ? response
                            : undefined,
                    );
                }

                // User message transcription handling
                if (
                    response.type ===
                    "conversation.item.input_audio_transcription.completed"
                ) {
                    const userMessage = response.transcript.trim();

                    if (userMessage) {
                        session.transcript += `${timePrefix} User: ${userMessage}\n`;
                        logger.log(
                            `${timePrefix} User (${sessionId}): ${userMessage}`,
                        );
                    } else {
                        logger.log(
                            `${timePrefix} User audio transcript is blank`,
                        );
                    }
                }

                // Agent message handling
                if (response.type === "response.done") {
                    const agentMessage =
                        response.response.output[0]?.content?.find(
                            (content) => content.transcript,
                        )?.transcript;
                    if (agentMessage) {
                        session.transcript += `${timePrefix} Agent: ${agentMessage}\n`;
                        console.log(
                            `${timePrefix} Agent (${sessionId}): ${agentMessage}`,
                        );
                    } else {
                        console.log(`${timePrefix} Agent message not found`);
                    }
                }

                if (response.type === "session.updated") {
                    console.log("Session updated successfully:", response);
                }

                if (
                    response.type === "response.audio.delta" &&
                    response.delta
                ) {
                    const audioDelta = {
                        event: "media",
                        streamSid: session.streamSid,
                        media: {
                            payload: Buffer.from(
                                response.delta,
                                "base64",
                            ).toString("base64"),
                        },
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
            } catch (error) {
                console.error(
                    "Error processing OpenAI message:",
                    error,
                    "Raw message:",
                    data,
                );
            }
        });

        // Handle incoming messages from Twilio
        connection.on("message", (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case "media":
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: "input_audio_buffer.append",
                                audio: data.media.payload,
                            };

                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case "start":
                        session.streamSid = data.start.streamSid;
                        session.meta = {
                            streamSid: data.start.streamSid,
                            createdAt: session.createdAt,
                            incomingCall: JSON.parse(
                                decodeURIComponent(
                                    data.start.customParameters.incomingCall.slice(
                                        1,
                                    ),
                                ),
                            ),
                        };
                        console.log(
                            "Incoming stream has started",
                            session.streamSid,
                            session.meta,
                            // util.inspect(
                            //     { data },
                            //     { depth: null, colors: true },
                            // ),
                        );
                        break;
                    default:
                        console.log("Received non-media event:", data.event);
                        break;
                }
            } catch (error) {
                console.error(
                    "Error parsing message:",
                    error,
                    "Message:",
                    message,
                );
            }
        });

        // Handle connection close and log transcript
        connection.on("close", async () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log(`Client disconnected (${sessionId}).`);
            console.log("Full Transcript:");
            console.log(session.transcript);

            const parsedContent = await processTranscriptAndSend(
                session.transcript,
                sessionId,
                session.meta,
            );

            // Save transcript to a file
            const transcriptFilePath = `transcripts/${sessionId}.json`;
            fs.writeFileSync(
                transcriptFilePath,
                JSON.stringify(
                    {
                        sessionId,
                        streamSid: session.streamSid,
                        createdAt: session.createdAt,
                        meta: session.meta,
                        transcript: session.transcript,
                        parsedContent,
                    },
                    null,
                    2,
                ),
            );

            // Clean up the session
            sessions.delete(sessionId);
        });

        // Handle WebSocket close and errors
        openAiWs.on("close", () => {
            console.log("Disconnected from the OpenAI Realtime API");
        });

        openAiWs.on("error", (error) => {
            console.error("Error in the OpenAI WebSocket:", error);
        });
    });
});

fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});

// Function to make ChatGPT API completion call with structured outputs
async function makeChatGPTCompletion(transcript, sessionMeta = null) {
    console.log("Starting ChatGPT API call...");
    try {
        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o-2024-08-06",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Extract customer details: name, communication language, availability, and any special notes from the transcript. Reply in German.",
                        },
                        {
                            role: "user",
                            content: JSON.stringify({
                                transcript,
                                meta: sessionMeta,
                            }),
                        },
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "customer_details_extraction",
                            schema: {
                                type: "object",
                                properties: {
                                    customerName: { type: "string" },
                                    customerLanguage: { type: "string" },
                                    customerAvailability: { type: "string" },
                                    specialNotes: { type: "string" },
                                },
                                required: [
                                    "customerName",
                                    "customerLanguage",
                                    "customerAvailability",
                                    "specialNotes",
                                ],
                            },
                        },
                    },
                }),
            },
        );

        console.log("ChatGPT API response status:", response.status);
        const data = await response.json();
        // console.log(
        //     "Full ChatGPT API response:",
        //     JSON.stringify(data, null, 2),
        // );
        return data;
    } catch (error) {
        console.error("Error making ChatGPT completion call:", error);
        throw error;
    }
}

// Function to send data to Make.com webhook
async function sendToWebhook(payload) {
    console.log("Sending data to webhook:", JSON.stringify(payload, null, 2));
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        console.log("Webhook response status:", response.status);
        if (response.ok) {
            console.log("Data successfully sent to webhook.");
        } else {
            console.error(
                "Failed to send data to webhook:",
                response.statusText,
            );
        }
    } catch (error) {
        console.error("Error sending data to webhook:", error);
    }
}

// Main function to extract and send customer details
async function processTranscriptAndSend(
    transcript,
    sessionId = null,
    sessionMeta = null,
) {
    console.log(`Starting transcript processing for session ${sessionId}...`);
    try {
        // Make the ChatGPT completion call
        const result = await makeChatGPTCompletion(transcript);

        // console.log(
        //     "Raw result from ChatGPT:",
        //     JSON.stringify(result, null, 2),
        // );

        if (
            result.choices &&
            result.choices[0] &&
            result.choices[0].message &&
            result.choices[0].message.content
        ) {
            try {
                const parsedContent = JSON.parse(
                    result.choices[0].message.content,
                );
                // console.log(
                //     "Parsed content:",
                //     JSON.stringify(parsedContent, null, 2),
                // );

                if (parsedContent) {
                    // Send the parsed content directly to the webhook
                    await sendToWebhook({
                        sessionMeta,
                        parsedContent,
                        transcript: transcript.trim(),
                    });
                    console.log(
                        "Extracted and sent customer details:",
                        parsedContent,
                    );
                    return parsedContent;
                } else {
                    console.error(
                        "Unexpected JSON structure in ChatGPT response",
                    );
                }
            } catch (parseError) {
                console.error(
                    "Error parsing JSON from ChatGPT response:",
                    parseError,
                );
            }
        } else {
            console.error("Unexpected response structure from ChatGPT API");
        }
    } catch (error) {
        console.error("Error in processTranscriptAndSend:", error);
    }

    return null;
}
