import axios from 'axios';
import dotenv from 'dotenv';
import { z } from 'zod';

import { type CallSession } from '@/services/call-session';
import { logger } from '@/utils/console-logger';
import { getMessageFromUnknownError } from '@/utils/errors';
import { stringify } from '@/utils/stringify';

const loggerContext = 'Webhook';

dotenv.config(); // Load environment variables from .env

interface WebhookAction {
  action: string;
  session: CallSession;
  parameters?: unknown;
}

interface WebhookActionResponse {
  action: string;
  status: number;
  message: string;
  response?: unknown;
}

type WebhookConnector = (
  payload: WebhookAction,
  schema?: z.ZodType
) => Promise<WebhookActionResponse>;

// Send data to webhook
export const sendToWebhook = (async (payload, schema?: z.ZodType) => {
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
    // call webhook
    logger.log(
      `Sending ${action} to webhook ${url}, payload ${stringify(payload)}`,
      { url },
      loggerContext
    );
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}`,
      },
    });
    logger.log(
      `Raw webhook response for ${action}: ${stringify(response.data)}`,
      { rawResponse: response.data },
      loggerContext
    );

    // handle empty response (remove empty objects from result array as n8n adds them when there is no result on db queries (e.g. postgres node))
    let responseData =
      response.data.status && 'response' in response.data ? response.data.response : response.data;
    if (responseData !== undefined && responseData !== null && Array.isArray(responseData)) {
      responseData = responseData.filter(
        (r: unknown) =>
          r !== undefined && r !== null && typeof r === 'object' && Object.keys(r).length > 0
      );
    }

    // parse response
    const webhookResponse = {
      action,
      status: response.data.status ?? response.status,
      message: response.data.message ?? response.statusText,
      ...(schema && {
        response: schema.parse(responseData),
      }),
    };

    const executionTime = Date.now() - startTime;
    logger.log(`Webhook response for ${action}`, webhookResponse, loggerContext, executionTime);

    return webhookResponse;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const errorMessage = getMessageFromUnknownError(error);
    logger.error(
      `Error sending data to webhook: ${stringify(errorMessage)}`,
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
    throw new Error(`Error sending data to webhook: ${stringify(errorMessage)}`);
  }
}) as WebhookConnector;
