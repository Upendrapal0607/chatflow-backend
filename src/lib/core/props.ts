import type { Props } from './types';
import { defaultResponse } from './response';

export const props = (): Props => ({
    auth: {},
    args: {},
    services: {},
    request: {
        url: '',
        path: '',
        method: 'GET',
        ip: '',
        startedAt: Date.now(),
        httpVersion: '1.1',
        protocol: 'http',
        headers: {},
        query: {},
        params: {},
        body: null,
    },
    response: defaultResponse,
    framework: {},
});
