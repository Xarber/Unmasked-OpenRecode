# UADS section 36 verification — 13 November 2026

## Scope

Root web entry, browser navigation and draft preservation, shared React Native presentation, original repository continuity, and isolated X-Center web preview. The [baseline report](VERIFICATION.md) covers earlier API and application work.

| Area                 | Previous behavior                      | Change and purpose                                                                                |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Web entry            | Secondary product page                 | Root landing with remembered entry and a same-document return to preserve unsaved state           |
| Interactive controls | Static feedback and repeated help text | Brief press and disclosure motion, a shared Reduced Motion preference and grouped contextual help |
| Navigation surfaces  | Opaque panels on all platforms         | iOS Liquid Glass where supported, with opaque panels for Reduce Transparency and other platforms  |

## Checks

- Strict types, ESLint and 17 API/contract tests. Expo SDK compatibility check after aligning seven package versions. Three moderate findings remain in the Expo fingerprint dependency chain. The audit reported no high or critical findings.
- Production Expo Web export on local macOS with the development API and synthetic account fixtures. Chromium exercised first visit, explicit entry, Back/Forward, remembered reload, nested deep links, real sign-in, a conversation draft through a landing round trip, a server-persisted message read by a second account, mobile-width dark mode, reduced motion, install guidance and an offline PWA reload. WebKit exercised the mobile-width first-visit, entry and remembered reload sequence.
- iOS and Android Hermes bundles exported. Native binaries, device execution, Liquid Glass appearance on a device and installed PWA behavior remain to be verified. The local Xcode developer directory was unavailable.
- The repository Ideas file has zero Pending, Approved and Deferred entries. Private device Ideas were outside this verification.

## Deployment boundary

The [X-Center runbook](../platforms/XCENTER.md) describes the loopback-only web preview and rollback. Full PostgreSQL, TLS, SMTP and account flows on X-Center remain pending.
