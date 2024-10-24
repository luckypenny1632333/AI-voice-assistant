import { z } from 'zod';

import { endCall } from '@/providers/twilio';
import { logger } from '@/utils/console-logger';

import type { AppDataType } from './agent';
import type { ToolsConfig } from './types';

const loggerContext = 'Tools';

export const TOOLS = {
  end_call: {
    type: 'call',
    name: 'end_call',
    description: 'Ends the current call.',
    function: (args: unknown, { session }: AppDataType) => {
      // disconnect call
      if (session.incomingCall?.CallSid) {
        endCall(session.incomingCall.CallSid, session.incomingCall.CallerCountry)
          .then(() => {
            logger.log(`Call ${session.incomingCall?.CallSid} ended`, undefined, loggerContext);
          })
          .catch((err) => logger.error('Error ending call', err, undefined, loggerContext));
      }
    },
  },
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
    response: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
        isGlobal: z
          .boolean()
          .optional()
          .describe('Whether the memory is global for all users/customers'),
      })
    ),
  },
  add_memory: {
    type: 'webhook',
    name: 'add_memory',
    description: 'Adds a key-value pair to the memory',
    parameters: z.object({
      key: z.string(),
      value: z.string(),
      isGlobal: z
        .boolean()
        .optional()
        .describe(
          'Whether the memory is global for all users/customers. Default: false. Warning: Use with caution!'
        ),
    }),
  },
  remove_memory: {
    type: 'webhook',
    name: 'remove_memory',
    description: 'Removes a key-value pair from the memory',
    parameters: z.object({
      key: z.string(),
      isGlobal: z
        .boolean()
        .optional()
        .describe(
          'Whether the key to be removed is global for all users/customers. Default: false. Warning: Use with caution!'
        ),
    }),
  },
  calendar_check_availability: {
    type: 'webhook',
    name: 'calendar_check_availability',
    description:
      "Checks the availability of the calendar. Checks if an appointment is available from 'startAt' to 'endAt'.",
    parameters: z.object({
      startAt: z.string().describe('The start date and time of the availability check'),
      endAt: z.string().describe('The end date and time of the availability check'),
    }),
    response: z.object({
      available: z.boolean().describe('Whether the calendar is available'),
    }),
  },
  calendar_schedule_appointment: {
    type: 'webhook',
    name: 'calendar_schedule_appointment',
    description: 'Schedules an appointment in the calendar',
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
  calendar_get_user_appointments: {
    type: 'webhook',
    name: 'calendar_get_user_appointments',
    description: 'Returns all appointments for the user',
    response: z.array(
      z.object({
        id: z.string(),
        status: z.enum(['confirmed', 'tentative', 'cancelled']),
        summary: z.string(),
        description: z.string(),
        start: z.object({ dateTime: z.string(), timeZone: z.string() }),
        end: z.object({ dateTime: z.string(), timeZone: z.string() }),
      })
    ),
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
} satisfies ToolsConfig<AppDataType>;
