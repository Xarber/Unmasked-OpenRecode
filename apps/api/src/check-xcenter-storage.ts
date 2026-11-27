// SPDX-License-Identifier: AGPL-3.0-only
import { createServiceClient, XCenterError } from '@xcenter-id/server/data';

try {
  const service = createServiceClient({ file: false });
  await service.records.list('unmasked_operations', { signal: AbortSignal.timeout(8000) });
  console.log('X-Center ID private service storage: read verified');
} catch (error) {
  const detail =
    error instanceof XCenterError ? `HTTP ${error.status}` : 'check service key and connectivity';
  console.error(`X-Center ID private service storage: ${detail}`);
  process.exitCode = 1;
}
