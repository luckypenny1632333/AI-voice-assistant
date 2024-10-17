import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod';

import type { AgentFunction } from '../tools';

export const convertAgentFunctionToParseableTool = (tool: AgentFunction) =>
  zodFunction({
    name: tool.name,
    description: tool.description,
    parameters: 'parameters' in tool && tool.parameters ? tool.parameters : z.object({}),
    function: 'function' in tool && typeof tool.function === 'function' ? tool.function : undefined,
  });
