# Testing

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`. `npm test` uses Node's test runner via tsx with real Fastify injection, real Socket.IO TCP sockets, and real PostgreSQL via isolated PGlite databases (temporary disk or memory). It is not a mocked repository or fake success server. Temporary test databases are removed only after test completion.

Integration journeys verify account validation/password hashing, verified login, invite acceptance, real-time invalidation, message retrieval/idempotency under concurrent retries, read privacy, optional independent disclosure, refresh replay/expiry, revocation, private bookmarks/reports, database restart, blocking, minor discovery, exports/deletion and origin checks. Group tests exercise role/last-admin guards, removed-member access, rename/add/leave, stable pagination across 55 messages, search, complete exports, cross-conversation reply rejection and tombstones. Ideas tests verify round trips, identifiers, deduplication, default conflict preservation and schema rejection.

Manual browser verification uses the exported application, local production static server and actual development API. Development fixtures are explicitly labeled and isolated from any production database. Local browser testing is not physical-device testing. See reports/VERIFICATION.md for the checks actually executed, results and limitations.

Before a native release, test portrait/landscape, safe areas, keyboard, dynamic text, screen readers, modal/navigation behavior, light/dark/system themes, foreground/background, process death, session revocation, account switching and offline retry on physical iOS/Android devices. Also verify actual App Store/Play/sideload channel behavior. A successful Metro export does not establish those results.

For PWA release, verify manifest parsing/icon safe zones, actual installed app on Android/iOS/desktop, offline shell and private cache behavior, update activation without lost drafts, deep links and browser history. HTTP metadata checks are insufficient evidence of installation.
