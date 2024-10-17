import dotenv from 'dotenv';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources';
import { z } from 'zod';

import { type AgentFunction, TOOLS, onTool } from '@/call/agent/tools';
import { convertAgentFunctionToParseableTool } from '@/call/agent/utils/convert-agent-function';
import { sendToWebhook } from '@/services/send-to-webhook';
import { testSession } from '@/testdata/session.data';
import { logger } from '@/utils/console-logger';

dotenv.config(); // Load environment variables from .env

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z.any().optional(),
});

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

const loggerContext = 'ChatService';

// Add a new type for our special messages
type SpecialMessage = ChatMessage & {
  isToolCall?: boolean;
  isToolResponse?: boolean;
  toolDetails?: string;
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

export async function handleChatMessage(
  message: string,
  history: SpecialMessage[]
): Promise<SpecialMessage[]> {
  try {
    const updatedHistory: SpecialMessage[] = [...history, { role: 'user', content: message }];
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
          if (tool.type === 'call') {
            functionResult = await onTool(functionArgs, tool.function);
          } else {
            functionResult = await sendToWebhook({
              action: tool.name,
              session: testSession, // TODO: replace with proper session object
              parameters: 'parameters' in tool ? tool.parameters.parse(functionArgs) : {},
            });
          }

          const functionResultMessage: SpecialMessage = {
            role: 'tool',
            content: JSON.stringify(functionResult),
            tool_call_id: toolCall.id,
            isToolResponse: true,
            toolDetails: JSON.stringify(functionResult, null, 2),
          };

          updatedHistory.push(functionResultMessage);
        }
      }

      // logger.log('Updated History', { updatedHistory }, loggerContext);

      // Call the API again with the function results
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: updatedHistory,
      });

      updatedHistory.push(finalResponse.choices[0].message as SpecialMessage);
    }

    return updatedHistory;
  } catch (error) {
    logger.error('Error in chat service:', error, undefined, loggerContext);
    return [
      ...history,
      { role: 'assistant', content: 'Sorry, there was an error processing your request.' },
    ];
  }
}
