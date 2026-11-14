# X-Center private web preview

The preview uses a dedicated Nginx container on the X-Center host. It serves the production Expo Web shell, landing, and guide. Accounts and messaging are disabled in this build. The container binds to server loopback, sends noindex and uses a dedicated Compose project. TLS and SMTP are deferred. See [self-hosting](../DEPLOYMENT.md) for full-service prerequisites.

Open a local forwarding session with an authorized X-Center SSH account. Replace `xcenter-host` with your existing SSH destination.

```sh
ssh -o ExitOnForwardFailure=yes -N -L 127.0.0.1:18550:127.0.0.1:18550 xcenter-host
```

Open http://localhost:18550/ while that session is active. Exact version, commit and mode are available at `/__build.json`. The corresponding source for the deployed commit is available through the private development repository.

## Deploy or roll back

1. Build a clean, committed tree with `EXPO_PUBLIC_WEB_PREVIEW=1 EXPO_PUBLIC_API_URL=/api npm run build:web`. Verify `dist/__build.json` matches the intended commit.
2. Copy the export to `web/` within a fresh release directory under `/srv/xcenter/apps/unmasked/releases`. Include both files from `infra/xcenter` and verify the transfer checksum.
3. From the release directory, run `docker compose -p unmasked-private-web -f compose.staging.yaml config --quiet`, then `docker compose -p unmasked-private-web -f compose.staging.yaml up -d --wait`.
4. Confirm the live build metadata, landing, PWA assets, nested routes and the disabled API. Confirm the host's port is only bound to loopback. Keep the previous release directory.
5. To roll back, repeat step 3 from the previous release directory and verify its live metadata. On an initial deployment, stop only the `unmasked-private-web` project if validation fails.

The preview uses a read-only filesystem and has no database or persistent user content. No reverse-proxy changes are required.

## Production configuration

Use the checked-in X-Center override with the root Compose file. It binds dedicated API and web instances to loopback ports 18551 and 18552. PostgreSQL and the maintenance worker have no host port. The public virtual host uses the appliance's existing wildcard certificate and sends /api/ and /socket.io/ to the API.

Set `WEB_ORIGIN=https://unmasked.xcenter.it`, `EXPO_PUBLIC_API_URL=/api`, and `BUILD_COMMIT` to the checked-out SHA. The override sets `EXPO_PUBLIC_DISTRIBUTION=xcenter` so end users see a basic version label. The native build's default is `https://unmasked.xcenter.it/api`. The app has no custom server input.

Keep `POSTGRES_PASSWORD` and `SMTP_URL` in a restricted appliance environment file and set `MAIL_FROM=Unmasked <support@xcenter.it>`. Verify authenticated mail delivery before enabling signup. Validate Compose with `docker compose -f compose.yaml -f infra/xcenter/production.override.yaml config --quiet`. Apply only the Unmasked virtual host after local API and database readiness. Verify Nginx with `nginx -t` before reloading. Preserve the private preview and prior deployment while validating the public endpoint.

## Public web preview

When SMTP is unavailable, export using `EXPO_PUBLIC_WEB_PREVIEW=1 EXPO_PUBLIC_DISTRIBUTION=xcenter EXPO_PUBLIC_API_URL=/api`. The separate public-preview virtual host serves the export and explicitly rejects account/WebSocket requests. Use a versioned directory and switch the `public-current` symlink to roll back. The existing private preview remains separate.
