# Verification report — 6 November 2026

[Follow-up UADS and browser verification](UADS-36.md) covers the November 13 changes.

## Scope and environment

New application foundation and working messaging slice, with selected groups, Unmasked consent, moments and developer tools. This is **not** completion or an audit of the entire product specification.

Executed locally on macOS with Node 24.14.0, npm 11.9.0, Expo 58.0.23, React 19.3.0, React Native 0.88.1, TypeScript 6.0.x, Fastify 5.12.8 and persistent/isolated PGlite PostgreSQL. Browser checks used the Codex in-app desktop browser, a real production Expo web export and the local API. Phone layout was inspected at a 390×844 browser viewport; this is not a physical phone.

## Passed checks

- `npm run typecheck`: strict API/contracts/client type checking passed.
- `npm run lint`: passed.
- `npm test`: **17 tests passed, 0 failed**. Real Fastify requests, PostgreSQL storage and actual Socket.IO TCP connections; no mocked database/chat-success responses.
- Accounts: registration contracts, verification-dependent authentication, invalid login, uniqueness, scrypt storage, refresh-token replay rejection, access expiry, multi-device revocation and forced socket disconnection.
- Password reset: consumes code, changes password, revokes prior sessions and rejects code reuse.
- Connections: private discovery defaults, personal invitation, recipient-only acceptance, direct-conversation uniqueness, nonparticipant denial and blocked interaction.
- Messages: persistent live exchange, concurrent identical retry deduplication, ownership guards, reply/reaction, read privacy, server restart, exports, tombstones and account deletion.
- Groups/history: administrator and last-admin guards, membership removal/access denial, add/rename/leave, all-pair blocking checks, minor contact requirements, 55-message cursor pagination, full exports, search and cross-conversation reply rejection. Pagination fixture deliberately places timestamps within one JavaScript millisecond to verify PostgreSQL microsecond preservation.
- Ideas contracts: JSON round trip, stable IDs, deduplication, preserved default conflicts, explicit newer merge, invalid project/schema/status rejection.
- `npm run build:web`: production export and versioned public-shell service worker generated successfully.
- `npx expo install --check` from apps/mobile: passed after aligning React types and TypeScript with SDK58.
- iOS and Android **JavaScript/Hermes export** succeeded. This is bundling only, not Xcode/Gradle compilation, installation or native execution.

## Browser journeys actually performed

1. Signed in to a labeled local development account; opened its real persisted conversation and sent a message through the composer. It appeared as saved to server.
2. Stopped the development API, submitted a message, observed pending state, restored API and observed reconciliation. No delivered status was invented.
3. Refreshed a nested conversation URL and verified the back action remained available.
4. Inspected desktop/light and phone-size/dark conversation layouts, plus mobile navigation.
5. Switched to Light and verified persistence after reload. Applied an app-shell update through the in-app confirmation; the update notice disappeared after activation.
6. Enabled browser offline network emulation, reloaded the conversation, and observed cached history with an interrupted-connection indicator.
7. While offline, queued a synthetic message, reloaded again, and verified the pending message survived. Restored normal networking; the message became saved. An independent API export check confirmed **exactly one** corresponding server message. Network emulation was restored to normal.
8. Unlocked developer tools through three version taps, saved a clearly labeled synthetic Rejected QA idea, and verified it remained after offline reload. Switching the main tab removed the developer entry until triple-tap was repeated. The local fixture is not an actionable product idea and was not imported into docs/IDEAS.json.

[Real desktop screenshot](unmasked-chat-desktop.png) contains development fixtures only. No personal conversation content is used.

## Problems found and corrections

- Dependency download timed out initially; retry completed without replacing the package lock with an incompatible set.
- Initial SDK55 dependency chain had high-severity advisories. Switched to SDK58, matched its bundled native-module matrix, updated Nodemailer/Sharp and aligned React types/TypeScript. Final audit at this stage: **11 moderate, 0 high, 0 critical**; remaining tooling advisories are not resolved by this delivery.
- First persistent DB launch failed because its parent directory did not exist; database initialization now creates it safely. Documented setup and seed then succeeded.
- Refresh originally invalidated another tab's access token. Introduced session-associated independently expiring access tokens and Web Locks for cross-tab cookie rotation where available.
- Corrected cursor precision, exhausted-pagination UI state, reply-idempotency comparison, minor/group contact constraints and all-pair block checks.
- Split conversation options and message rendering into reusable components. Guarded stale auth requests/outbox callbacks around sign-out. Read-cache cleanup now preserves drafts/outbox.
- Root launch commands now propagate the root environment to Expo; web exports load only public entries and preserve externally configured values.
- Native browser confirmation obstructed the automation check. Replaced it with visible in-app reload confirmation and activation acknowledgment; that path was verified.

