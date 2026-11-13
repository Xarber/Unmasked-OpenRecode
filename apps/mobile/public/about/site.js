// SPDX-License-Identifier: AGPL-3.0-only
let installationPrompt;
const button = document.querySelector('#install');
const status = document.querySelector('#install-status');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installationPrompt = event;
});
button?.addEventListener('click', async () => {
  if (installationPrompt) {
    await installationPrompt.prompt();
    const result = await installationPrompt.userChoice;
    if (status)
      status.textContent =
        result.outcome === 'accepted'
          ? 'Installation requested. Your browser will finish setting up the app.'
          : 'You can install it another time from your browser menu.';
    installationPrompt = undefined;
  } else document.querySelector('#install-help')?.showModal();
});
window.addEventListener('appinstalled', () => {
  if (status) status.textContent = 'The web app has been installed.';
});
