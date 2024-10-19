import dotenv from 'dotenv';
import type { FastifyReply, FastifyRequest } from 'fastify';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources';

import {
  getConversationEndingMessage,
  getInitialMessage,
  getSystemMessage,
} from '@/call/agent/agent';
import { type AgentFunction, TOOLS, onTool } from '@/call/agent/tools';
import { convertAgentFunctionToParseableTool } from '@/call/agent/utils/convert-agent-function';
import type { CallSession } from '@/services/call-session';
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

  if (!message && history.length > 0) {
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
  try {
    const updatedHistory: SpecialMessage[] = [...history];
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
        updatedHistory.push({
          role: 'user',
          content: getConversationEndingMessage(session),
          isHiddenMessage: true,
        });
      }
    }
    if (message) {
      updatedHistory.push({ role: 'user', content: message });
    }
    const tools = Object.values(TOOLS).map((tool) => convertAgentFunctionToCompletionTool(tool));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedHistory,
      tools,
      tool_choice: 'auto',
    });

    // logger.log(
    //   'Incoming AssistantChat Message',
    //   { response, history, updatedHistory },
    //   loggerContext
    // );

    const assistantResponse = response.choices[0].message;
    updatedHistory.push(assistantResponse as SpecialMessage);

    if (assistantResponse.tool_calls && assistantResponse.tool_calls.length > 0) {
      for (const toolCall of assistantResponse.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const tool = TOOLS[functionName as keyof typeof TOOLS];
        if (tool) {
          let functionResult;
          if (tool.type === 'webhook') {
            functionResult = await sendToWebhook({
              action: tool.name,
              session,
              parameters: 'parameters' in tool ? tool.parameters.parse(functionArgs) : {},
            });
          } else if ('function' in tool) {
            functionResult = await onTool(functionArgs, tool.function);
          }

          const functionResultMessage: SpecialMessage = {
            role: 'tool',
            content: JSON.stringify(functionResult),
            tool_call_id: toolCall.id,
          };

          updatedHistory.push(functionResultMessage);
        }
      }

      // logger.log('Updated History', { updatedHistory }, loggerContext);

      // Call the API again with the function results
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: updatedHistory,
        tools: tools,
        tool_choice: 'auto',
      });

      updatedHistory.push(finalResponse.choices[0].message as SpecialMessage);
    }

    return updatedHistory;
  } catch (error) {
    logger.error(
      'Error in chat service:',
      error,
      { message, history, command, session },
      loggerContext
    );
    return [
      ...history,
      { role: 'assistant', content: 'Sorry, there was an error processing your request.' },
    ];
  }
}
