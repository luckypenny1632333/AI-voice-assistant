import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

export const ENV_IS_DEPLOYED = process.env.REPLIT_DEPLOYMENT === '1';

export const PORT = parseInt(process.env.PORT ?? '3000');
