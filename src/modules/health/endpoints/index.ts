import type { Endpoint } from '../../../lib/core';
import { endpoint as healthStatus } from './status';

const healthEndpoints: Endpoint[] = [healthStatus];

export default healthEndpoints;
