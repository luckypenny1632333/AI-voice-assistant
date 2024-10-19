import type OpenAI from 'openai';

import type { CallSession } from '@/services/call-session';
import { convertAgentFunctionToCompletionTool } from '@/services/chat-service';
import { sendToWebhook } from '@/services/send-to-webhook';

import { TOOLS, onTool } from '../tools';

export const getTool = (toolName: string) => {
  return TOOLS[toolName as keyof typeof TOOLS];
};

export const getToolsAsChatCompletionTools = () => {
  return Object.values(TOOLS)
    .filter((t) => !('isHidden' in t) || ('isHidden' in t && t.isHidden))
    .map((tool) => convertAgentFunctionToCompletionTool(tool));
};

export const callTool = async (
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  session: CallSession
): Promise<OpenAI.Chat.ChatCompletionMessageParam> => {
  const functionName = toolCall.function.name;
  const functionArgs = JSON.parse(toolCall.function.arguments);
  const tool = getTool(functionName);
  if (!tool) {
    throw new Error(`Tool ${functionName} not found`);
  }
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

  return {
    role: 'tool',
    content: JSON.stringify(functionResult),
    tool_call_id: toolCall.id,
  };
};
