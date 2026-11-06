# Architecture

Unmasked is a new npm monorepo with a single universal Expo Router application in apps/mobile, not separate duplicated web/native clients. Expo 58, React 19.3 and React Native 0.88.1 use the installed expo/bundledNativeModules.json compatibility matrix. Initial SDK 55 choice was superseded during dependency review. Fastify 5.12.8, Socket.IO 4, PostgreSQL and Zod 4 serve the same client on all platforms. Versions are locked in package-lock.json.

## Modules

- packages/contracts: Zod input contracts, TypeScript response models, prompts and portable Ideas schema.
- apps/api/src/app.ts: middleware, error handling, Socket.IO authentication and shared authorization context.
- auth.ts/security.ts: scrypt, hashed random credentials, email verification/reset, rotation and session revocation.
- identity.ts: profiles/privacy, restricted discovery, contacts, invitation tokens, blocking.
- messaging.ts: conversation creation/listing, message cursor history/search, idempotent writes, replies, edits, tombstones, reactions and read state.
- groups.ts: administrator-controlled membership, promotion, rename and leave; 16-person limit and last-admin protection.
- features.ts: Unmasked consent/disclosure, prompts, private moments, explicit reports, account exports/deletion.
- db.ts and migrations: parameterized PostgreSQL access and versioned, transactional schema setup. pg.Pool in self-hosted deployments, PGlite (WASM PostgreSQL) on persistent local storage only for development. No SQLite or custom JSON database.
- apps/mobile/src: session/provider, API adapter, secure native credentials vs web HttpOnly cookies, serialized outbox persistence, exports and shared UI.
- apps/mobile/app: welcome/authentication, inbox, connections, conversation details, settings, moments, developer tools and fallback routes. Routes always offer an explicit back action on detail pages, including direct URL entry.

## Data flow

The API checks the live database session on every protected request. Socket authentication joins per-user and per-session rooms. A commit emits only a sync invalidation; clients fetch authorized data through HTTP. Reconnecting clients invalidate queries, refetch current history and retry the durable outbox using original UUIDs. HTTP writes remain the source of truth. No socket event is evidence of delivery.

Client credentials are in memory (access), native SecureStore (refresh) or web HttpOnly SameSite=Strict cookies (refresh). Drafts, outbox and recent message-page cache use account-scoped AsyncStorage. Ideas are separate local developer data. The service worker caches only public build assets, never private API data.

## Deliberate constraints

Single API process for realtime fan-out; Redis adapter and distributed rate limiting are required before scaling horizontally. Redis/MinIO optional Compose services are preparation, not active message/media dependencies. No E2EE, attachments, push, passkeys, provider login, P2P transport or automatic native updates are implemented. Server-side history is required for cross-device sync. No proprietary backend dependency.

ConversationOptions and MessageBubble separate group/consent controls and per-message rendering/actions from the timeline route. PostgreSQL cursors carry the server timestamp with full microsecond precision, avoiding JavaScript Date truncation at page boundaries.
