import dotenv from 'dotenv';
import type { FastifyReply, FastifyRequest } from 'fastify';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources';

import { Agent, agent } from '@/agent';
import {
  ERROR_MESSAGE,
  getConversationEndingMessage,
  getInitialMessage,
  getSystemMessage,
} from '@/agent/agent';
import type { AgentFunction } from '@/agent/types';
import { type CallSession, CallSessionService } from '@/services/call-session';
import { sendToWebhook } from '@/services/send-to-webhook';
import { testSession } from '@/testdata/session.data';
import { logger } from '@/utils/console-logger';
import { stringify } from '@/utils/stringify';

dotenv.config(); // Load environment variables from .env

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

const loggerContext = 'ChatService';

// Add a new type for our special messages
type SpecialMessage = ChatMessage & {
  isHiddenMessage?: boolean;
};

export const convertAgentFunctionToCompletionTool = <AppData extends {} = {}>(
  tool: AgentFunction<AppData>
): ChatCompletionTool => {
  return {
    type: 'function',
    function: {
      name: tool.name,
      parameters: Agent.getToolParameters(tool) ?? {},
      strict: true,
      ...(tool.description ? { description: tool.description } : undefined),
    },
  };
};

export const serveChat = async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.sendFile('index.html');
};

export const handleChat = async (request: FastifyRequest, reply: FastifyReply) => {
  const { message, history, command } = request.body as {
    message: string;
    history: SpecialMessage[];
    command: string;
  };

  if (!message && !command && history.length > 0) {
    reply.code(400).send({ error: 'Message is required' });
    return;
  }

  try {
    const response = await handleChatMessage(message, history, command, testSession); // TODO: replace with proper session object
    reply.send({ response });
  } catch (error) {
    logger.error('Error processing chat message:', error, undefined, loggerContext);
    reply.code(500).send({ error: 'Internal server error' });
  }
};

export async function handleChatMessage(
  message: string,
  history: SpecialMessage[],
  command = '',
  session: CallSession
): Promise<SpecialMessage[]> {
  const updatedHistory: SpecialMessage[] = [...history];
  try {
    if (!message) {
      if (history.length === 0) {
        // set initial message
        logger.log(`Setting initial message`, undefined, loggerContext);
        const memory = await sendToWebhook(
          {
            action: 'read_memory',
            session,
          },
          agent.getToolResponseSchema('read_memory')
        ).then((memory) => {
          logger.log(`Memory read: ${stringify(memory)}`, { memory }, loggerContext);
          if (memory.action !== 'read_memory' || !Array.isArray(memory.response)) return [];
          return memory.response as { key: string; value: string; isGlobal?: boolean }[];
        });
        updatedHistory.push({ role: 'system', content: getSystemMessage(session) });
        updatedHistory.push({
          role: 'user',
          content: getInitialMessage(memory, session),
          isHiddenMessage: true,
        });
      } else if (command === 'end_conversation') {
        // command: end conversation
        updatedHistory.push({
          role: 'user',
          content: getConversationEndingMessage(session),
          isHiddenMessage: true,
        });
        const callSummaryResponse = await sendToWebhook(
          {
            session,
            action: 'call_summary',
          },
          agent.getToolResponseSchema('call_summary')
        );
        updatedHistory.push({
          role: 'user',
          content: stringify(callSummaryResponse),
          isHiddenMessage: true,
        });
      }
    }
    if (message) {
      CallSessionService.addUserTranscript(session, message);
      updatedHistory.push({ role: 'user', content: message });
    }
    const tools = getToolsAsChatCompletionTools();
    tools.push();

    await getAssistantResponse(updatedHistory, tools, session);

    return updatedHistory;
  } catch (error) {
    logger.error(
      'Error in chat service',
      error,
      { message, history, command, session },
      loggerContext
    );
    addAssistantErrorResponse(updatedHistory, session);
    return updatedHistory;
  }
}

const addAssistantErrorResponse = (updatedHistory: SpecialMessage[], session: CallSession) => {
  CallSessionService.addAgentTranscript(session, ERROR_MESSAGE);
  updatedHistory.push({ role: 'assistant', content: ERROR_MESSAGE });
};

const getAssistantResponse = async (
  updatedHistory: SpecialMessage[],
  tools: ChatCompletionTool[],
  session: CallSession,
  retryCount = 0,
  maxRetries = 3
) => {
  if (retryCount >= maxRetries) {
    logger.error('Max retries reached for assistant response', undefined, undefined, loggerContext);
    addAssistantErrorResponse(updatedHistory, session);
    return;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: updatedHistory,
    tools,
    tool_choice: 'auto',
  });
  const assistantResponse = response.choices[0].message;

  CallSessionService.addAgentTranscript(session, assistantResponse.content ?? '');
  updatedHistory.push(assistantResponse as SpecialMessage);

  if (assistantResponse.tool_calls && assistantResponse.tool_calls.length > 0) {
    for (const toolCall of assistantResponse.tool_calls) {
      try {
        const functionResultMessage = await callTool(toolCall, session);
        updatedHistory.push(functionResultMessage);
      } catch (error) {
        logger.error('Error in tool call', error, { toolCall }, loggerContext);
        addAssistantErrorResponse(updatedHistory, session);
        return; // Stop the loop if there's an error
      }
    }

    // logger.log('Updated History', { updatedHistory }, loggerContext);

    await getAssistantResponse(updatedHistory, tools, session, retryCount + 1, maxRetries);
  }
};

export const getToolsAsChatCompletionTools = () => {
  return agent
    .getTools()
    .filter((t) => !('isHidden' in t) || ('isHidden' in t && t.isHidden))
    .map((tool) => convertAgentFunctionToCompletionTool(tool));
};

export const callTool = async (
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  session: CallSession
): Promise<OpenAI.Chat.ChatCompletionMessageParam> => {
  const functionName = toolCall.function.name;
  const functionArgs = JSON.parse(toolCall.function.arguments);
  const tool = agent.getTool(functionName);
  if (!tool) {
    return {
      role: 'tool',
      content: stringify({ error: `Tool ${functionName} not found` }),
      tool_call_id: toolCall.id,
    };
  }

  try {
    let functionResult;
    if (tool.type === 'webhook') {
      functionResult = await sendToWebhook(
        {
          action: tool.name,
          session,
          parameters: Agent.parseToolArguments(tool, functionArgs),
        },
        tool.response
      );
    } else if (tool.type === 'call') {
      functionResult = await Agent.callFunction(
        tool,
        {
          session,
        },
        functionArgs
      );
    }

    return {
      role: 'tool',
      content: stringify(functionResult),
      tool_call_id: toolCall.id,
    };
  } catch (error) {
    logger.error(`Error calling tool ${functionName}:`, error, undefined, loggerContext);
    return {
      role: 'tool',
      content: stringify({ error: `Error calling tool ${functionName}` }),
      tool_call_id: toolCall.id,
    };
  }
};
