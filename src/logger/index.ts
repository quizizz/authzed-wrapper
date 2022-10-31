/* eslint-disable no-console */

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

export class ConsoleLogger implements ILogger {
  info(msg: string, ...args: any[]) {
    console.info(msg, args);
  }

  infoj(obj: object) {
    console.info(obj);
  }

  warn(msg: string, ...args: any[]) {
    console.warn(msg, args);
  }

  warnj(obj: object) {
    console.warn(obj);
  }

  error(msg: string, ...args: any[]) {
    console.error(msg, args);
  }

  errorj(obj: object) {
    console.error(obj);
  }

  debug(msg: string, ...args: any[]) {
    console.debug(msg, args);
  }

  debugj(obj: object) {
    console.debug(obj);
  }
}
