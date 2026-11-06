# Implementation plan — 6 November 2026

New workspace, no existing code or imported Ideas collection. Keep the chosen name Unmasked and accent #6269F5. AGPL-3.0-only. No public deployment.

1. Foundation: npm monorepo, Expo SDK 58 universal client (updated from the initial SDK 55 selection after dependency review), Fastify 5, shared Zod contracts, parameterized PostgreSQL queries, versioned SQL migrations. PostgreSQL server in Compose; PGlite provides a persistent local PostgreSQL development environment without installing Docker. No production fallback.
2. Accounts: scrypt passwords; verification/reset through SMTP (explicit development mailbox on loopback); hashed opaque session tokens, rotating refresh tokens; revocation; privacy settings and discovery defaults. No E2EE claim.
3. Messaging vertical slice: accepted contacts, invitations, direct conversations, transactional idempotent messages, replies/reactions/edits/deletion, cursor pagination, real-time invalidations, durable per-account offline outbox/drafts, read-state privacy and blocking. Verify two accounts, restart persistence, unauthorized access, revocation and concurrent retries.
4. Subsequent slices where feasible: groups, Unmasked consent and per-user disclosures, prompts, private moments, reporting and account export/deletion. Implement genuine server behavior before exposing controls. Track unavailable media, push, providers, native validation and release features explicitly.
5. Product foundation: original layered vector mark, responsive light/dark UI, local persistent developer Ideas with reviewed import, changelog, safe extension interfaces, installable offline web shell. Keep private content out of service-worker caches.
6. Delivery: meaningful automated tests and browser verification; documentation and honest test report; private GitHub repository with testing/beta/main. Build jobs prepared; no release without complete validation. Never promote unvalidated work to stable.

Acceptance: two verified users can register, connect and exchange persistent live messages; no duplicate retries; nonparticipants and blocked users cannot interact; privacy and revoked sessions are enforced by API; nested web routes always offer a back action. Native builds and physical-device behavior require separate evidence.

Architecture risks: web refresh cookies require same-site deployment; local caches contain private data and must be cleared on sign-out; single-process sockets are not horizontally scalable; transport encryption is not E2EE; minors use restricted defaults without claiming age verification.
