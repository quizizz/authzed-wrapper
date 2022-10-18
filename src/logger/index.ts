import pino, { LoggerOptions, BaseLogger } from 'pino';

interface LogFn {
  (msg: string, ...args: any[]): void;
}

interface LogJFn {
  (obj: object): void;
}

/** Interface for logging. All implementation must implement this */
export interface ILogger {
  info: LogFn;
  infoj: LogJFn;
  warn: LogFn;
  warnj: LogJFn;
  error: LogFn;
  errorj: LogJFn;
  debug: LogFn;
  debugj: LogJFn;
}

export class Logger implements ILogger {
  commonlogs: BaseLogger;
  debuglogs: BaseLogger;

  constructor() {
    let options: LoggerOptions = {
      formatters: {
        bindings() {
          return {};
        },
      },
      mixin: () => {
        return {
          _meta: {},
        };
      },
    };

    if (process.env.PRETTY_LOGS === 'yes') {
      options = {
        ...options,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      };
    }

    this.commonlogs = pino(options);
    this.debuglogs = pino({
      ...options,
      level: 'trace',
    });
  }

  isDebugEnabled(): boolean {
    return true;
  }

  getLogger(): BaseLogger {
    if (process.env.DEBUG_LOGS === 'yes' || this.isDebugEnabled()) {
      return this.debuglogs;
    }

    return this.commonlogs;
  }

  info(msg: string, ...args: unknown[]) {
    this.getLogger().info({}, msg, ...args);
  }

  warn(msg: string, ...args: unknown[]) {
    this.getLogger().warn({}, msg, ...args);
  }

  error(msg: string, ...args: unknown[]) {
    this.getLogger().error({}, msg, ...args);
  }

  debug(msg: string, ...args: unknown[]) {
    this.getLogger().debug({}, msg, ...args);
  }

  infoj(obj: object) {
    this.getLogger().info(obj);
  }

  warnj(obj: object) {
    this.getLogger().warn(obj);
  }

  errorj(obj: object) {
    this.getLogger().error(obj);
  }

  debugj(obj: object) {
    this.getLogger().debug(obj);
  }
}

export const logger = new Logger();
