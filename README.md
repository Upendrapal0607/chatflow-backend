# ChatFlow Backend

ChatFlow is a REST API for user accounts, direct and group chats, and chat messages. It is built with Node.js, TypeScript, Koa, PostgreSQL, and Firebase Firestore.

PostgreSQL is the source of truth for users and chat membership. Firestore stores messages and real-time chat state. Keeping these responsibilities separate makes relational authorization checks straightforward while allowing message reads and writes to scale independently.

### Architecture and PostgreSQL Tables ([project_guide.md](./project_guide.md))

## Features

- JWT-based authentication and bcrypt password hashing
- Direct and group chat creation
- Chat membership and role-based authorization
- Message send, edit, soft-delete, and ordered retrieval
- Read receipts and per-user last-seen tracking
- Strict request validation with Zod
- PostgreSQL and Firestore health checks
- Jest tests for services and HTTP endpoints

## Tech Stack

- Node.js 22+
- TypeScript with strict compiler settings
- Koa 3 and `@koa/router`
- PostgreSQL with `pg` and Drizzle ORM
- Firebase Admin SDK and Firestore
- Zod for request validation
- JWT and bcrypt
- Jest, Supertest, ESLint, and Prettier

## Architecture

```text
Client
  |
  v
Koa HTTP server
  |
  v
Hooks: authentication -> validation -> logging -> handler
  |
  +--> PostgreSQL: users, chats, chat_members
  |
  `--> Firestore: messages, readReceipts, lastSeen
```

An authenticated request is resolved through reusable endpoint hooks. Protected endpoints verify the JWT and load the current user from PostgreSQL. Chat operations also verify membership before reading or writing Firestore data.

For the request flow, data ownership, and database layout, see [project_guide.md](./project_guide.md).

## Project Layout

```text
src/
  app.ts                  Application setup and route registration
  core/                   Configuration, database, Firestore, auth, and server helpers
  lib/                   Shared hooks, errors, types, and response utilities
  modules/
    user/                 Registration, login, and user APIs
    chat/                 Direct and group chat APIs
    message/              Message, read receipt, and last-seen APIs
  tests/                  Jest test suite
database/
  schema.sql              PostgreSQL schema
docs/
  api-reference.json      API examples and schema
  chatflow.postman_collection.json
```

## Data Model

### PostgreSQL

| Table | Purpose |
| --- | --- |
| `users` | Accounts and authentication |
| `chats` | Direct and group chat records |
| `chat_members` | Chat membership and admin/member roles |

The schema is in [database/schema.sql](./database/schema.sql). A direct chat uses a unique `direct_key` to prevent duplicate conversations between the same pair of users.

### Firestore

| Collection path | Purpose |
| --- | --- |
| `chats/{chatId}/messages/{messageId}` | Chat messages |
| `.../readReceipts/{userId}` | Per-message read state |
| `chats/{chatId}/lastSeen/{userId}` | Each user's latest seen message |

The Firestore document shape is maintained in [src/modules/message/schema.ts](./src/modules/message/schema.ts).

## API

All protected endpoints require:

```http
Authorization: Bearer <jwt_token>
```

Successful responses use this shape:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {}
}
```

Errors use a consistent JSON structure:

```json
{
  "statusCode": 400,
  "success": false,
  "error": {
    "message": "JSON body validation failed",
    "key": "err.json-body.failed",
    "details": []
  }
}
```

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health/status` | Checks PostgreSQL and Firestore connectivity |

### Users

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/user/register` | Register a user |
| `POST` | `/user/login` | Log in and receive a JWT |
| `GET` | `/user/me` | Get the authenticated user |
| `PATCH` | `/user/me` | Update the authenticated user's profile |
| `GET` | `/user/:userId` | Get a user by ID |
| `GET` | `/users` | Search or list users |

