/* eslint-disable no-console */

enum LogType {
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  ERROR = 'ERROR',
  INFO = 'INFO',
  // LOG = 'LOG',
}

export type LoggerContext = string | LoggerContext[];
export type FlatLoggerContext = string[];

export interface LoggerConfig {
  defaultContext: string;
  debugContexts: Set<string>;
}

/**
 * Simple logger utility to log messages based on type and context.
 *
 * @example
 * ```typescript
 * const logger = new Logger();
 * logger.log('App mounted');
 * ```
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    const _config = {
      ...config,
    };

    this.config = {
      debugContexts: _config.debugContexts ?? new Set(['**']),
      defaultContext: _config.defaultContext ?? 'App',
    };

    this.debug('📝 ~ Logger initialized ~', this.constructor.name);
  }

  public info(message: string, context?: LoggerContext) {
    this._log(message, LogType.INFO, context);
  }

  public warn(message: string, context?: LoggerContext) {
    this._log(message, LogType.WARN, context);
  }

  public error(message: string, error?: unknown, context?: LoggerContext): void;
  public error(
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
    context?: LoggerContext
  ): void;
  public error(
    message: string,
    error?: unknown,
    dataOrContext?: Record<string, unknown> | LoggerContext,
    context?: LoggerContext
  ): void {
    if (typeof dataOrContext === 'string' || Array.isArray(dataOrContext)) {
      this._log(message, LogType.ERROR, dataOrContext, undefined, error);
      return;
    }
    this._log(message, LogType.ERROR, context, dataOrContext, error);
  }

  public debug(message: string, context?: LoggerContext): void;
  public debug(message: string, data: Record<string, unknown>, context?: LoggerContext): void;
  public debug(
    message: string,
    dataOrContext?: Record<string, unknown> | LoggerContext,
    context?: LoggerContext
  ): void {
    if (typeof dataOrContext === 'string' || Array.isArray(dataOrContext)) {
      this._log(message, LogType.DEBUG, dataOrContext);
      return;
    }
    this._log(message, LogType.DEBUG, context, dataOrContext);
  }

  private _log(
    message: string,
    type = LogType.INFO,
    context: LoggerContext = this.config.defaultContext,
    data?: Record<string, unknown>,
    error?: unknown
  ) {
    if (!this.shouldLog(type, context)) {
      return;
    }

    const _context = this.context(context).join(':');

    switch (type) {
      case LogType.DEBUG:
        // console.group('debug');
        console.log(`[${_context}] DEBUG: ${message}`, data ?? ' ');
        // console.groupEnd();
        break;
      case LogType.WARN:
        console.warn(`${_context}] WARN: [${message}`, data ?? ' ');
        break;
      case LogType.ERROR: {
        let _message = message;
        if (error instanceof Error) {
          _message = `${_message}\n${error.message}`;
        }
        console.error(`[${_context}] ERROR: ❌ ~ ${_message}`, data ?? ' ');
        if (error) {
          console.error(error);
        }
        break;
      }
      case LogType.INFO:
        console.info(`[${_context}] INFO: ${message}`, data ?? ' ');
        break;
    }
  }

  private context(context: LoggerContext): FlatLoggerContext {
    return Array.isArray(context) ? context.map((c) => this.context(c)).flat() : [context];
  }

  private shouldLog(type: LogType, context: LoggerContext): boolean {
    const contextFlat = this.context(context);
    const contextMerged = contextFlat.join(':');
    const hasCommonElement = (array1: unknown[], array2: unknown[]): boolean =>
      array1.some((element) => array2.includes(element));

    if (
      type === LogType.DEBUG &&
      ((!this.config.debugContexts.has(contextMerged) && !this.config.debugContexts.has('**')) ||
        this.config.debugContexts.has(`!${contextMerged}`) ||
        (!this.config.debugContexts.has(contextMerged) &&
          hasCommonElement(
            Array.from(this.config.debugContexts),
            contextFlat.map((c) => `!${c}`)
          )))
    ) {
      return false;
    }
    return true;
  }

  public addContext(
    currentContext: LoggerContext | undefined,
    context: LoggerContext
  ): LoggerContext {
    return currentContext
      ? Array.isArray(currentContext)
        ? [...currentContext, ...(Array.isArray(context) ? context : [context])]
        : [currentContext, ...(Array.isArray(context) ? context : [context])]
      : context;
  }

  // private logToServer(level: number, message: string, data: unknown) {
  //   // Optional: Send logs to a server or external logging service
  //   fetch('/api/logs', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ level, message, data }),
  //   }).catch((error: unknown) => {
  //     this.error('Failed to log to server:', error, this.constructor.name);
  //   });
  // }
}
