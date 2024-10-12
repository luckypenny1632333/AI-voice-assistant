import readline from 'readline';
import util from 'util';

export class ConsoleLogger {
  lastCount = 0;
  lastLine?: string;
  lastData?: string;
  isLogData = !process.env.REPLIT_DEPLOYMENT;

  debug(line: string, data?: Record<string, unknown>, context?: string) {
    if (!this.isLogData) {
      this.log(line, data, context);
    }
  }

  log(line: string, data?: Record<string, unknown>, context?: string) {
    if (context) {
      line = `[${context}] ${line}`;
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
      this.lastData = JSON.stringify(data);
      this.lastCount = 0;
      console.log(
        line,
        data && this.isLogData
          ? util.inspect(data, {
              depth: null,
              colors: true,
            })
          : ''
      );
    }
  }

  // Overwrite the last line in the console
  replaceLastLine(text: string) {
    readline.clearLine(process.stdout, 0); // Clear the last line
    readline.cursorTo(process.stdout, 0); // Move cursor to the start of the line
    process.stdout.write(text); // Write the new content
  }

  error(line: string, error?: unknown, data?: Record<string, unknown>, context?: string) {
    if (context) {
      line = `[${context}] ${line}`;
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
