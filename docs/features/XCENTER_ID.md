# X-Center ID for Unmasked

The registered production callback is `https://unmasked.xcenter.it/api/account/callback`. Nginx removes the `/api` prefix, and Fastify handles `/account/callback`. Enable the integration by providing `XCENTER_CLIENT_ID`, `XCENTER_CLIENT_SECRET` and `XCENTER_REDIRECT_URI` only to the API. The deployment credential is available in the owner’s Keychain. Give the production API the protected environment values directly. Keep them out of browser and native builds.

Use the official Node SDK 0.7.0 from source revision `57c4930abe34003dfb74923ec823ef6245a985ce`. The provider’s install guide uses source tarballs for Node. The committed packages follow that process and npm checks their integrity at install. See the [hosted SDK guide](https://id.xcenter.it/docs/sdk/install) and [SDK source](https://github.com/Xarber/xcenter-id-sdk/tree/57c4930abe34003dfb74923ec823ef6245a985ce).

## Web account linking and sign-in

Unmasked keeps a stable account because message ownership, contact consent and a cross-device inbox depend on it. An existing verified user confirms their Unmasked password once to link X-Center ID. The issuer’s pairwise subject is linked to the existing Unmasked UUID. An email or username match cannot attach an account. The callback atomically consumes a short-lived attempt bound to the initiating browser cookie. The SDK validates the OIDC code, state, nonce, PKCE and subject. The API issues a separate, short Unmasked session, bounded by the issuer token’s lifetime. X-Center ID tokens stay in API memory and disappear on expiry or restart. The live product session is required for every delegated request. No refresh token is requested for this short-session flow.

In Settings, a user signed in with X-Center ID can load, apply, save or remove their appearance setting. The record is private in their app container. An explicit save uses the last loaded revision and surfaces a conflict instead of overwriting another device’s change. In Connections, the friends action fetches the accepted friend list through the current user grant. It shows only already linked, discoverable adult accounts, excludes blocks in either direction, and keeps the normal invitation flow. If permission is denied, the underlying Unmasked features remain available.

## Service data and migration

`npm run xcenter:check-storage` performs a read-only check using `XCENTER_CLIENT_ID` and the separate `XCENTER_DATABASE_KEY` issued to an administrator-verified registration. The OAuth secret is only for code exchange. The check neither provisions storage nor moves data.

The hosted record contract provides bounded JSON and per-record compare-and-swap. It does not document a multi-record transaction, foreign keys or indexed cross-record queries. Unmasked currently uses those for reciprocal contact acceptance, group roles, membership and block checks, message retry ownership, redaction and exported account data. A direct copy to independent records would lose those guarantees. Full replacement requires a reviewed data model that provides equivalent atomic behavior, a verified private service namespace, reconciliation and a demonstrated rollback. Keep PostgreSQL as the system of record while these are pending. See the [data model](../DATA_MODEL.md) and [hosted storage contract](https://id.xcenter.it/docs#hosted-data).

## Verification status

The live issuer accepted the exact authorization request and redirected to its sign-in interaction. Fastify tests use a synthetic issuer exchange. The public preview returned 503 on the callback before deployment. Live callback exchange, browser application behavior, native browser handoff and physical FIDO2 usability remain unverified. New-user provisioning, persistent opt-in renewal, wider automatic settings sync and full service-data migration remain open. Publishing the current web slice requires staging against a working transactional API and an authenticated end-to-end test account.
