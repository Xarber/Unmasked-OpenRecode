# Implemented feature inventory

Implementation is an initial working release candidate foundation, not completion of the entire specification. See verification for actual test evidence.

- Email/password registration, email verification, password reset, hashed opaque access/refresh tokens, refresh rotation, session listing and revocation. Development-only local mailbox is loopback-bound. SMTP is required in production; external SMTP delivery is not verified here.
- Pseudonymous profiles and mutable usernames using stable user IDs. Private-by-default discovery and disabled read receipts/typing. Minors cannot enable discovery or search users; private invitation tokens are required for their connection requests. This is self-declared age grouping, not age verification.
- Contact requests with acceptance/rejection, accepted-contact direct chats, and private invitation URLs with 24-hour expiry. Block/unblock prevents interaction and ends Unmasked sessions.
- Direct and small group conversations; contact-based group creation; group rename, administrator assignment, add/remove, leave and last-admin protection. Group cap: 16 participants. Every under-18 participant must already be an accepted contact of every other member; blocked pairs cannot be combined in a group.
- Persistent text and Unicode emoji, replies, editing, delete-for-everyone tombstones, toggle reactions, search, cursor history, pinning, unread state and configurable exposed read timestamps.
- Socket-driven updates and reconciliation after reconnect; native/web durable outbox with stable retry IDs; persistent drafts; account-scoped recent message-page cache, with offline startup from the cached local identity only on network failure. Status distinguishes pending, failed and saved to server. No delivered status.
- Optional prompt selection inserts into the draft and requires the user to send. Unmasked Mode requires invitation and acceptance; each participant independently reveals/hides bio or check-in status. Ending or blocking clears disclosures. Identity/handle remain the normal messenger identity; this is not anonymous stranger matching.
- Private saved messages with JSON export; API supports optional private notes. Shared bookmark consent and UI note editing are not implemented.
- Explicit report submission, account/conversation exports, account deletion and active-session invalidation. Reports require operator handling; no moderator dashboard/appeal/ban system exists yet.
- Responsive shared UI, light/dark/system appearance, accessible labels, native-safe layout and detail-route back fallback. Layout and accessibility require more device testing.
- Developer unlock by version triple-tap; expires after 30 seconds inactivity/backgrounding or main-tab change. Persistent Ideas creation/edit/delete/duplicate, history, search/filter/sort, per-item sharing and reviewed merge import/export. No automatic repository/device synchronization or batch-selection UI.
- Persistent version marker, user changelog, post-update notice (not on first sign-in), diagnostics footer. No released native artifacts/update feed yet.
- Layered SVG identity and reproducible exports; manifest/service worker with public app-shell offline caching and user-triggered activation.
