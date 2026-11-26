import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import config from '../config';
import { schema, DatabaseSchema } from '../../db/schema';

export type DbOrm = NodePgDatabase<DatabaseSchema>;

export interface DatabaseClient {
    pool: Pool;
    orm: DbOrm;
    query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
    ping: () => Promise<boolean>;
}

let sharedPool: Pool | null = null;
let sharedOrm: DbOrm | null = null;

export const getPgPool = (): Pool => {
    if (!sharedPool) {
        sharedPool = new Pool({
            connectionString: config.database.url,
            max: config.database.poolMax,
            idleTimeoutMillis: config.database.idleTimeoutMs,
            connectionTimeoutMillis: config.database.connectionTimeoutMs,
        });
    }
    return sharedPool;
};

export const getOrm = (): DbOrm => {
    if (!sharedOrm) {
        sharedOrm = drizzle(getPgPool(), { schema });
    }
    return sharedOrm;
};

export const makeDatabase = (): DatabaseClient => {
    const pool = getPgPool();
    const orm = getOrm();

    return {
        pool,
        orm,
        query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
            pool.query<T>(text, params),
        ping: async (): Promise<boolean> => {
            const res = await pool.query('SELECT 1 AS ok');
            return res.rowCount !== null && res.rowCount >= 0;
        },
    };
};

export const disconnectDatabase = async (): Promise<void> => {
    if (sharedPool) {
        await sharedPool.end();
        sharedPool = null;
        sharedOrm = null;
    }
};
