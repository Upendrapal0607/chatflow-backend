# ChatFlow Backend — Architecture & Data Flow Guide

Share this guide alongside [docs/api-reference.json](./docs/api-reference.json) and [docs/chatflow.postman_collection.json](./docs/chatflow.postman_collection.json) so anyone reviewing or integrating with the project can understand how every layer interacts.

---

## 1. End-to-End Request & Data Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Koa as Koa + Hooks (useKoa, useLogging, useAuth, Zod)
    participant Service as Module Service (user / chat / message)
    participant PG as PostgreSQL (users, chats, chat_members)
    participant FS as Firebase Firestore (messages, readReceipts, lastSeen)

    Client->>Koa: POST /user/register or /user/login
    Koa->>Service: Validated email + password
    Service->>PG: Insert/verify user (bcrypt hash)
    PG-->>Service: User row
    Service-->>Client: 201/200 { token (JWT), user }

    Client->>Koa: POST /chat/create (Bearer JWT, userAId, userBId)
    Koa->>PG: Verify JWT user + verify both participants active
    Service->>PG: Atomic INSERT ... ON CONFLICT(direct_key) DO NOTHING + SELECT
    PG-->>Client: { chatId, created, chat: { memberIds } }

    Client->>Koa: POST /chat/:chatId/message/send (Bearer JWT, senderId, text)
    Koa->>PG: Verify JWT + check chat_members(chatId, senderId)
    Service->>FS: Write chats/{chatId}/messages/{messageId} with timestamp
    Service->>PG: Touch chats.updated_at
    FS-->>Client: 201 { message }

    Client->>Koa: GET /chat/:chatId/messages?limit=50 (Bearer JWT)
    Koa->>PG: Verify JWT + check chat_members
    Service->>FS: Query messages ORDER BY createdAt DESC LIMIT 50 (reverse to ASC) + lastSeen
    FS-->>Client: 200 { messages, lastSeen }

    Client->>Koa: POST /chat/:chatId/message/:messageId/read (Bearer JWT, userId)
    Koa->>PG: Verify JWT + check chat_members
    Service->>FS: Batch update message.readBy[userId] + readReceipts/{userId}
    FS-->>Client: 200 { receipt }

    Client->>Koa: POST /chat/:chatId/lastseen (Bearer JWT, userId, messageId)
    Koa->>PG: Verify JWT + check chat_members
    Service->>FS: Verify message exists + upsert lastSeen/{userId}
    FS-->>Client: 200 { lastSeen }
```

---

## 2. How Layers Interact Internally

1. **Transport & Root Boundary (`src/app.ts`, `src/lib/hooks/use-koa/useKoa.ts`)**
   - Handles CORS, JSON/multipart body parsing, and catches both `AppError` subclasses (`400`, `401`, `403`, `404`, `409`) and unexpected errors (`500`).
2. **Composable Hooks (`src/lib/core/compose.ts`, `src/lib/hooks/*`, `src/core/hooks/useAuth.ts`)**
   - Each endpoint declares its middleware pipeline explicitly: `useKoa → useServices → useLogging → useAuth → Zod validators → handler`.
   - Validation failures throw `BadRequestError` (`400`) with exact Zod field paths (`error.details`).
   - JWT failures throw `NotAuthenticatedError` (`401`); inactive users or non-members throw `NotAuthorizedError` (`403`).
3. **Database Split**
   - **PostgreSQL (`src/core/database/index.ts`, `database/schema.sql`)**: Source of truth for `users`, `chats`, and `chat_members`. Enforces unique `email`/`username`, unique 1:1 `direct_key`, and foreign-key integrity.
   - **Firebase Firestore (`src/core/firestore/index.ts`, `src/modules/message/schema.ts`)**: Source of truth for messages, read receipts, and last-seen tracking per chat.

---

## 3. Sharing & Testing Checklist

1. Give the recipient:
   - The repository (excluding `.env` and `creds.json` — share secrets securely via env vars).
   - [README.md](./README.md) for setup and scripts.
   - [docs/api-reference.json](./docs/api-reference.json) for `curl` examples, request/response schemas, and step-by-step data flow.
   - [docs/chatflow.postman_collection.json](./docs/chatflow.postman_collection.json) for one-click import into Postman/Insomnia/Thunder Client.
2. Run locally:
   ```bash
   npm install
   npm run dev
   ```
3. Verify code & tests before sharing:
   ```bash
   npm run validate
   ```
