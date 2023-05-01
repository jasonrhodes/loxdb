import { ORDERED_LOG_LEVELS } from "../common/constants";
import { LOG_LEVEL, LogMessage, Logger } from "../common/types/base";
import { getLoxLogLevel } from "./getLoxLogLevel";

export interface LoxDBLoggerOptions {
  level?: LOG_LEVEL;
}

export class LoxDBLogger implements Logger {
  public writeLevels: LOG_LEVEL[];

  constructor({ level = "info" }: LoxDBLoggerOptions = {}) {
    const stopIndex = ORDERED_LOG_LEVELS.indexOf(level);
    this.writeLevels = ORDERED_LOG_LEVELS.slice(0, stopIndex + 1);
  }

  log(level: LOG_LEVEL, ...messages: LogMessage[]) {
    if (this.writeLevels.includes(level)) {
      const now = new Date();
      let logMethod: 'log' | 'error' | 'warn' = 'log';
      if (level === "error") {
        logMethod = 'error';
      }
      if (level === "warning") {
        logMethod = 'warn';
      }
      console[logMethod]('[loxdb 🐟]', `[${level.toUpperCase()}]`, `[${now.toISOString()}]`, ...messages);
    }
  }

  error(...messages: LogMessage[]) {
    this.log('error', ...messages);
  }

  warning(...messages: LogMessage[]) {
    this.log('warning', ...messages);
  }

  info(...messages: LogMessage[]) {
    this.log('info', ...messages);
  }

  verbose(...messages: LogMessage[]) {
    this.log('verbose', ...messages);
  }

  debug(...messages: LogMessage[]) {
    this.log('debug', ...messages);
  }
}

const level = getLoxLogLevel();
export const logger = new LoxDBLogger({ level });