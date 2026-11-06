# Development

Requires Node 24 and npm 11. No Docker, SDK or simulator installation is needed for local API/web work. Use the locked dependency set, not examples from another Expo SDK.

From the repository root:

```sh
npm ci
cp .env.example .env
npm run db:migrate
# Optional, only on an empty embedded development database, BEFORE starting the API:
npm run seed
npm run dev
```

Web opens at http://localhost:8081 and API at http://localhost:3001. `npm run dev` runs both. `npm run dev:api` starts only the API. `npm run web` starts Expo Web. `npm run mobile` starts Expo for iOS/Android; use a compatible Expo Go or development build. No native device execution is established by the web build.

PGlite is persistent PostgreSQL, owned by one process at `.data/unmasked`. The API applies versioned migrations at startup. Stop the API before standalone migration/seed scripts against the embedded database. Root-relative DATA_DIR resolution is shared across scripts. Do not delete .data to recover from an error; it contains accounts/messages. Production requires server PostgreSQL, SMTP and HTTPS origin and refuses the development fallback.

The optional seed generates two clearly named development accounts and a real conversation through the API. The random local password is written with restrictive permissions to `.data/development-accounts.json` (ignored by Git). Never use fixtures or development credentials on production. No fixture is preloaded into production builds.

Without SMTP, `/dev/mailbox` supplies verification/reset codes only in development with a loopback-bound API and loopback client IP. It is absent from production. To use real mobile devices on the LAN, configure SMTP and the correct HOST, WEB_ORIGIN and EXPO_PUBLIC_API_URL; no mailbox may be exposed on the LAN. SecureStore protects native refresh credentials. Web origin and API must be same-site for refresh cookies; localhost ports work locally.

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
npm run preview
npm run branding
```

Preview serves the production export at localhost:8081, with SPA fallback for nested routes; stop Expo Web first to free the port. PWA metadata is added by scripts/pwa.mjs after Expo's single-page export; +html.tsx documents the static-rendering variant but single-page exports do not use it.

Build native projects with existing toolchains only:

```sh
cd apps/mobile
npx expo prebuild --platform ios
npx expo run:ios
npx expo prebuild --platform android
npx expo run:android
```

Prebuild generates ignored native directories. Manual GitHub Actions workflows are preferred for artifacts. Native signing, push and provider credentials are not included. Do not install a large local toolchain without approval. See RELEASES.md.

Configuration template `.env.example` lists local defaults. For Compose additionally set POSTGRES_PASSWORD, SMTP_URL, MAIL_FROM, HTTPS WEB_ORIGIN and EXPO_PUBLIC_API_URL; the optional object-store profile needs MINIO_ROOT_PASSWORD. Use URL-safe database passwords or percent-encode credentials in DATABASE_URL. No keys belong in the client or tracked files.
