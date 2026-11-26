import type { Endpoint } from '../lib/core';
import chatEndpoints from './chat/endpoints';
import healthEndpoints from './health/endpoints';
import messageEndpoints from './message/endpoints';
import userEndpoints from './user/endpoints';

const endpoints: Endpoint[] = [
    ...healthEndpoints,
    ...userEndpoints,
    ...chatEndpoints,
    ...messageEndpoints,
];

export default endpoints;
