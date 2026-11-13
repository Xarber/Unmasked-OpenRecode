# Self-hosting and rollback

See [X-Center preview](platforms/XCENTER.md) for the isolated web-only deployment. Public hosting and the full service are pending. Compose has been prepared but cannot be executed on the current workstation because Docker is unavailable. Do not interpret configuration as an operational deployment.

## Bring up an isolated stack

Install Docker only with the machine owner's authorization. Create `.env` from the template. Set a URL-safe POSTGRES_PASSWORD, production SMTP_URL/MAIL_FROM, HTTPS WEB_ORIGIN and HTTPS EXPO_PUBLIC_API_URL. Choose same-site origins (e.g. app.example.org and api.example.org); HttpOnly SameSite=Strict cookies intentionally do not support arbitrary cross-site hosting.

```sh
npm ci
cp .env.example .env
# Edit .env with production values and secrets before continuing.
docker compose config --quiet
docker compose build
docker compose up -d
```

PostgreSQL, API, maintenance worker and Nginx frontend have separate services and persistent database storage. API and web bind only host loopback. Put an operator-managed TLS reverse proxy in front of web 8080 and API 3001, supporting /socket.io/ WebSocket upgrades and matching the configured origins. Never expose PostgreSQL. Do not use `docker compose down -v` on real data. The optional `future-media` profile prepares Redis/MinIO only; the application does not yet upload media or use Redis.

API startup applies versioned transactional migrations before listening. Worker starts after API readiness and purges expired auth/session data. Web is an independent production Expo export with service-worker shell caching and SPA route fallback. The Nginx policy allows HTTPS/WSS connections; operators should tighten connect-src to their selected API origin. Supply production encryption at rest, backups, SMTP and incident/moderation contacts yourself.

## Upgrade safely

1. Record current image digest, application commit and `/health` response. Keep the working Compose configuration and previous image tags.
2. Take and verify an encrypted PostgreSQL backup. Review migrations for compatibility; do not apply destructive migrations without a recovery plan.
3. Build new images with BUILD_COMMIT and matching EXPO_PUBLIC_BUILD_COMMIT, stage against a separate database copy and origin. Test registration/email verification, two-user invitation, HTTP chat, Socket.IO updates, privacy and revocation.
4. Replace only Unmasked services after staging succeeds. Verify the externally served health/version/commit, login, WebSocket handshake and a test conversation. A successful image build alone is not deployment evidence.
5. If critical checks fail, restore previous images/configuration. If a migration is incompatible, use the tested database recovery procedure; don't blindly roll back schema. Keep unrelated services untouched.

No automatic production rollout or rollback script runs in this initial project. No working production deployment is replaced by this delivery.
