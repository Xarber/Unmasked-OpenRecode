# Monitoring

Verify the public preview's build metadata and HTTPS response. API 503 is expected in preview. For the full service, alert on three consecutive failed readiness probes over five minutes, available disk below 2 GiB, and certificate validity below 14 days. The X-Center operator owns alerts. Continuous alerting for Unmasked has not been enabled.
