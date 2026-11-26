import type { Endpoint } from '../../../lib/core';
import { endpoint as getUserById } from './getById';
import { endpoint as listUsers } from './list';
import { endpoint as login } from './login';
import { endpoint as me } from './me';
import { endpoint as register } from './register';
import { endpoint as updateMe } from './updateMe';

const userEndpoints: Endpoint[] = [register, login, me, updateMe, getUserById, listUsers];

export default userEndpoints;
