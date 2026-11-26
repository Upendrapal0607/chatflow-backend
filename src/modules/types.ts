import type { CoreServices } from '../core';
import type { PublicUser } from './user/types';

export interface BaseArgs extends Record<string, unknown> {
    currentUser?: PublicUser;
}

export interface AuthenticatedArgs extends Record<string, unknown> {
    currentUser: PublicUser;
}

export type ModuleServices = CoreServices;
