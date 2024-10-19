import { z } from 'zod';

import { logger } from '@/utils/console-logger';
import { getMessageFromUnknownError } from '@/utils/errors';

const loggerContext = 'Tools';

export async function onTool(args: unknown, handler: any, errorMessage?: string) {
  try {
    return (await handler(args)) ?? { success: true };
  } catch (error: unknown) {
    const errorMessageFromError = getMessageFromUnknownError(error);
    logger.error(
      'Error handling tool:',
      errorMessageFromError,
      typeof args === 'object' &&
        args !== null &&
        !Array.isArray(args) &&
        Object.keys(args).length > 0
        ? (args as Record<string, unknown>)
        : undefined,
      loggerContext
    );
    return {
      success: false,
      error: errorMessage ?? `Error handling tool: ${errorMessageFromError}`,
    };
  }
}

interface BaseFunction<
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> {
  type: 'call' | 'webhook';
  name: string;
  isHidden?: boolean;
  description?: string | undefined;
  parameters?: Parameters;
  response?: Response;
  function:
    | ((args: z.infer<Parameters>) => z.infer<Response> | Promise<z.infer<Response>>)
    | undefined;
  onCall?: ((args: z.infer<Parameters>) => unknown | Promise<unknown>) | undefined;
  onComplete?: ((args: z.infer<Response>) => unknown | Promise<unknown>) | undefined;
}

interface CallFunction<
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> extends BaseFunction<Parameters, Response> {
  type: 'call';
}

interface WebhookFunction<
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> extends Omit<BaseFunction<Parameters, Response>, 'function'> {
  type: 'webhook';
}

export type AgentFunction = CallFunction | WebhookFunction;

type ToolsConfig = Record<string, AgentFunction>;
export const TOOLS = {
  call_summary: {
    type: 'webhook',
    isHidden: true,
    name: 'call_summary',
    description: 'returns a summary of the call',
    response: z.object({
      customerName: z.string(),
      customerLanguage: z.string().describe('The language the customer spoke in'),
      customerAvailability: z.string(),
      specialNotes: z.string(),
    }),
  },
  read_memory: {
    type: 'webhook',
    name: 'read_memory',
    description: 'returns the memory of the agent for the caller',
    parameters: z.object({
      key: z.string().optional().describe('Optionally specify a key to read from the memory'),
    }),
    response: z.array(z.object({ key: z.string(), value: z.string() })),
  },
  add_memory: {
    type: 'webhook',
    name: 'add_memory',
    description: 'Adds a key-value pair to the memory',
    parameters: z.object({
      key: z.string(),
      value: z.string(),
    }),
  },
  remove_memory: {
    type: 'webhook',
    name: 'remove_memory',
    description: 'Removes a key-value pair from the memory',
    parameters: z.object({
      key: z.string(),
    }),
  },
  calendar_check_availability: {
    type: 'webhook',
    name: 'calendar_check_availability',
    description:
      "Checks the availability of a calendar. Checks if an appointment is available from 'startAt' to 'endAt'.",
    parameters: z.object({
      startAt: z.string().describe('The start date and time of the availability check'),
      endAt: z.string().describe('The end date and time of the availability check'),
    }),
    response: z.object({
      available: z.boolean().describe('Whether the calendar is available'),
    }),
  },
  calendar_create_appointment: {
    type: 'webhook',
    name: 'calendar_create_appointment',
    description: 'Creates an appointment in a calendar',
    parameters: z.object({
      startAt: z.string().describe('The start date and time of the appointment'),
      endAt: z.string().describe('The end date and time of the appointment'),
      title: z
        .string()
        .describe(
          'The title of the appointment. Please include requested service title and customer name.'
        ),
      description: z
        .string()
        .describe(
          'The detailed description of the appointment. Please include call details, detailed contact information (e.g. caller number, name), requested service information and any other relevant information.'
        ),
    }),
  },
  web_scraper: {
    type: 'webhook',
    name: 'web_scraper',
    description: 'Scrapes a website for information',
    parameters: z.object({
      url: z.string().describe('The URL of the website to scrape'),
      mode: z
        .enum(['text', 'print', 'article', 'source', 'screenshot'])
        .default('text')
        .describe('The mode of the scraping. Default: text.'),
    }),
    response: z.object({
      content: z.string().describe('The scraped content'),
    }),
  },
} satisfies ToolsConfig;

export type ToolTypes = (typeof TOOLS)[keyof typeof TOOLS];
