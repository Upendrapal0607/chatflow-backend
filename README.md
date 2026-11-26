# ChatFlow Backend

Chat backend built with **Node.js**, **strict TypeScript**, **Koa**, **PostgreSQL (Drizzle ORM + `pg`)**, and **Firebase Firestore (`firebase-admin`)**.

## Architecture & Module Layout

```text
chatflow-backend/
├── database/
│   └── schema.sql                 # PostgreSQL DDL (users, chats, chat_members)
├── src/
│   ├── app.ts                     # Koa app, root error boundary, preflight, graceful shutdown
│   ├── db/
│   │   └── schema.ts              # Combined Drizzle ORM schema & relations
│   ├── core/
│   │   ├── config.ts              # Typed environment configuration
│   │   ├── preflight.ts           # Startup config & DB/Firestore connectivity checks
│   │   ├── database/index.ts      # PostgreSQL pool + Drizzle ORM client
│   │   ├── firestore/index.ts     # Firebase Admin Firestore client
│   │   ├── hooks/useAuth.ts       # JWT Bearer auth hook
│   │   ├── koa/router.ts          # Route registration helper
│   │   ├── logger/index.ts        # Structured logger
│   │   ├── security/index.ts      # JWT sign/verify + bcrypt hashing
│   │   └── server/index.ts        # SIGTERM/SIGINT graceful shutdown
│   ├── lib/
│   │   ├── core/                  # AppError hierarchy, response formatter, compose, hook, types
│   │   └── hooks/                 # useKoa, useServices, useLogging, useJsonBody, usePathParams, useQueryString, useHeaders
│   ├── modules/
│   │   ├── endpoints.ts           # Central endpoint registry
│   │   ├── health/                # GET /health/status
│   │   ├── user/                  # Complete User module (register, login, profile, list, update)
│   │   ├── chat/                  # Chat PostgreSQL tables, validators, & types (ready for chat APIs)
│   │   └── message/               # Firestore message/readReceipt/lastSeen schemas & validators
│   └── tests/                     # Jest unit & Supertest integration tests
```

## Database Design

### PostgreSQL (Relational DB)
- `users`: User accounts, credentials (`password_hash`), profile fields, `status`, timestamps.
- `chats`: Direct (`1:1`, deduplicated via `direct_key`) and bonus group chats.
- `chat_members`: Join table linking `chats` and `users` with `role` (`member` | `admin`).

### Firebase Firestore
- `chats/{chatId}/messages/{messageId}`: Chat messages ordered by `createdAt`, inline `readBy` map, edit/delete fields.
- `chats/{chatId}/messages/{messageId}/readReceipts/{userId}`: Per-user read receipts (`readAt`).
- `chats/{chatId}/lastSeen/{userId}`: Per-user last seen `messageId` and `updatedAt`.

## Standard Request/Response & Error Format

**Success (`2xx`):**
```json
{
  "statusCode": 200,
  "success": true,
  "data": {}
}
```

**Error (`4xx` / `5xx`):**
```json
{
  "statusCode": 400,
  "success": false,
  "error": {
    "message": "JSON body validation failed: ...",
    "key": "err.json-body.failed",
    "details": []
  }
}
```

## Implemented Endpoints (Setup + User Module)

- `GET /health/status` — Health & DB/Firestore connectivity check
- `POST /user/register` — Create user account and return JWT token
- `POST /user/login` — Authenticate with email/password and return JWT token
- `GET /user/me` — Get authenticated user profile (Bearer JWT)
- `PATCH /user/me` — Update authenticated user profile (Bearer JWT)
- `GET /user/:userId` — Get user by UUID (Bearer JWT)
- `GET /users` — List/search users with pagination (Bearer JWT)

## Getting Started

1. Copy `.env.sample` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, and Firebase credentials.
2. Apply PostgreSQL schema:
   - Run `database/schema.sql` against PostgreSQL, or use `npx drizzle-kit push`.
3. Install & run:
   ```bash
   npm install
   npm run dev
   ```
4. Validate code quality & tests:
   ```bash
   npm run validate
   ```
