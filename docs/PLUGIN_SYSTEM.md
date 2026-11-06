# Extension boundaries

No third-party plugin runtime or marketplace is implemented. Current modules and shared contracts are separated so future host-controlled registries can add screens/actions/providers without putting untrusted executable code in message rendering or database logic.

Proposed API v1 extension manifest: id, version, supported host version, display name, declared capabilities. Proposed capabilities include `conversation.action`, `profile.section`, `settings.section`, `call.request` and `notes.share`. Registration must be host-owned, validate compatibility and require explicit user consent for any data access/export. Plugins must not receive database handles, session credentials or unrestricted networking by default. Native store builds must exclude prohibited runtime code at build time.

Portal may accept an explicitly initiated call intent containing only approved participant identifiers. Echo may receive only a user-selected note after explicit sharing. These are documented future interfaces, not active integrations. Do not describe a permission registry, sandbox or cryptographic isolation as implemented until its code and tests exist.
