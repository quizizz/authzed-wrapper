import { BaseLogger } from 'pino';
interface LogFn {
    (msg: string, ...args: any[]): void;
}
interface LogJFn {
    (obj: object): void;
}
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
export declare class Logger implements ILogger {
    commonlogs: BaseLogger;
    debuglogs: BaseLogger;
    constructor();
    isDebugEnabled(): boolean;
    getLogger(): BaseLogger;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    debug(msg: string, ...args: unknown[]): void;
    infoj(obj: object): void;
    warnj(obj: object): void;
    errorj(obj: object): void;
    debugj(obj: object): void;
}
export declare const logger: Logger;
export {};
