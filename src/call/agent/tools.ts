import type { RealtimeClient } from '@openai/realtime-api-beta';
import type { ToolDefinitionType } from '@openai/realtime-api-beta/dist/lib/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { z } from 'zod';

import { type CallSession } from '@/services/call-session';
import { getStoreBySession } from '@/services/key-value-store';
import { logger } from '@/utils/console-logger';
import { getMessageFromUnknownError } from '@/utils/errors';

const loggerContext = 'Tools';

async function onTool(args: unknown, handler: any, errorMessage?: string) {
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

/** @obsolete */
export interface FunctionCallTool {
  definition: ToolDefinitionType;
  handler: (openAIRealtimeClient: RealtimeClient, session: CallSession) => Function;
}

/** @obsolete */
export const agentTools: Array<FunctionCallTool> = [
  // Set Memory
  {
    definition: {
      name: 'set_memory',
      description: 'Saves important data about the user into memory.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description:
              'The key of the memory value. Always use lowercase and underscores, no other characters.',
          },
          value: {
            type: 'string',
            description: 'Value can be anything represented as a string',
          },
        },
        required: ['key', 'value'],
      },
    },
    handler: (openAIRealtimeClient, session) => (args: unknown) =>
      onTool(
        args,
        ({ key, value }: { [key: string]: any }) => {
          getStoreBySession(session).setKeyValue(key, value);
          return { success: true };
        },
        'Error setting memory'
      ),
  },
  // Remove Memory
  {
    definition: {
      name: 'remove_memory',
      description: 'Removes data from the memory.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description:
              'The key of the memory value to be removed. Always use lowercase and underscores, no other characters.',
          },
        },
        required: ['key'],
      },
    },
    handler: (openAIRealtimeClient, session) => (args: unknown) =>
      onTool(
        args,
        ({ key }: { key: string }) => {
          getStoreBySession(session).deleteKey(key);
          return { success: true };
        },
        'Error removing memory'
      ),
  },
  // Get Weather
  {
    definition: {
      name: 'get_weather',
      description:
        'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
      parameters: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            description: 'Latitude',
          },
          lng: {
            type: 'number',
            description: 'Longitude',
          },
          location: {
            type: 'string',
            description: 'Name of the location',
          },
        },
        required: ['lat', 'lng', 'location'],
      },
    },
    handler: (openAIRealtimeClient, session) => (args: unknown) =>
      onTool(
        args,
        async ({ lat, lng, location }: { [key: string]: any }) => {
          const result = await axios.get(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
          );
          const json = result.data;
          const temperature = {
            value: json.current.temperature_2m as number,
            units: json.current_units.temperature_2m as string,
          };
          const wind_speed = {
            value: json.current.wind_speed_10m as number,
            units: json.current_units.wind_speed_10m as string,
          };
          logger.log('Tool: Weather', json, loggerContext);
          return { success: true, result: json };
        },
        'Error getting weather'
      ),
  },
  // Wikipedia Search
  {
    definition: {
      name: 'wikipedia_search',
      description:
        'Searches Wikipedia for information based on the given query and returns a list of relevant search results.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on Wikipedia.',
          },
          language: {
            type: 'string',
            description:
              'The language code to use for Wikipedia search (e.g., en, de, fr). Defaults to en.',
          },
        },
        required: ['query'],
      },
    },
    handler: (openAIRealtimeClient, session) => (args: unknown) =>
      onTool(
        args,
        async ({ query, language = 'en' }: { query: string; language?: string }) => {
          const response = await axios.get(
            `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
          );
          const data = response.data;
          const searchResults = data?.query?.search?.map((result: any) => {
            return {
              title: result.title,
              snippet: result.snippet.replace(/<[^>]*>?/gm, ''), // Remove HTML tags from snippet
              pageid: result.pageid,
              url: `https://${language}.wikipedia.org/?curid=${result.pageid}`,
            };
          });

          return searchResults && searchResults.length > 0
            ? { ok: true, searchResults }
            : { ok: false, message: 'No search results found' };
        },
        'Error searching Wikipedia'
      ),
  },
  // webpage_scrape
  {
    definition: {
      name: 'webpage_scrape',
      description:
        'Scrapes the content of a given webpage URL and returns the main text content converted to Markdown, useful for reading and understanding the content of web articles.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the webpage to scrape.',
          },
        },
        required: ['url'],
      },
    },
    handler: (openAIRealtimeClient, session) => (args: unknown) =>
      onTool(
        args,
        async ({ url }: { url: string }) => {
          const response = await axios.get(url);
          if (!response.data) {
            throw new Error(`Failed to fetch webpage: ${response.statusText}`);
          }
          const htmlContent = response.data;

          if (!htmlContent.trim()) {
            return {
              ok: false,
              message: 'No text content found on the webpage',
            };
          }

          // Use Cheerio to parse and manipulate the HTML content
          const $ = cheerio.load(htmlContent);

          // Remove script, style, and other non-readable elements
          $(
            'script, style, noscript, iframe, header, footer, nav, aside, form, link, meta'
          ).remove();

          // Get the cleaned HTML content
          const cleanedHtmlContent = $('body').html() || '';

          // Convert cleaned HTML to Markdown
          const turndownService = new TurndownService();
          const markdownContent = turndownService.turndown(cleanedHtmlContent);

          logger.log('', { markdownContent }, loggerContext);

          return { ok: true, markdownContent };
        },
        'Error scraping webpage'
      ),
  },
];

interface AgentFunction<
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> {
  name: string;
  description?: string | undefined;
  parameters?: Parameters;
  response?: Response;
  function:
    | ((args: z.infer<Parameters>) => z.infer<Response> | Promise<z.infer<Response>>)
    | undefined;
  onCall?: ((args: z.infer<Parameters>) => unknown | Promise<unknown>) | undefined;
  onComplete?: ((args: z.infer<Response>) => unknown | Promise<unknown>) | undefined;
}

//

interface WebhookFunction extends Omit<AgentFunction, 'function'> {}

type ToolsConfig = Record<string, AgentFunction | WebhookFunction>;
const TOOLS = {
  call_summary: {
    name: 'call_summary' as const,
    description: 'returns a summary of the call',
    response: z.object({
      customerName: z.string(),
      customerLanguage: z.string().describe('The language the customer spoke in'),
      customerAvailability: z.string(),
      specialNotes: z.string(),
    }),
  },
  add_memory: {
    name: 'add_memory' as const,
    description: 'Adds a key-value pair to the memory',
    parameters: z.object({
      key: z.string(),
      value: z.string(),
    }),
  },
  remove_memory: {
    name: 'remove_memory' as const,
    description: 'Removes a key-value pair from the memory',
    parameters: z.object({
      key: z.string(),
    }),
  },
  calendar_check_availability: {
    name: 'calendar_check_availability' as const,
    description: 'Checks the availability of a calendar',
    parameters: z.object({
      startAt: z.string().describe('The start date and time of the availability check'),
      endAt: z.string().describe('The end date and time of the availability check'),
    }),
  },
  calendar_create_event: {
    name: 'calendar_create_event' as const,
    description: 'Creates an event in a calendar',
    parameters: z.object({
      startAt: z.string().describe('The start date and time of the event'),
      endAt: z.string().describe('The end date and time of the event'),
    }),
  },
} as const satisfies ToolsConfig;
// import { zodFunction, zodParseJSON, zodResponseFormat } from 'openai/helpers/zod';
//   parameters: zodToJsonSchema(SearchParams),
//   parse: zodParseJSON(SearchParams),

type ToolTypes = (typeof TOOLS)[keyof typeof TOOLS];
