import { FastifyRequest } from "fastify";
import { type CallSession } from "./types";
import { getOpenAIRealtimeWs } from "../providers/openai";
import {
  handleOpenAIRealtimeWsOpen,
  handleOpenAIRealtimeWsClose,
  handleOpenAIRealtimeWsError,
  handleOpenAIMessage,
} from "./openai-realtime";
import { handleTwilioMessage, handleTwilioWsClose } from "./twilio-message";
import WebSocket from "ws";
import { logger } from "../utils/console-logger";

const loggerContext = "MediaStream";

export const handleMediaStream = (
  twilioWs: WebSocket,
  req: FastifyRequest,
  sessions: Map<string, CallSession>,
) => {
  logger.log(
    "Client connected",
    // util.inspect({ connection }, { depth: 3, colors: true }),
    undefined,
    loggerContext,
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

  const openAIRealtimeWs = getOpenAIRealtimeWs();

  // Open event for OpenAI WebSocket
  openAIRealtimeWs.on("open", () =>
    handleOpenAIRealtimeWsOpen(openAIRealtimeWs, session),
  );

  // Listen for messages from the OpenAI WebSocket
  openAIRealtimeWs.on("message", (data, isBinary) =>
    handleOpenAIMessage(data, isBinary, session, twilioWs),
  );

  // Handle WebSocket close and errors
  openAIRealtimeWs.on("close", handleOpenAIRealtimeWsClose);
  openAIRealtimeWs.on("error", handleOpenAIRealtimeWsError);

  // Handle incoming messages from Twilio
  twilioWs.on("message", (data) =>
    handleTwilioMessage(data, session, openAIRealtimeWs),
  );

  // Handle connection close and log transcript
  twilioWs.on("close", () =>
    handleTwilioWsClose(openAIRealtimeWs, session, sessions),
  );

  twilioWs.on("error", async (error) => {
    logger.error("Error in Twilio WebSocket:", error, undefined, loggerContext);

    // Close the WebSocket connection
    twilioWs.close();
  });
};
