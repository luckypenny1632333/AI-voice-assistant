import Fastify from "fastify";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import {
    handleOpenAiWsOpen,
    handleOpenAIMessage,
    handleTwilioMessage,
    handleTwilioWsClose,
    handleIncomingCall,
    type CallSession,
} from "./call";
import { getOpenAiWs } from "./providers/openai";
import { logger } from "./utils/console-logger";

// Load environment variables from .env file
dotenv.config();

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Session management
const sessions = new Map<string, CallSession>();

// Route for Twilio to handle incoming and outgoing calls
fastify.all("/incoming-call", handleIncomingCall);

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get("/media-stream", { websocket: true }, (twilioWs, req) => {
        logger.log(
            "Client connected",
            // util.inspect({ connection }, { depth: 3, colors: true }),
        );

        const now = Date.now();
        const sessionId =
            [req.headers["x-twilio-call-sid"]].flat()[0] || `session_${now}`;
        const session: CallSession = sessions.get(sessionId) || {
            id: sessionId,
            createdAt: now,
            transcript: "",
        };
        sessions.set(sessionId, session);

        const openAiWs = getOpenAiWs();

        // Open event for OpenAI WebSocket
        openAiWs.on("open", () => handleOpenAiWsOpen(openAiWs, session));

        // Listen for messages from the OpenAI WebSocket
        openAiWs.on("message", (data) =>
            handleOpenAIMessage(data, session, twilioWs),
        );

        // Handle WebSocket close and errors
        openAiWs.on("close", () => {
            logger.log("Disconnected from the OpenAI Realtime API");
        });
        openAiWs.on("error", (error) => {
            logger.error("Error in the OpenAI WebSocket:", error);
        });

        // Handle incoming messages from Twilio
        twilioWs.on("message", (data) =>
            handleTwilioMessage(data, session, openAiWs),
        );

        // Handle connection close and log transcript
        twilioWs.on("close", () =>
            handleTwilioWsClose(openAiWs, session, sessions),
        );
    });
});

// Root Route
fastify.get("/", async (_request, reply) => {
    reply.send({ message: "Twilio Media Stream Server is running!" });
});

const PORT = Number(process.env.PORT) ?? 3000;
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        logger.error("Error", err);
        process.exit(1);
    }
    logger.log(`Server is listening on port ${PORT}`);
});
