# Changelog

All changes below are unreleased implementation work, not published application versions.

## [0.1.0] — Unreleased

### Added

- Verified email/password accounts, password recovery, rotating refresh sessions and device revocation.
- Private invitations, accepted-contact messaging, blocking and age-restricted discovery defaults.
- Persistent realtime text conversations, group management, replies, reactions, edits, deletion, search, pagination and drafts/outbox.
- Optional Unmasked consent, independent bio/check-in sharing and private saved moments.
- Data exports, active-database account erasure and explicit reports.
- Responsive Expo interface, themes, local developer Ideas and public-shell PWA configuration.
- PostgreSQL/PGlite migrations, self-hosting configuration, automated backend/contract tests and private CI/build scaffolding.

### Fixes & Improvements

- Aligned Expo 58 module versions; removed high-severity advisories identified in the initial dependency set.
- Separated access-token expiry from refresh rotation so existing tabs are not invalidated whenever another tab refreshes.
- Added initial storage-directory creation and direct nested-route back fallback.

### Security and known limits

- No E2EE, media uploads, push, provider/passkey login, automatic native updater or public release.
- Native device builds, Docker staging and physical-device verification remain outstanding.
- See docs/ROADMAP.md and docs/reports/VERIFICATION.md; do not interpret the list as completion of the full product specification.
