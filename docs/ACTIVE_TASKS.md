# Active Unmasked tasks

Resume in this order. Skip blocked tasks until the named dependency changes. Preserve completed entries and record new requests at the end.

| Order / ID | Priority | Request and implementation reference | Status | Evidence or next action |
| --- | --- | --- | --- | --- |
| 1 / UM-01 | High | Check and repair native builds. Native matrix at fddb821. | Verified | Run 43592487910 produced four bundles. All downloaded SHA-256 digests matched. Device iOS arm64, simulator arm64/x86_64 and all four Android ABIs confirmed. Android artifacts are debug. |
| 2 / UM-02 | High | Verify installed native runtime and signed Android distribution. | Blocked | Requires compatible device or emulator access and the authorized persistent Android signing identity. |
| 3 / UM-03 | High | Deploy working accounts and messages on X-Center. Public preview at fddb821. | Blocked | SSH and HTTPS timed out during follow-up. Previous SMTP authentication returned 535; credential replacement was deferred. Recheck reachability and validate SMTP, PostgreSQL and WebSocket before enabling accounts. |
| 4 / UM-04 | High | Apply current UADS quality and continuation requirements. | Implemented | Bootstrap at 9660ef7 passed Checks 43665225676. Sections 51–52 are recorded here. Coverage, accessibility, and production operational evidence remain outstanding. |
| 5 / UM-05 | Normal | First-launch onboarding, replay, isolated sample data and screenshot rendering. | Queued | Implement shared onboarding state and UI, then capture actual platform screenshots with isolated fixtures. |
| 6 / UM-06 | Normal | Developer Server Switcher. | Queued | Define endpoint-specific credential and cache isolation before enabling overrides. |
| 7 / UM-07 | Normal | Live release discovery and installation experience. | Queued | Add download discovery and distinguish empty from unavailable metadata. Activation of alternative distribution depends on authorized releases. |
| 8 / UM-08 | Normal | Release receipts, screenshot maintenance and distribution synchronization. | Queued | Validate release artifacts and metadata before enabling publication. Requires authorized native channels. |
