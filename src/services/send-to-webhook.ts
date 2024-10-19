import axios from 'axios';
import dotenv from 'dotenv';
import { z } from 'zod';

import { TOOLS, type ToolTypes } from '@/call/agent/tools';
import { type CallSession } from '@/services/call-session';
import { logger } from '@/utils/console-logger';
import { getMessageFromUnknownError } from '@/utils/errors';

const loggerContext = 'Webhook';

dotenv.config(); // Load environment variables from .env

interface WebhookAction<F extends ToolTypes> {
  action: string;
  session: CallSession;
  parameters?: F extends { parameters: z.ZodType } ? z.infer<F['parameters']> : undefined;
}

interface WebhookActionResponse<F extends ToolTypes> {
  action: string;
  status: number;
  message: string;
  response?: F extends { response: z.ZodType } ? z.infer<F['response']> : undefined;
}

type WebhookConnector = <F extends ToolTypes>(
  payload: WebhookAction<F>
) => Promise<WebhookActionResponse<F>>;

// Send data to webhook
export const sendToWebhook = (async (payload) => {
  const { action } = payload;
  const startTime = Date.now();

  if (!process.env.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL not defined');
  }
  if (!process.env.WEBHOOK_TOKEN) {
    throw new Error('WEBHOOK_TOKEN not defined');
  }

  const url = process.env.WEBHOOK_URL;

  try {
    // get tool
    const tool = Object.values(TOOLS).find((tool) => tool.name === action);
    if (!tool || action !== tool.name) {
      throw new Error(`Tool ${action} not found`);
    }

    // call webhook
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}`,
      },
    });
    logger.log('Raw webhook response', { rawResponse: response.data }, loggerContext);

    // parse response
    const webhookResponse = {
      action,
      status: response.data.status ?? response.status,
      message: response.data.message ?? response.statusText,
      ...('response' in tool && {
        response: tool.response.parse(
          response.data.status && 'response' in response.data
            ? response.data.response
            : response.data
        ),
      }),
    };

    const executionTime = Date.now() - startTime;
    logger.log(`Webhook response for ${action}`, webhookResponse, loggerContext, executionTime);

    return webhookResponse;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const errorMessage = getMessageFromUnknownError(error);
    logger.error(
      'Error sending data to webhook',
      errorMessage,
      {
        url,
        action,
        error: {
          ...error,
          request: undefined, // request: error?.request,
          response: { ...error?.response, request: undefined, data: error?.response?.data },
        },
      },
      loggerContext,
      executionTime
    );
    throw new Error(`Error sending data to webhook: ${errorMessage}`);
  }
}) as WebhookConnector;
