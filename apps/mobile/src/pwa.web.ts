// SPDX-License-Identifier: AGPL-3.0-only
export async function applyWebUpdate() {
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration?.waiting) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
      once: true,
    });
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else location.reload();
}
