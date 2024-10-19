import chalk from 'chalk';
import readline from 'readline';
import util from 'util';

import { depthLimiter } from './depth-limiter';

export class ConsoleLogger {
  depthLimit = 2;
  lastCount = 0;
  contextColor = chalk.cyan;
  lastLine?: string;
  lastData?: string;
  isLogData = !process.env.REPLIT_DEPLOYMENT;

  // Combined config object for execution time thresholds and colors
  executionTimeConfig = [
    { threshold: 100, color: chalk.green },
    { threshold: 400, color: chalk.yellow },
    { threshold: 800, color: chalk.red },
    { threshold: Infinity, color: chalk.redBright },
  ];

  debug(line: string, data?: Record<string, unknown>, context?: string) {
    if (!this.isLogData) {
      this.log(line, data, context);
    }
  }

  log(line: string, data?: Record<string, unknown>, context?: string, executionTime?: number) {
    if (context) {
      line = `${this.contextColor(`[${context}]`)} ${line}`;
    }
    if (executionTime !== undefined) {
      line += this.formatExecutionTime(executionTime);
    }
    if (this.lastLine === line && (!this.isLogData || this.lastData === JSON.stringify(data))) {
      this.lastCount++;
      this.replaceLastLine(`${line} (${this.lastCount})`);
    } else {
      if (this.lastCount > 0) {
        // Ensure the previous line is finalized
        console.log();
      }
      this.lastLine = line;
      this.lastData = JSON.stringify(data, depthLimiter(this.depthLimit));
      this.lastCount = 0;
      console.log(
        line,
        data && this.isLogData
          ? util.inspect(data, {
              depth: this.depthLimit,
              colors: true,
            })
          : ''
      );
    }
  }

  private formatExecutionTime(time: number): string {
    const { color } =
      this.executionTimeConfig.find((config) => time < config.threshold) ||
      this.executionTimeConfig[this.executionTimeConfig.length - 1];
    return ` ${color(`(${time}ms)`)}`;
  }

  // Overwrite the last line in the console
  replaceLastLine(text: string) {
    readline.clearLine(process.stdout, 0); // Clear the last line
    readline.cursorTo(process.stdout, 0); // Move cursor to the start of the line
    process.stdout.write(text); // Write the new content
  }

  error(
    line: string,
    error?: unknown,
    data?: Record<string, unknown>,
    context?: string,
    executionTime?: number
  ) {
    if (context) {
      line = `${this.contextColor(`[${context}]`)} ${line}`;
    }
    if (executionTime !== undefined) {
      line += this.formatExecutionTime(executionTime);
    }
    console.error(line);
    if (error && this.isLogData) {
      console.error(
        util.inspect(error, {
          depth: null,
          colors: true,
        })
      );
    }
    if (data && this.isLogData) {
      console.error(
        util.inspect(data, {
          depth: null,
          colors: true,
        })
      );
    }
  }
}

export const logger = new ConsoleLogger();
