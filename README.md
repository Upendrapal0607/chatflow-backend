# ChatFlow Backend

A production-ready chat backend built with **Node.js (>= 22.16)**, **strict TypeScript**, **Koa**, **PostgreSQL (Drizzle ORM + `pg`)**, and **Firebase Firestore (`firebase-admin`)**.

It combines **PostgreSQL** for relational integrity (users, 1:1/group chats, memberships) with **Firebase Firestore** for high-throughput chat messaging (time-ordered messages, per-message read receipts, last-seen tracking, message edit & soft-delete).

---

## Tech Stack

- **Runtime & Language:** Node.js `>=22.16.0`, TypeScript `5.9` (`strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- **HTTP Framework:** Koa `3`, `@koa/router`, `koa-body`, `koa-qs`
- **Validation:** Zod (`useJsonBody`, `usePathParams`, `useQueryString`, `useHeaders`)
- **Relational Database:** PostgreSQL (Neon-ready) via `pg` + Drizzle ORM (`drizzle-orm` / `drizzle-kit`)
- **Document / Real-time Store:** Firebase Firestore via `firebase-admin`
- **Auth & Security:** JWT (`jsonwebtoken`, `HS256`) + `bcrypt` password hashing
- **Testing & Quality:** Jest (`ts-jest`), ESLint (`--max-warnings 0`), Prettier

---

## Working Flow & Request Lifecycle

### 1. Application Startup (`src/app.ts` & `src/core/preflight.ts`)
1. Loads environment variables (`dotenv/config`).
2. `runPreflight()` validates required config (`JWT_SECRET`, `DATABASE_URL`, and Firebase credentials in `production`) and verifies connectivity to both **PostgreSQL** and **Firestore** (skippable locally with `SKIP_DB_PREFLIGHT=true`).
3. `createApp()` configures `koa-qs`, CORS headers (`CORS_ORIGIN`), a root-level error boundary, `koa-body`, and registers all module routes from `src/modules/endpoints.ts`.
4. Registers graceful shutdown (`SIGTERM` / `SIGINT`) to close the HTTP server, PostgreSQL pool, and Firestore client cleanly.

### 2. Endpoint Hook Pipeline (`compose(...)`)
Every endpoint is composed from reusable functional hooks:

```text
HTTP Request
  │
  ▼
useKoa()                 ──▶ Normalizes Koa ctx into typed Props; catches errors & writes HTTP response
  │
  ▼
useServices(...)         ──▶ Injects core services (db, firestore, logger) & domain services
  │
  ▼
useLogging()             ──▶ Logs "[METHOD] /path at ISO -> STATUS in Xms"
  │
  ▼
useAuth()                ──▶ (Protected routes) Verifies Bearer JWT, loads active user from PostgreSQL
  │
  ▼
usePathParams /          ──▶ Validates params, query string, and JSON body via Zod
useQueryString /             (throws BadRequestError 400 with field-level details on failure)
useJsonBody
  │
  ▼
Endpoint Handler         ──▶ Calls module service -> repository (PostgreSQL / Firestore)
  │
  ▼
Response Formatter       ──▶ { statusCode, success: true, data, pagination? }
                             or AppError -> { statusCode, success: false, error: { message, key, details? } }
```

### 3. Hybrid Database Workflow (PostgreSQL + Firestore)
- **PostgreSQL** owns **identity, chats, and membership authorization**:
  - Every chat/message API first verifies the caller's JWT (`useAuth`) and checks membership in `chat_members` before reading or writing Firestore.
  - 1:1 chats are atomically deduplicated using a canonical `direct_key` (`min(userAId, userBId):max(userAId, userBId)`).
- **Firebase Firestore** owns **messages, read receipts, and last-seen state**:
  - `POST /chat/:chatId/message/send` writes the message document to Firestore and updates `chats.updated_at` in PostgreSQL so chat lists stay sorted by recent activity.
  - `POST /chat/:chatId/message/:messageId/read` executes an atomic Firestore batch write updating both `readBy.<userId>` on the message and the `readReceipts/{userId}` subcollection document.

---

## Project Structure

```text
chatflow-backend/
├── database/
│   └── schema.sql                         # PostgreSQL DDL (users, chats, chat_members + indexes)
├── src/
│   ├── app.ts                             # Koa app factory, CORS, root error boundary, bootstrap
│   ├── db/
│   │   └── schema.ts                      # Combined Drizzle ORM schema & relations
│   ├── types/
│   │   ├── koa-qs.d.ts                    # Type declarations for koa-qs
│   │   └── koa-router.d.ts                # Type declarations for @koa/router
│   ├── core/
│   │   ├── config.ts                      # Typed environment configuration
│   │   ├── index.ts                       # Core exports & useCoreServices()
│   │   ├── preflight.ts                   # Env & DB/Firestore connectivity checks
│   │   ├── database/index.ts              # pg.Pool (keepAlive + error listener) & Drizzle ORM
│   │   ├── firestore/index.ts             # Firebase Admin initialization (env vars, JSON, file, emulator)
│   │   ├── hooks/useAuth.ts               # JWT Bearer authentication hook
│   │   ├── koa/router.ts                  # Endpoint registration helper
│   │   ├── logger/index.ts                # Structured logger
│   │   ├── security/index.ts              # JWT sign/verify + bcrypt hashing
│   │   └── server/index.ts                # Graceful shutdown handler
│   ├── lib/
│   │   ├── core/                          # AppError classes, response/res helpers, compose, hook, props, types
│   │   └── hooks/                         # useKoa, useServices, useLogging, useJsonBody, usePathParams, useQueryString, useHeaders
│   ├── modules/
│   │   ├── endpoints.ts                   # Central route registry
│   │   ├── types.ts                       # Shared module arg/service types
│   │   ├── health/                        # GET /health/status
│   │   ├── user/                          # Register, login, profile, user listing/lookup (PostgreSQL)
│   │   ├── chat/                          # 1:1 chats, group chats, membership, user chat list (PostgreSQL)
│   │   └── message/                       # Send, ordered fetch, read receipts, last seen, edit/delete (Firestore)
│   └── tests/                             # Jest unit tests & in-memory Koa endpoint tests
├── .env.sample
├── drizzle.config.ts
├── eslint.config.js
├── jest.config.js
├── package.json
└── tsconfig.json
```

---

## Database Design

### PostgreSQL Tables ([database/schema.sql](database/schema.sql))
| Table | Purpose | Key Columns & Constraints |
| :--- | :--- | :--- |
| `users` | User accounts & auth | `id` (UUID PK), `name`, `email` (UNIQUE), `username` (UNIQUE), `password_hash`, `avatar_url`, `status` (`active` \| `inactive` \| `suspended`), `last_active_at`, `created_at`, `updated_at` |
| `chats` | 1:1 direct & group chats | `id` (UUID PK), `type` (`direct` \| `group`), `direct_key` (UNIQUE for 1:1 deduplication), `name` (group name), `created_by` (FK → `users.id`), `created_at`, `updated_at` |
| `chat_members` | Chat membership & roles | `id` (UUID PK), `chat_id` (FK → `chats.id` CASCADE), `user_id` (FK → `users.id` CASCADE), `role` (`member` \| `admin`), `joined_at`, `UNIQUE(chat_id, user_id)` |

### Firebase Firestore Collections ([src/modules/message/schema.ts](src/modules/message/schema.ts))
| Path | Document Fields |
| :--- | :--- |
| `chats/{chatId}/messages/{messageId}` | `id`, `chatId`, `senderId`, `text`, `type` (`text` \| `system`), `readBy` (`Record<userId, Timestamp>`), `isEdited`, `editedAt`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` |
| `chats/{chatId}/messages/{messageId}/readReceipts/{userId}` | `userId`, `messageId`, `chatId`, `readAt` |
| `chats/{chatId}/lastSeen/{userId}` | `userId`, `chatId`, `messageId`, `updatedAt` |

---

## Standard Response & Error Format

**Success (`200` / `201`):**
```json
{
  "statusCode": 200,
  "success": true,
  "data": {}
}
```

**Error (`400` / `401` / `403` / `404` / `409` / `500`):**
```json
{
  "statusCode": 400,
  "success": false,
  "error": {
    "message": "JSON body validation failed: email: invalid email",
    "key": "err.json-body.failed",
    "details": [
      { "path": "email", "message": "Invalid email", "code": "invalid_string" }
    ]
  }
}
```

---

## API Reference

> Protected routes require header: `Authorization: Bearer <jwt_token>`

### 1. Health
- **`GET /health/status`** *(Public)* — Pings PostgreSQL and Firestore; returns `200` (`status: "ok"`) when both are connected or `503` (`status: "degraded"`) if either is unreachable.

### 2. Users & Authentication
| Method & Path | Auth | Input | Output (`data`) |
| :--- | :--- | :--- | :--- |
| `POST /user/register` | Public | `{ name, email, password, username?, avatarUrl? }` | `201` `{ token, user }` |
| `POST /user/login` | Public | `{ email, password }` | `200` `{ token, user }` |
| `GET /user/me` | Bearer JWT | — | `200` `{ user }` |
| `PATCH /user/me` | Bearer JWT | `{ name?, username?, avatarUrl? }` | `200` `{ user }` |
| `GET /user/:userId` | Bearer JWT | Path: `userId` (UUID) | `200` `{ user }` |
| `GET /users` | Bearer JWT | Query: `search?`, `status?`, `page?`, `limit?` | `200` `{ users }` + `pagination` |

### 3. Core Chat & Messaging APIs
| # | Method & Path | Auth | Input | Output (`data`) |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `POST /chat/create` | Bearer JWT | Body: `{ userAId, userBId }` | `201`/`200` `{ chatId, created, chat }` |
| 2 | `POST /chat/:chatId/message/send` | Bearer JWT | Path: `chatId`; Body: `{ senderId, text, type? }` | `201` `{ message }` |
| 3 | `GET /chat/:chatId/messages` | Bearer JWT | Path: `chatId`; Query: `limit=50`, `before?`, `order=asc\|desc` | `200` `{ messages, lastSeen }` |
| 4 | `POST /chat/:chatId/message/:messageId/read` | Bearer JWT | Path: `chatId, messageId`; Body: `{ userId }` | `200` `{ receipt }` |
| 5 | `POST /chat/:chatId/lastseen` | Bearer JWT | Path: `chatId`; Body: `{ userId, messageId }` | `200` `{ lastSeen }` |
| 6 | `GET /user/:userId/chats` | Bearer JWT | Path: `userId` | `200` `{ chats }` (includes `memberIds` & `members`) |

### 4. Bonus APIs (Group Chats & Message Edit/Delete)
| Method & Path | Auth & Role | Input | Output (`data`) |
| :--- | :--- | :--- | :--- |
| `POST /chat/group/create` | Bearer JWT | Body: `{ name, memberIds }` (creator added as `admin`) | `201` `{ chatId, chat }` |
| `GET /chat/:chatId` | Bearer JWT (Member) | Path: `chatId` | `200` `{ chat }` |
| `PATCH /chat/:chatId` | Bearer JWT (Admin) | Path: `chatId`; Body: `{ name }` | `200` `{ chat }` |
| `POST /chat/:chatId/members` | Bearer JWT (Admin) | Path: `chatId`; Body: `{ memberIds }` | `200` `{ chat }` |
| `DELETE /chat/:chatId/members/:userId` | Bearer JWT (Admin or Self) | Path: `chatId, userId` | `200` `{ chat }` |
| `PATCH /chat/:chatId/message/:messageId` | Bearer JWT (Sender) | Path: `chatId, messageId`; Body: `{ text }` | `200` `{ message }` |
| `DELETE /chat/:chatId/message/:messageId` | Bearer JWT (Sender) | Path: `chatId, messageId` | `200` `{ message }` (soft delete) |

---

## Setup & Scripts

### 1. Configure Environment
Copy `.env.sample` to `.env` and configure:
- `DATABASE_URL`: PostgreSQL / Neon pooler connection string (use `sslmode=verify-full` for Neon)
- `JWT_SECRET`: Secret key (`>= 32` chars in production)
- **Firebase credentials** (any one of):
  - `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` *(recommended for cloud deployment)*
  - `FIREBASE_SERVICE_ACCOUNT_JSON` *(raw or base64 service account JSON)*
  - `FIREBASE_SERVICE_ACCOUNT_PATH` *(local path e.g. `./creds.json`)*
  - `FIRESTORE_EMULATOR_HOST` *(for local Firestore emulator)*

### 2. Apply PostgreSQL Schema
Run `database/schema.sql` against your PostgreSQL database, or push via Drizzle:
```bash
npx drizzle-kit push
```

### 3. Available Commands
```bash
npm install           # Install dependencies
npm run dev           # Start development server (ts-node + dotenv)
npm run dev:watch     # Start dev server with nodemon auto-reload
npm run build         # Clean & compile TypeScript to build/
npm start             # Run compiled production server (build/app.js)
npm run type-check    # Run strict tsc --noEmit
npm run lint:check    # Run ESLint with --max-warnings 0
npm test              # Run Jest unit & endpoint tests
npm run validate      # Run lint:check + type-check + test
```

### 4. Production Deployment Notes
- Set build command to `npm install && npm run build` and start command to `npm start`.
- Set `NODE_ENV=production` and configure all `.env` variables in your hosting provider's environment settings (do not commit `.env` or `creds.json`).
- Point your platform's health check probe to `GET /health/status`.
