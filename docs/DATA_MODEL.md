# Data model

Migrations 001_initial.sql and 002_access_tokens.sql are authoritative. schema_migrations guards replay. UUID primary keys preserve identity through username changes. Server timestamptz fields are used for ordering and read state.

users stores authentication, identity and privacy attributes. Responses use explicit own-profile or public-person projections and never return password_hash. This first iteration keeps identity/preferences in one table, separate from messages; split them during a justified future migration. sessions references users and stores SHA-256 hashes of 256-bit random refresh credentials. access_tokens references a live session and stores independently expiring hashed access credentials so refreshing one browser tab does not invalidate another tab. Session deletion cascades to all its access tokens. auth_tokens covers verify/reset/invite with expiry. Session expiry 30 days; access expiry 15 minutes; verification/reset 30 minutes; invitation 24 hours.

requests has a partial unique index on unordered user pair for pending requests. contacts and blocks are directed composite keys. Acceptance creates reciprocal contacts transactionally. conversations has a unique direct_key for direct user pairs. participants supplies roles, read cutoff, pin/mute preferences. Removing membership immediately removes HTTP access to history.

messages uses a client-generated UUID idempotency key, conversation membership authorization and database-assigned created_at. Cursor tuple (created_at,id) provides stable pagination with a matching index. reply_to must reference the same conversation. Existing message IDs may be retried only by the same sender in the same conversation with identical text. Tombstones remove body text but preserve chronology. Edits replace body and set edited_at; edit history is not retained.

reactions supports unique per-user emoji toggles. moments is unique per owner/message, always private. unmasked is per-conversation pending/active/ended consent with an inviter. disclosures has a field allowlist (bio/status), attributed to its owner. reports stores only deliberately submitted content/reason and necessary metadata, not a transcript.

Account deletion redacts authored message bodies and removes users, cascading sessions, contacts, blocks, requests, moments and disclosures. Message sender foreign keys become NULL; shared history tombstones remain for other participants. Backups and recipient exports are outside active-database deletion.

Local storage namespaces: unmasked:account:<uuid>:draft:<conversation>, :outbox, :messages:<conversation>; unmasked:ideas; unmasked:theme; unmasked:lastVersion. Private caches are unencrypted and device-local, and are removed at sign-out. Native refresh token is independently protected in SecureStore. Never synchronize local Ideas as messages or include development fixture data in production metrics.

Offline startup may restore the last locally cached own profile only after a network failure, never after an authorization rejection. It permits cached viewing and queued drafts, not server access. Confirmed auth failure removes offline profile identity; sign-out clears it and sets a local signed-out marker.
