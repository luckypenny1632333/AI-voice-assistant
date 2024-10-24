import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod';

import { logger } from '@/utils/console-logger';
import { getMessageFromUnknownError } from '@/utils/errors';

import type { AgentFunction, CallFunction, ToolsConfig } from './types';

const loggerContext = 'AgentClass';

export class Agent<AppData extends {} = {}> {
  constructor(private readonly tools: ToolsConfig<AppData>) {}

  static callFunction<A extends {} = {}>(tool: CallFunction<A>, app: A, args?: unknown) {
    return Agent.onTool(args, app, tool.function);
  }

  static async onTool<A extends {} = {}>(
    args: unknown,
    app: A,
    handler: (args: unknown, app: A) => Promise<unknown>,
    errorMessage?: string
  ) {
    try {
      return (await handler(args, app)) ?? { success: true };
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

  getTools() {
    return Object.values(this.tools);
  }

  getTool(name: string) {
    return this.tools[name];
  }

  getToolResponseSchema(name: string) {
    // get tool
    const tool = this.getTool(name);
    if (!tool || name !== tool.name) {
      throw new Error(`Tool ${name} not found`);
    }

    return tool.response;
  }

  static parseToolArguments<A extends {} = {}>(tool: AgentFunction<A>, args: unknown) {
    return 'parameters' in tool && tool.parameters ? tool.parameters.parse(args) : {};
  }

  static getToolParameters<A extends {} = {}>(tool: AgentFunction<A>) {
    return zodFunction({
      name: tool.name,
      parameters: 'parameters' in tool && tool.parameters ? tool.parameters : z.object({}),
    }).function.parameters;
  }
}
