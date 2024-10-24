import { z } from 'zod';

export type ToolsConfig<AppData extends {} = {}> = Record<string, AgentFunction<AppData>>;

interface BaseFunction<
  AppData extends {} = {},
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> {
  type: 'call' | 'webhook';
  name: string;
  /**
   * Defines if the function is visible for the agent or not.
   * If the function is not visible, it can only be called by the app.
   * @default true
   */
  isHidden?: boolean;
  description?: string | undefined;
  parameters?: Parameters;
  response?: Response;
  function: (
    args: z.infer<Parameters>,
    app: AppData
  ) => z.infer<Response> | Promise<z.infer<Response>>;
  onCall?: ((args: z.infer<Parameters>) => unknown | Promise<unknown>) | undefined;
  onComplete?: ((args: z.infer<Response>) => unknown | Promise<unknown>) | undefined;
}

export interface CallFunction<
  AppData extends {} = {},
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> extends BaseFunction<AppData, Parameters, Response> {
  type: 'call';
}

export interface WebhookFunction<
  AppData extends {} = {},
  Parameters extends z.ZodType = z.ZodType,
  Response extends z.ZodType = z.ZodType,
> extends Omit<BaseFunction<AppData, Parameters, Response>, 'function'> {
  type: 'webhook';
}

export type AgentFunction<AppData extends {} = {}> =
  | CallFunction<AppData>
  | WebhookFunction<AppData>;
