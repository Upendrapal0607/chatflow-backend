import type { Endpoint } from '../lib/core';
import healthEndpoints from './health/endpoints';
import userEndpoints from './user/endpoints';

const endpoints: Endpoint[] = [...healthEndpoints, ...userEndpoints];

export default endpoints;
