import { tryit } from 'radash';
import { response as toResponse } from '../../core';
import type { NextFunc, Props } from '../../core';
import { useLogger } from '../../../core/logger';
import type { LoggerService } from '../../../core/logger';

export interface UseLoggingOptions {
    logger?: LoggerService;
}

export const useLogging =
    (template = '[:method] :path at :date -> :status in :elapsed(ms)', options: UseLoggingOptions = {}) =>
    (func: NextFunc<Props>): NextFunc<Props> =>
    async (props: Props) => {
        const [error, result] = await tryit(func)(props);
        const res = toResponse(error, result);
        const elapsedMs = Date.now() - props.request.startedAt;

        const message = template
            .replace(':method', props.request.method)
            .replace(':path', props.request.path)
            .replace(':date', new Date().toISOString())
            .replace(':status', String(res.status))
            .replace(':elapsed(ms)', `${elapsedMs}ms`);

        const logger = options.logger ?? useLogger({ component: 'http' });
        if (error) {
            logger.error(message, {
                error: error instanceof Error ? error.message : String(error),
            });
        } else {
            logger.info(message);
        }

        return res;
    };
