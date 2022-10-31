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
export declare class ConsoleLogger implements ILogger {
    info(msg: string, ...args: any[]): void;
    infoj(obj: object): void;
    warn(msg: string, ...args: any[]): void;
    warnj(obj: object): void;
    error(msg: string, ...args: any[]): void;
    errorj(obj: object): void;
    debug(msg: string, ...args: any[]): void;
    debugj(obj: object): void;
}
export {};
