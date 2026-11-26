import config from './config';
import { disconnectDatabase, makeDatabase, type DatabaseClient } from './database';
import { disconnectFirestore, makeFirestore, type FirestoreClient } from './firestore';
import { useAuth } from './hooks';
import addRoutes from './koa/router';
import { LogLevel, useLogger, type LoggerService } from './logger';
import { runPreflight } from './preflight';
import { comparePassword, hashPassword, signJwt, verifyJwt } from './security';
import { registerShutdown } from './server';

export interface CoreServices extends Record<string, unknown> {
    db: DatabaseClient;
    firestore: FirestoreClient;
    logger: LoggerService;
}

export const useCoreServices = (): CoreServices => ({
    db: makeDatabase(),
    firestore: makeFirestore(),
    logger: useLogger(),
});

export {
    addRoutes,
    comparePassword,
    config,
    disconnectDatabase,
    disconnectFirestore,
    hashPassword,
    LogLevel,
    makeDatabase,
    makeFirestore,
    registerShutdown,
    runPreflight,
    signJwt,
    useAuth,
    useLogger,
    verifyJwt,
};
export type { DatabaseClient, FirestoreClient, LoggerService };
