export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
}

export interface LoggerService {
    error: (message: string, fields?: Record<string, unknown>) => void;
    warn: (message: string, fields?: Record<string, unknown>) => void;
    info: (message: string, fields?: Record<string, unknown>) => void;
    debug: (message: string, fields?: Record<string, unknown>) => void;
    captureError: (error: unknown, context?: Record<string, unknown>) => void;
}

const formatLine = (level: LogLevel, component: string, message: string, fields?: Record<string, unknown>): string => {
    const ts = new Date().toISOString();
    const comp = component ? ` (${component})` : '';
    const extra = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
    return `${ts} [${level}]${comp} ${message}${extra}`;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.DEBUG]: 3,
};

const resolveMinLevel = (): LogLevel => {
    const raw = (process.env.LOG_LEVEL ?? 'info').toUpperCase();
    if (raw === 'ERROR' || raw === 'WARN' || raw === 'INFO' || raw === 'DEBUG') {
        return raw as LogLevel;
    }
    return LogLevel.INFO;
};

export const useLogger = (opts: { component?: string; level?: LogLevel } = {}): LoggerService => {
    const component = opts.component ?? '';
    const minLevel = opts.level ?? resolveMinLevel();

    const shouldLog = (level: LogLevel): boolean => LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[minLevel];

    return {
        error: (message, fields) => {
            if (shouldLog(LogLevel.ERROR)) {
                process.stderr.write(`${formatLine(LogLevel.ERROR, component, message, fields)}\n`);
            }
        },
        warn: (message, fields) => {
            if (shouldLog(LogLevel.WARN)) {
                process.stdout.write(`${formatLine(LogLevel.WARN, component, message, fields)}\n`);
            }
        },
        info: (message, fields) => {
            if (shouldLog(LogLevel.INFO)) {
                process.stdout.write(`${formatLine(LogLevel.INFO, component, message, fields)}\n`);
            }
        },
        debug: (message, fields) => {
            if (shouldLog(LogLevel.DEBUG)) {
                process.stdout.write(`${formatLine(LogLevel.DEBUG, component, message, fields)}\n`);
            }
        },
        captureError: (error, context) => {
            if (!shouldLog(LogLevel.ERROR)) {
                return;
            }
            const errObj = error instanceof Error ? error : new Error(String(error));
            process.stderr.write(
                `${formatLine(LogLevel.ERROR, component, errObj.message, {
                    ...context,
                    name: errObj.name,
                    stack: errObj.stack,
                })}\n`,
            );
        },
    };
};
