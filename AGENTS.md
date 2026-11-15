# Unmasked agent entry point

Read docs/INDEX.md, docs/ARCHITECTURE.md, docs/ROADMAP.md and the latest docs/reports/VERIFICATION.md before substantial changes. The user's Universal Application Development Standards apply. Never imply the entire specification is implemented.

## Session start / Ideas

Read docs/IDEAS.json at the start of each substantial development session. Count Pending, Approved and Deferred ideas; summarize relevant entries and ask whether to implement them now or another time. Do not implement unrelated ideas without selection. Check whether an idea is already implemented before proposing work. Update statuses only after verification, preserving history and recording commit/version/changelog references. On-device Ideas are not automatically accessible: the owner must export them into docs/IDEAS.json. Never claim automatic retrieval from a device. An empty repository collection does not prove that devices contain no ideas.

## Commands and boundaries

Node 24, npm workspaces. `npm ci`, `cp .env.example .env`, `npm run dev`. PostgreSQL migrations shared by production PostgreSQL and embedded development PGlite. Never open two processes against the embedded database. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`. See docs/DEVELOPMENT.md for exact paths and native build commands.

All original code AGPL-3.0-only. Work goes to testing, then beta, then main. Conventional Commits. testing has no automatic full builds/releases. The owner confirmed public Xarber/Unmasked is the original project. Keep its history available through the fetch-only original-project remote. Current development uses Xarber/Unmasked-OpenRecode. The owner authorized public source and an X-Center web deployment.

Native release publication and external store submission require separate authorization. Do not embed private GitHub tokens. No E2EE is implemented. No message delivery acknowledgment exists: UI may say saved to server, never delivered. Socket events carry only invalidations. Every protected operation must verify the current database session and conversation membership. Keep device caches separate by user, and clear them on sign-out.

Keep modules split between app wiring, authentication, identity/connections, messaging, groups, product features, contracts and platform adapters. No plugin code execution. Portal/Echo hooks must be host-controlled and require explicit data-sharing consent. Update docs and the verification report for meaningful changes. Preserve unfinished features as roadmap entries, not completed release notes.

Read uads.json and docs/UADS_REQUIREMENTS.md before substantial work. Validate with npm run uads:validate and record scoped functional evidence separately.

Reconcile the ordered development queue in docs/ACTIVE_TASKS.md at the start and end of substantial work.
