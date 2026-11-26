import { and, count, desc, eq, ilike, or, SQL } from 'drizzle-orm';
import type { DatabaseClient } from '../../core';
import { usersTable } from './schema';
import type { CreateUserRecord, ListUsersInput, UserEntity, UserRepository } from './types';

export const userRepository: UserRepository = {
    async findById(db: DatabaseClient, id: string): Promise<UserEntity | null> {
        const rows = await db.orm.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
        return rows[0] ?? null;
    },

    async findByEmail(db: DatabaseClient, email: string): Promise<UserEntity | null> {
        const rows = await db.orm.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
        return rows[0] ?? null;
    },

    async findByUsername(db: DatabaseClient, username: string): Promise<UserEntity | null> {
        const rows = await db.orm.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
        return rows[0] ?? null;
    },

    async findMany(
        db: DatabaseClient,
        params: ListUsersInput,
    ): Promise<{ rows: UserEntity[]; total: number }> {
        const conditions: SQL[] = [];

        if (params.status) {
            conditions.push(eq(usersTable.status, params.status));
        }

        if (params.search) {
            const pattern = `%${params.search}%`;
            const searchFilter = or(
                ilike(usersTable.name, pattern),
                ilike(usersTable.email, pattern),
                ilike(usersTable.username, pattern),
            );
            if (searchFilter) {
                conditions.push(searchFilter);
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const offset = (params.page - 1) * params.limit;

        const [rows, totalRows] = await Promise.all([
            db.orm
                .select()
                .from(usersTable)
                .where(whereClause)
                .orderBy(desc(usersTable.createdAt))
                .limit(params.limit)
                .offset(offset),
            db.orm.select({ total: count() }).from(usersTable).where(whereClause),
        ]);

        const total = Number(totalRows[0]?.total ?? 0);
        return { rows, total };
    },

    async create(db: DatabaseClient, data: CreateUserRecord): Promise<UserEntity> {
        const rows = await db.orm.insert(usersTable).values(data).returning();
        const created = rows[0];
        if (!created) {
            throw new Error('Insert user returned no rows');
        }
        return created;
    },

    async updateById(
        db: DatabaseClient,
        id: string,
        data: Partial<Pick<UserEntity, 'name' | 'username' | 'avatarUrl' | 'lastActiveAt' | 'updatedAt'>>,
    ): Promise<UserEntity | null> {
        const rows = await db.orm
            .update(usersTable)
            .set({
                ...data,
                updatedAt: data.updatedAt ?? new Date(),
            })
            .where(eq(usersTable.id, id))
            .returning();
        return rows[0] ?? null;
    },
};
