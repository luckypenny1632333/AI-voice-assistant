import dotenv from "dotenv";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { logger } from "../utils/console-logger";

const loggerContext = "OpenAI";

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  logger.error(
    "Missing OpenAI API key. Please set it in the .env file.",
    undefined,
    undefined,
    loggerContext,
  );
  process.exit(1);
}

export const openAIRealtimeClient = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
});

// export const getOpenAIRealtimeWs = () =>
//   new WebSocket(
//     "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
//     {
//       headers: {
//         Authorization: `Bearer ${OPENAI_API_KEY}`,
//         "OpenAI-Beta": "realtime=v1",
//       },
//     },
//   );