### Chats

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/chat/create` | Create or return a direct chat |
| `POST` | `/chat/group/create` | Create a group chat |
| `GET` | `/chat/:chatId` | Get chat details |
| `PATCH` | `/chat/:chatId` | Update a group chat name |
| `GET` | `/user/:userId/chats` | List a user's chats |
| `POST` | `/chat/:chatId/members` | Add members to a group chat |
| `DELETE` | `/chat/:chatId/members/:userId` | Remove a member |

### Messages

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/chat/:chatId/message/send` | Send a message |
| `GET` | `/chat/:chatId/messages` | Retrieve messages |
| `PATCH` | `/chat/:chatId/message/:messageId` | Edit a message |
| `DELETE` | `/chat/:chatId/message/:messageId` | Soft-delete a message |
| `POST` | `/chat/:chatId/message/:messageId/read` | Record a read receipt |
| `POST` | `/chat/:chatId/lastseen` | Update last-seen state |

Additional request and response examples are available in [docs/api-reference.json](./docs/api-reference.json). The [Postman collection](./docs/chatflow.postman_collection.json) can be imported directly.

## Local Setup

### Prerequisites

- Node.js 22.16 or newer
- npm
- PostgreSQL 14 or newer
- A Firebase project with Firestore enabled, or the local Firestore emulator

### 1. Install the project

```bash
git clone https://github.com/Upendrapal0607/chatflow-backend.git
cd chatflow-backend
npm install
```

If you already have the repository open, you can skip the clone and `cd` steps.

### 2. Create the environment file

On Windows:

```bash
copy .env.sample .env
```

On macOS or Linux:

```bash
cp .env.sample .env
```

Update `.env` before starting the server:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long random secret used to sign login tokens |
| `JWT_EXPIRES_IN` | No | Token lifetime, for example `7d` |
| `BCRYPT_SALT_ROUNDS` | No | Password hashing cost; the default is `12` |
| `PORT` | No | HTTP port; defaults to `8000` |
| `CORS_ORIGIN` | No | Allowed frontend origin; defaults to `*` |
| `SKIP_DB_PREFLIGHT` | No | Set to `true` only when temporarily skipping startup connectivity checks |

Example local PostgreSQL connection:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatflow
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
PORT=8000
```

### 3. Set up PostgreSQL

Create an empty database, then apply the schema:

```sql
CREATE DATABASE chatflow;
```

Apply the schema with the provided SQL file:

On PowerShell:

```powershell
psql $env:DATABASE_URL -f database/schema.sql
```

On macOS or Linux:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

For local PostgreSQL, you can provide the connection string directly:

```bash
psql "postgresql://postgres:postgres@localhost:5432/chatflow" -f database/schema.sql
```

Alternatively, push the Drizzle schema:

```bash
npx drizzle-kit push
```

### 4. Configure Firestore

Choose one of these options.

**A. Firestore emulator**

Start the emulator and set:

```env
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

**B. Service account file**

Place the Firebase JSON file outside version control and set:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

**C. Inline service account values**

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Or set `FIREBASE_SERVICE_ACCOUNT_JSON` to the raw or base64-encoded service account JSON.

Never commit `.env`, service account JSON files, or private keys.

### 5. Start the server

```bash
npm run dev
```

The API will be available at `http://localhost:8000` by default. Verify it with:

```bash
curl http://localhost:8000/health/status
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run dev:watch` | Start the server with file watching |
| `npm run build` | Compile TypeScript into `build/` |
| `npm start` | Run the compiled application |
| `npm run type-check` | Run the TypeScript compiler without emitting files |
| `npm run lint:check` | Run ESLint with warnings treated as errors |
| `npm test` | Run the Jest test suite |
| `npm run validate` | Run lint, type-checking, and tests |

Before committing or deploying, run:

```bash
npm run validate
```

## Deployment

Set `NODE_ENV=production` and provide `JWT_SECRET`, `DATABASE_URL`, and the selected Firebase credentials through the hosting environment. Do not commit `.env`, Firebase credential files, or private keys.

A typical deployment uses:

```bash
npm install
npm run build
npm start
```

Use `GET /health/status` as the application health check.
