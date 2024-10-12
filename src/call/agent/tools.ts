import type { ToolDefinitionType } from '@openai/realtime-api-beta/dist/lib/client';
import type { RealtimeClient } from '@openai/realtime-api-beta';
import axios from 'axios';

import TurndownService from 'turndown';
import * as cheerio from 'cheerio';

import type { CallSession } from '../types';
import { KeyValueStoreService } from '../../services/key-value-store/key-value-store.service';
import { APP_CLIENT_ID } from '../../config/appClientId';
import { logger } from '../../utils/console-logger';

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

export const getMessageFromUnknownError = (error: unknown): string =>
  axios.isAxiosError(error)
    ? error.response?.data || error.message
    : error instanceof Error
      ? error.message
      : error;

export interface FunctionCallTool {
  definition: ToolDefinitionType;
  handler: (openAIRealtimeClient: RealtimeClient, session: CallSession) => Function;
}

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
          const keyValueService = new KeyValueStoreService(APP_CLIENT_ID);
          keyValueService.setKeyValue(key, value, session.userId);
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
          const keyValueService = new KeyValueStoreService(APP_CLIENT_ID);
          keyValueService.deleteKey(key, session.userId);
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
