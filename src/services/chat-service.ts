import dotenv from 'dotenv';
import type { FastifyReply, FastifyRequest } from 'fastify';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources';

import {
  ERROR_MESSAGE,
  getConversationEndingMessage,
  getInitialMessage,
  getSystemMessage,
} from '@/call/agent/agent';
import { type AgentFunction } from '@/call/agent/tools';
import { convertAgentFunctionToParseableTool } from '@/call/agent/utils/convert-agent-function';
import { callTool, getToolsAsChatCompletionTools } from '@/call/agent/utils/get-tool';
import { type CallSession, CallSessionService } from '@/services/call-session';
import { sendToWebhook } from '@/services/send-to-webhook';
import { testSession } from '@/testdata/session.data';
import { logger } from '@/utils/console-logger';

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

export const convertAgentFunctionToCompletionTool = (tool: AgentFunction): ChatCompletionTool => {
  const parseableTool = convertAgentFunctionToParseableTool(tool);
  return {
    type: 'function',
    function: {
      name: tool.name,
      parameters: parseableTool.function.parameters ?? {},
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
        const memory = await sendToWebhook({
          action: 'read_memory',
          session,
        }).then((memory) => {
          // logger.log('Memory read', { memory }, loggerContext);
          if (memory.action !== 'read_memory' || !Array.isArray(memory.response)) return [];
          return memory.response;
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
        const callSummaryResponse = await sendToWebhook({
          session,
          action: 'call_summary',
        });
        updatedHistory.push({
          role: 'user',
          content: JSON.stringify(callSummaryResponse),
          isHiddenMessage: true,
        });
      }
    }
    if (message) {
      CallSessionService.addUserTranscript(session, message);
      updatedHistory.push({ role: 'user', content: message });
    }
    const tools = getToolsAsChatCompletionTools();

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
  session: CallSession
) => {
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
      }
    }

    // logger.log('Updated History', { updatedHistory }, loggerContext);

    await getAssistantResponse(updatedHistory, tools, session);
  }
};
