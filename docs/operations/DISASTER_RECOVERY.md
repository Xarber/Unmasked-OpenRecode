# Unmasked recovery

The public preview is stateless. Restore it by repointing the versioned release symlink using the [X-Center runbook](../platforms/XCENTER.md), then verify the live commit, landing, service worker and intentional API 503.

For the future PostgreSQL service, target RPO 24 hours and RTO 4 hours. Before storing real accounts, schedule encrypted daily exports to failure-isolated storage and verify restoration to a separate database with the same PostgreSQL major. Validate migration history, account access and messaging counts and record recovery time. Restore testing and schedules remain pending.
