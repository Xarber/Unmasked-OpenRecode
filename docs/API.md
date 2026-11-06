# API and real-time contract — v0.1

Base URL is configured, not embedded production infrastructure. JSON over HTTPS in production. Protected endpoints require `Authorization: Bearer <accessToken>`. Every access validates a current database session, not only a token signature. Error JSON `{message, issues?}`; 400 validation, 401 session, 403 forbidden, 404 inaccessible/missing, 409 conflict, 429 rate limit. Unknown conversation IDs do not bypass membership checks. Zod contracts live in packages/contracts.

## Routes

| Method              | Path                              | Input / result                                                                                                                           |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET                 | /health                           | database readiness, version, commit, e2ee=false                                                                                          |
| POST                | /auth/register                    | email, username, displayName, password (12–128), ageBand minor/adult; 201 verification pending                                           |
| POST                | /auth/verify                      | token; consumes code and verifies email                                                                                                  |
| POST                | /auth/resend                      | email; generic response, throttled                                                                                                       |
| POST                | /auth/login                       | email, password, optional device; accessToken, refreshToken, sessionId, own profile                                                      |
| POST                | /auth/refresh                     | native refreshToken or web HttpOnly cookie; rotates refresh credential and issues an independently expiring access credential atomically |
| POST                | /auth/logout                      | authenticated; revokes current session and clears cookie                                                                                 |
| POST                | /auth/forgot                      | email; generic response, throttled                                                                                                       |
| POST                | /auth/reset                       | token, password; consumes code, replaces hash and revokes all sessions                                                                   |
| GET / DELETE        | /sessions, /sessions/:id          | list own devices / revoke one owned session                                                                                              |
| GET / PATCH         | /users/me                         | own Profile / displayName, username, bio, status                                                                                         |
| PATCH               | /settings/privacy                 | discoverable, readReceipts, typingIndicators booleans; minor discovery cannot be enabled                                                 |
| GET                 | /users?q=prefix                   | discoverable adult profiles, no blocks, >=3 chars; disabled for minors                                                                   |
| GET                 | /connections                      | contacts, pending incoming/outgoing requests, own blocked users                                                                          |
| POST                | /connections/invitation           | 24-hour invitation URL containing secret; share deliberately                                                                             |
| POST                | /connections/requests             | username, optional invitation token; 201; token required for private/minor connections                                                   |
| POST                | /connections/requests/:id/respond | accept boolean; only recipient, pending only                                                                                             |
| POST / DELETE       | /blocks, /blocks/:id              | userId to block / unblock; blocking ends disclosures                                                                                     |
| GET / POST          | /conversations                    | authorized summaries / participants UUID array, optional group title; 201                                                                |
| PATCH               | /conversations/:id                | own pinned/muted booleans; mute storage prepared, no push service yet                                                                    |
| POST                | /conversations/:id/membership     | action add/remove/promote/leave/rename; userId or title as applicable; group admins only except own leave                                |
| GET                 | /conversations/:id/messages       | optional before opaque cursor and q text; `{messages,nextCursor}`; ascending page of latest <=50                                         |
| GET                 | /conversations/:id/export         | complete authorized history, portable JSON (not just current page)                                                                       |
| POST                | /conversations/:id/messages       | id UUID, text 1–8000, optional replyTo; 201 persisted message; duplicate same ID/sender/conversation/text returns existing               |
| PATCH / DELETE      | /messages/:id                     | author edit text / tombstone for everyone; no time limit; no delete-for-self yet                                                         |
| POST                | /messages/:id/reactions           | emoji allowlist; toggles own reaction                                                                                                    |
| POST                | /conversations/:id/read           | updates private unread cutoff; exposed only when that user's readReceipts=true                                                           |
| GET                 | /prompts                          | static optional prompts; never auto-sent                                                                                                 |
| GET / POST          | /conversations/:id/unmasked       | mode/disclosures / action invite, accept, end, reveal, hide; field bio/status; two participants only                                     |
| GET / POST / DELETE | /moments, /moments/:id            | private bookmarks / messageId, note / remove own bookmark                                                                                |
| POST                | /reports                          | userId, optional messageId, reason, submittedContent; only submitted content recorded                                                    |
| GET / DELETE        | /account/export, /account         | own profile/contacts/moments/authorized history / confirmation DELETE                                                                    |

## Real-time

Socket.IO 4 on the API origin. Connect with `auth: {token: accessToken}`. Origin restriction matches WEB_ORIGIN. Server joins `user:<uuid>` and `session:<uuid>` internally; clients cannot choose a room. `sync` payload `{at: ISO timestamp}` is an invalidation signal with no private content. Clients fetch history, merge by stable IDs, and replay outbox writes. There are no socket-based message writes or delivery/read acknowledgments. Live access is rechecked every 15 seconds and actively disconnected on revoke/deletion. Real-time events may be missed; HTTP reconciliation is authoritative.

HTTP retries retain original UUID, text and reply target. A duplicate ID belonging to another conversation/user or different body is rejected. Rate limits are per-process/per-IP; configure distributed controls before multi-instance production. Pagination cursor encodes timestamp and UUID; clients treat it as opaque. Full account/conversation exports currently load into memory; streaming export is a roadmap item for large histories.
