import { CallSummarySchema, type CallSummary } from './types';
import { zodResponseFormat } from 'openai/helpers/zod';
import { pick } from 'lodash-es';
import { openai } from '../providers/openai';
import { RateLimitError } from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import { logger } from '../utils/console-logger';
import type { CallSession } from '../services/call-session';

dotenv.config(); // Load environment variables from .env

const loggerContext = 'CallSummary';

// Function to make ChatGPT API completion call with structured outputs
async function extractCallSummary(session: CallSession): Promise<CallSummary | null> {
    logger.log('Starting ChatGPT API call...', undefined, loggerContext);
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: 'gpt-4o-2024-08-06',
            messages: [
                {
                    role: 'system',
                    content:
                        'Create a call summary. Extract customer details: name, communication language, availability, and any special notes from the transcript. Reply in German.',
                },
                {
                    role: 'user',
                    content: JSON.stringify(
                        pick(session, ['createdAt', 'incomingCall', 'transcript'])
                    ),
                },
            ],
            response_format: zodResponseFormat(CallSummarySchema, 'call_summary'),
        });

        const message = completion.choices[0].message.parsed;

        logger.log('ChatGPT API response:', { message }, loggerContext);

        return message;
    } catch (error) {
        if (error instanceof RateLimitError) {
            logger.error(
                `Rate Limit Error. Current quota exceeded!`,
                undefined,
                undefined,
                loggerContext
            );
        } else {
            logger.error('Error making ChatGPT completion call:', error, undefined, loggerContext);
        }
        return null;
    }
}

// Function to send data to Make.com webhook
async function sendToWebhook(payload: {
    session: CallSession;
    callSummary: CallSummary;
}): Promise<boolean> {
    if (!process.env.WEBHOOK_URL) {
        logger.error('WEBHOOK_URL not defined', undefined, undefined, loggerContext);
        return false;
    }
    logger.log(
        'Sending data to webhook',
        undefined, // payload,
        loggerContext
    );
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
}

// Main function to extract and send customer details
export async function processTranscriptAndSend(session: CallSession): Promise<CallSummary | null> {
    logger.log(
        `Starting transcript processing for session ${session.id}...`,
        undefined,
        loggerContext
    );
    try {
        // Make the ChatGPT completion call
        const callSummary = await extractCallSummary(session);

        if (callSummary) {
            // Send the parsed content directly to the webhook
            const _webhookResponse = await sendToWebhook({
                session,
                callSummary,
            });
            logger.log('Extracted and sent customer details:', callSummary, loggerContext);
            return callSummary;
        } else {
            logger.error(
                'Unexpected response structure from ChatGPT API',
                undefined,
                undefined,
                loggerContext
            );
        }
    } catch (error) {
        logger.error('Error in processTranscriptAndSend:', error, undefined, loggerContext);
    }

    return null;
}
