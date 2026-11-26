import config from './config';
import { makeDatabase } from './database';
import { makeFirestore } from './firestore';
import { useLogger } from './logger';

const logger = useLogger({ component: 'preflight' });

function validateConfig(): void {
    const errors: string[] = [];

    if (!config.jwt.secret) {
        errors.push('JWT_SECRET is required');
    } else if (config.env !== 'development' && config.env !== 'test' && config.jwt.secret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters in non-development environments');
    }

    if (!config.database.url) {
        errors.push('DATABASE_URL is required');
    }

    if (
        config.env === 'production' &&
        !config.firebase.emulatorHost &&
        !config.firebase.serviceAccountPath &&
        !config.firebase.serviceAccountJson &&
        !(config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey)
    ) {
        errors.push(
            'Firebase credentials are required in production (set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_PATH)',
        );
    }

    if (errors.length > 0) {
        throw new Error(`[Preflight] Config validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);
}

async function checkConnectivity(): Promise<void> {
    if (config.skipDbPreflight) {
        logger.warn('SKIP_DB_PREFLIGHT=true — skipping PostgreSQL and Firestore connectivity checks');
        return;
    }

    const db = makeDatabase();
    const firestore = makeFirestore();

    const checks: Array<{ name: string; fn: () => Promise<boolean> }> = [
        { name: 'PostgreSQL', fn: () => db.ping() },
        { name: 'Firestore', fn: () => firestore.ping() },
    ];

    const results = await Promise.allSettled(checks.map((c) => withTimeout(c.fn(), 10000, c.name)));

    const failures: string[] = [];
    results.forEach((res, idx) => {
        const check = checks[idx];
        if (!check) {
            return;
        }
        if (res.status === 'rejected') {
            const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
            failures.push(`${check.name}: ${msg}`);
        } else {
            logger.info(`${check.name} connection OK`);
        }
    });

    if (failures.length > 0) {
        if (config.env === 'development') {
            logger.warn(`Connectivity warnings in development:\n  - ${failures.join('\n  - ')}`);
            return;
        }
        throw new Error(`[Preflight] Connectivity checks failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    }
}

export async function runPreflight(): Promise<void> {
    logger.info(`Running preflight checks (NODE_ENV=${config.env})`);
    validateConfig();
    await checkConnectivity();
}
