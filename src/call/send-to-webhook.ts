import axios from 'axios';
import dotenv from 'dotenv';

import { logger } from '../utils/console-logger';
import type { CallSession } from '../services/call-session';

const loggerContext = 'Webhook';

dotenv.config(); // Load environment variables from .env

// Send data to webhook
export const sendToWebhook = async (payload: {
    session: CallSession;
    action: string;
}): Promise<boolean> => {
    if (!process.env.WEBHOOK_URL) {
        logger.error('WEBHOOK_URL not defined', undefined, undefined, loggerContext);
        return false;
    }
  
    try {
        const response = await axios.post(process.env.WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        logger.log(
            'Webhook response:',
            {
                status: response.status,
                data: response.data,
            },
            loggerContext
        );
        return true;
    } catch (error) {
        logger.error('Error sending data to webhook:', error, undefined, loggerContext);
    }
    return false;
};
