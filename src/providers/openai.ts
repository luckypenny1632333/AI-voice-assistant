import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from '../utils/console-logger';

const loggerContext = 'OpenAI';

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

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});
