import { RealtimeClient } from '@openai/realtime-api-beta';
import dotenv from 'dotenv';

import { logger } from '@/utils/console-logger';

const loggerContext = 'OpenAI';

const DEBUG_OPENAI_REALTIME_API = false;

dotenv.config(); // Load environment variables from .env

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  logger.error(
    'Missing OpenAI API key. Please set it in the .env file.',
    undefined,
    undefined,
    loggerContext
  );
  process.exit(1);
}

export const openAIRealtimeClient = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
  debug: DEBUG_OPENAI_REALTIME_API,
});
