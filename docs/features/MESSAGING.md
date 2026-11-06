# Reliable messaging slice

A message is created with a UUID on the client. The outbox is persisted before submission, scoped by account. A single serialized storage queue avoids lost writes during overlapping composer/retry activity. HTTP retry preserves UUID/text/reply target. The server checks membership and blocks, validates a same-conversation reply, and inserts transactionally with unique message ID. Repeating the identical submission returns the existing record; collisions with another sender/conversation/body return conflict.

Pending means not confirmed. Saved to server means the database accepted the message. No delivered indicator or recipient-delivery acknowledgment exists. Read cutoffs are exposed only when the reader enabled sharing; disabling sharing returns null, while private unread state still works. Typing/presence are not emitted.

Socket.IO invalidations trigger authorized HTTP refetches. Reconnect sends queued messages, refreshes conversations and current history. Latest page includes up to 50 messages, sorted by server timestamp and UUID, with cursor loading for older pages. Cursor timestamps preserve PostgreSQL microseconds as text rather than round-tripping through JavaScript Date. Full transcript export is separate from pagination. Gaps deeper than the recent cached page require loading earlier pages; this is not a full offline history replica.

Drafts persist per account/conversation. Recent history cache is unencrypted device storage, clearly stale when socket is disconnected. Sign-out clears account caches and pending drafts/outbox; the user should send or export important drafts first. Local sign-out marker prevents automatic web reauthentication if a network failure leaves a server cookie unrevokeable. Revoke the device elsewhere to terminate the remote session in that case.

Delete-for-everyone removes message text, associated reactions and bookmarks with a tombstone; no time limit in this version. Recipient exports/screenshots are outside server control. Edit history and delete-for-self are not implemented. Group role operations lock the conversation, enforce 16-person maximum and prevent the last administrator leaving while others remain.

Clear local cache removes only cached history/summaries and preserves drafts/outbox. Offline page startup restores the local own-profile snapshot only on a network error; 401/403 responses do not unlock cached server data. Group creation checks all participant pairs for blocks and requires accepted contacts for every pairing involving an under-18 account.
