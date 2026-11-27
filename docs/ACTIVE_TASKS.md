# Active Unmasked tasks

Resume in this order. Skip blocked tasks until the named dependency changes. Preserve completed entries and record new requests at the end.

## Usage checkpoint · 2026-11-26

UADS §0 paused new work at 05:20 CET. Weekly usage remaining was 47%, below the 55% minimum with six days and nine hours until the reset on 2026-12-02 at 15:33 CET. No weekly reset was available. Five-hour usage remaining was 37%, with a reset at 09:58 CET on 2026-11-26. Recheck both windows before resuming. With the same remaining usage, the weekly minimum drops to 35% just after 15:33 CET on 2026-11-26.

Next runnable action: inventory the existing Unmasked database and authentication paths for UM-09, then check the exact app registration and compare the provider's data and passwordless capabilities against the inventory. UM-09 is a prerequisite for production account and messaging cutover. Finish independent implementation and preparation before starting any new application build (§8). Resume UM-05 verification alongside the migration when a build is eligible.

Checkpoint verification: Node 24 locked dependency install, TypeScript, ESLint, 17 automated tests and structural UADS validation passed. No new app build or deployment was started. Latest onboarding browser and device behavior and screenshot export remain open.

| Order / ID | Priority | Request and implementation reference | Status | Evidence or next action |
| --- | --- | --- | --- | --- |
| 1 / UM-01 | High | Check and repair native builds. Native matrix at fddb821. | Verified | Run 43592487910 produced four bundles. All downloaded SHA-256 digests matched. Device iOS arm64, simulator arm64/x86_64 and all four Android ABIs confirmed. Android artifacts are debug. |
| 2 / UM-02 | High | Verify installed native runtime and signed Android distribution. | Blocked | Requires compatible device or emulator access and the authorized persistent Android signing identity. |
| 3 / UM-03 | High | Deploy working accounts and messages on X-Center. Public preview at fddb821. | Blocked | SSH and HTTPS timed out during follow-up. Previous SMTP authentication returned 535; credential replacement was deferred. Recheck reachability and validate SMTP, PostgreSQL and WebSocket before enabling accounts. |
| 4 / UM-04 | High | Apply current UADS quality and continuation requirements. | Implemented | Bootstrap at 9660ef7 passed Checks 43665225676. Sections 51–52 are recorded here. Coverage, accessibility, and production operational evidence remain outstanding. |
| 5 / UM-05 | Normal | First-launch onboarding, replay, isolated sample data and screenshot rendering. | In Progress | Shared introduction and read-only sample conversation at `1c449a2`. Verify the latest browser and native behavior, add the capture/export workflow, and capture missing platform screenshots. |
| 6 / UM-06 | Normal | Developer Server Switcher. | Queued | Define endpoint-specific credential and cache isolation before enabling overrides. |
| 7 / UM-07 | Normal | Live release discovery and installation experience. | Queued | Add download discovery and distinguish empty from unavailable metadata. Activation of alternative distribution depends on authorized releases. |
| 8 / UM-08 | Normal | Release receipts, screenshot maintenance and distribution synchronization. | Queued | Validate release artifacts and metadata before enabling publication. Requires authorized native channels. |
| 9 / UM-09 | High | Integrate X-Center ID for Settings sync, friends and service data. Replace the existing app database completely. | In Progress | Official SDK 0.7.0 and exact callback `/api/account/callback` implemented. Issuer accepted authorization setup and local callback regression passed. Verify full staged sign-in and delegated permissions, obtain the separate verified service key, and preserve existing relational guarantees before any data cutover. [Migration details](features/XCENTER_ID.md). |
| 10 / UM-10 | High | Create and verify the X-Center ID callback backend using the registered path. | Implemented | Fastify route and X-Center proxy/cookie behavior are configured. Test fixture callback succeeded. Public route still returns preview 503 until full backend staged and verified. |

## Usage checkpoint · 2026-11-27

UADS §0 paused new work with 6% remaining in the five-hour window (reset at 18:16 CET on 2026-11-27). Weekly usage remaining was 43% (reset at 12:07 CET on 2026-12-03). Changes at `ac1341a` are on `testing`. The isolated X-Center runtime passed the callback guard and live authorization initiation. The public route still serves preview HTTP 503.

After rechecking both usage windows, stage the normal web/API combination with an isolated account and validate the authenticated provider callback and scoped data actions. The production stack still requires the previously deferred SMTP setup or a verified passwordless provisioning and recovery path. Service-data migration requires the separate verified-app database key and a storage design that preserves the current transactional guarantees.
