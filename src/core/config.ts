const getEnv = (name: string, defaultValue?: string): string | undefined => {
    const val = process.env[name];
    if (val === undefined || val === '') {
        return defaultValue;
    }
    return val;
};

const getIntEnv = (name: string, defaultValue: number): number => {
    const raw = getEnv(name);
    if (!raw) {
        return defaultValue;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
};

export interface AppConfig {
    env: string;
    port: number;
    logLevel: string;
    skipDbPreflight: boolean;
    database: {
        url: string;
        poolMax: number;
        idleTimeoutMs: number;
        connectionTimeoutMs: number;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    bcrypt: {
        saltRounds: number;
    };
    firebase: {
        projectId?: string;
        serviceAccountPath?: string;
        clientEmail?: string;
        privateKey?: string;
        emulatorHost?: string;
    };
}

const config: AppConfig = {
    env: getEnv('NODE_ENV', 'development') ?? 'development',
    port: getIntEnv('PORT', 8000),
    logLevel: getEnv('LOG_LEVEL', 'info') ?? 'info',
    skipDbPreflight: getEnv('SKIP_DB_PREFLIGHT') === 'true',
    database: {
        url: getEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/chatflow') ?? '',
        poolMax: getIntEnv('PG_POOL_MAX', 10),
        idleTimeoutMs: getIntEnv('PG_IDLE_TIMEOUT_MS', 30000),
        connectionTimeoutMs: getIntEnv('PG_CONNECTION_TIMEOUT_MS', 5000),
    },
    jwt: {
        secret: getEnv('JWT_SECRET', '') ?? '',
        expiresIn: getEnv('JWT_EXPIRES_IN', '7d') ?? '7d',
    },
    bcrypt: {
        saltRounds: getIntEnv('BCRYPT_SALT_ROUNDS', 12),
    },
    firebase: {
        projectId: getEnv('FIREBASE_PROJECT_ID'),
        serviceAccountPath: getEnv('FIREBASE_SERVICE_ACCOUNT_PATH'),
        clientEmail: getEnv('FIREBASE_CLIENT_EMAIL'),
        privateKey: getEnv('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        emulatorHost: getEnv('FIRESTORE_EMULATOR_HOST'),
    },
};

export default config;
