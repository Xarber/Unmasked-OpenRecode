# Remaining delivery scope

This delivery prioritizes the specification's phases 1–3, plus bounded working features from later phases. It is not the finished product described by the full specification.

## Required before a public service or stable release

- Validate server PostgreSQL/Compose/TLS/SMTP in a real staging environment. Review migrations, backup restoration, production deployment and rollback. Docker is not available on this workstation.
- Complete native release builds, package/signature/architecture validation and physical iOS/Android checks. Provide authorized HTTPS API origin and existing Android signing credentials. Do not publish partial artifacts.
- Independent security review, abuse/anti-spam controls, distributed rate limiting, operator moderation console, account suspension/ban enforcement and appeals. Establish human safety contact and backup/report retention policy.
- Test longer histories, export memory limits, mobile suspension, cache/keychain persistence and network failures. Large exports currently load in memory. Multi-tab refresh uses Web Locks when available; browser fallback races require additional testing.
- Resolve remaining dependency advisories in build tooling without breaking Expo's supported package matrix. No known high/critical advisory remained after SDK58 alignment at the last local audit; consult the verification report for exact counts.

## Phase 4 — communication completion

Media/photo/video/file uploads, validation/quarantine/size limits and authorization; S3/MinIO integration; voice recording/playback; upload progress/retry/cancellation; push notification registration/delivery/preferences/muting; QR generation/scanning; message copy/forward attribution; delete-for-self; media galleries; explicit delivery acknowledgments; group system events and membership history. Optional Redis/MinIO Compose profile does not mean these are implemented.

## Phase 5 — additional authentic features

Shared bookmarks requiring reciprocal consent; private-note editing UI; saved-moment timeline details and history; richer categorized prompts; configurable profile avatar/pronouns/interests; more complete check-in controls. Unmasked Mode is optional consent over bio/status within a known-contact chat, not anonymized identity matching.

## Phase 6 — privacy, native quality and scale

Audited cross-platform E2EE with reviewed multi-device identity/key lifecycle; passkeys and optional Apple/Google authentication; complete per-operation audit policy; server-enforced disappearing messages; block-send concurrency/linearization review under production load; P2P feasibility and transport abstraction; distributed socket adapter; incremental change-feed sync for histories older than the current 50-message cache; native accessibility/performance/background/offline profiling; locale support and full WCAG review.

## Phase 7 — release and standards completion

Unified structured user/developer changelog, exact build footer in all artifacts, native/OTA update metadata and secure discovery; Android in-app APK download/integrity/signing validation/PackageInstaller; store-specific update methods; web update release notes beyond a generic app-shell update notice; comprehensive Ideas batch operations/native file import/history conflict UI and explicitly configured repository sync; native splash/layered Apple asset catalog validation; full plugin host capability registry and extension permissions. No public destinations, mutable metadata release, store submissions or update feed are activated.

## Future OpenRecode interfaces

Portal calling and Echo explicit note sharing are documented extension contracts only, not implemented applications/integrations. Do not send conversation data across applications without explicit per-action consent.