## Remaining verification and release gates

Docker is unavailable here: Compose/Nginx/server PostgreSQL/maintenance worker staging, SMTP deliverability, TLS/reverse-proxy behavior and restore/rollback have not been executed. PGlite results are not a substitute for a server PostgreSQL deployment test.

No iOS Simulator, Android Emulator, physical iPhone/iPad or physical Android test was performed. No unsigned IPA, simulator app, signed universal APK or AAB was built. Native matrix is prepared but needs configured HTTPS API_ORIGIN and Android signing secrets; package/ABI/signature validation and release coordination are incomplete. No release, prerelease, public distribution source or production deployment occurred.

Actual Android/iOS/desktop PWA installation interfaces, browser push, hardware keyboards/screen readers, dynamic text extremes, native lifecycle/SecureStore persistence, battery/performance and a comprehensive scripted browser E2E suite remain unverified. Full offline history, E2EE, media/voice/push, passkeys/OAuth, complete moderation/appeals, automatic native updates and full Ideas batch/file-picker/changelog integration remain unfinished. See ROADMAP.md.

## Git and remote checks

Private repository: Xarber/Unmasked-OpenRecode. Work is on testing; beta/main retain the bootstrap until promotion is justified. Commits are unsigned because the configured hardware-backed signing key was unavailable; no signing identity or global Git setting was changed. No temporary feature branches/worktrees were created, so none require cleanup.

Remote CI status is recorded below only after actual submission/observation. Local results above do not imply a remote run, native build or deployment succeeded.

### Final local and remote handoff

- Root `npm run dev` was executed after the environment launcher correction: API health and Expo Web both returned HTTP 200. Owned API/Expo preview processes were then stopped; ports 3001/8081 are no longer serving this task.
- Final production web export at source commit `eaec853` succeeded, with public environment loading and the exact build commit embedded. Generated service-worker JavaScript passed `node --check`.
- GitHub Actions YAML passed actionlint 1.7.12 validation with ShellCheck disabled. The temporary official actionlint binary was checksum-verified; no SDK or global toolchain was installed. This validates workflow definitions, not native packages.
- Manual Linux Checks submitted for `eaec85384ae68b5d73cd4f62bb234a436d0e0eac` via [run 42269836284](https://github.com/Xarber/Unmasked-OpenRecode/actions/runs/42269836284). The commit identifier in the run must be used as authoritative provenance; the short local identifier is `eaec853`. Last observed status: **in progress**, at dependency installation. No remote success is claimed. The previous baseline run is [42269629023](https://github.com/Xarber/Unmasked-OpenRecode/actions/runs/42269629023).
- Dependabot opened dependency/action update PRs after repository setup. They remain independent, unmerged proposals; their individual success/failure is not a check of the exact testing head. Active Dependabot branches/PRs were preserved.
- `testing`, `beta` and `main` were pushed to the private repository. testing is the default branch and contains implementation; beta/main retain bootstrap commit `664192d`. No temporary task worktree or feature branch needs removal. No public release/deployment occurred.

## X-Center ID callback and managed data · 2026-11-27

- Source checks: TypeScript, ESLint and UADS structural validation passed. The local test suite passed all 18 tests, including callback binding and replay rejection, explicit incumbent-account linking, short-session restoration, private appearance writes, conflict handling, and exclusion of unmatched/self friend entries. The issuer exchange and data responses in these tests are fixtures.
- Live issuer accepted the exact Unmasked callback in an SDK authorization request and returned HTTP 303 to its sign-in interaction. The saved Keychain credential was supplied to the backend SDK process. This test did not exchange a live authorization code or validate the secret against the issuer token endpoint.
- The public domain served preview revision `fddb821` and returned HTTP 503 for `/api/account/callback`. The appliance was reachable over SSH. No new deployment or application build was started.
- Service storage preflight lacks the separate verified-app database key. Live browser callback, native authentication and physical FIDO2 remain pending. See [X-Center ID](../features/XCENTER_ID.md).
