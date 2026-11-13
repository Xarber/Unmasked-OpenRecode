// SPDX-License-Identifier: AGPL-3.0-only
(() => {
  const preference = 'unmasked.web.opened.v1';
  const marker = 'unmaskedWelcome';
  const query = new URLSearchParams(location.search);
  let returnFocus;

  function hasOpened() {
    for (const store of ['localStorage', 'sessionStorage']) {
      try {
        if (window[store].getItem(preference) === '1') return true;
      } catch {
        // The browser can deny storage. The current document still works.
      }
    }
    return false;
  }

  function remember() {
    for (const store of ['localStorage', 'sessionStorage']) {
      try {
        window[store].setItem(preference, '1');
      } catch {
        // A second storage mechanism may still be available.
      }
    }
  }

  function show(welcome, moveFocus = true) {
    document.documentElement.dataset.unmaskedView = welcome ? 'welcome' : 'app';
    const root = document.getElementById('root');
    if (!root) return;
    root.inert = welcome;
    if (moveFocus) {
      if (welcome) {
        document.getElementById('unmasked-welcome').scrollTop = 0;
        document.querySelector('#unmasked-welcome h1').focus({ preventScroll: true });
      } else if (returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
      } else {
        root.tabIndex = -1;
        root.focus({ preventScroll: true });
      }
    }
  }

  const initialWelcome =
    location.pathname === '/' && !query.has('open') && (query.has('welcome') || !hasOpened());
  if (location.pathname === '/' && (query.has('open') || query.has('welcome'))) {
    if (query.has('open')) remember();
    history.replaceState(history.state, '', '/');
  }
  show(initialWelcome, false);
  document.addEventListener('DOMContentLoaded', () => {
    show(document.documentElement.dataset.unmaskedView === 'welcome', false);
  });

  window.addEventListener('unmasked:welcome', () => {
    returnFocus = document.activeElement;
    // Keep Expo's history state while this same-document view covers the mounted app.
    history.pushState({ ...history.state, [marker]: 'return' }, '', '/');
    show(true);
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('#unmasked-welcome a');
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (link.hash && link.getAttribute('href').startsWith('#')) {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView();
      return;
    }
    if (!link.hasAttribute('data-open-app')) return;
    event.preventDefault();
    remember();
    if (history.state?.[marker] === 'return') {
      history.back();
      return;
    }
    if (history.state?.[marker] === 'first') {
      const { [marker]: _welcome, ...appState } = history.state;
      history.pushState(appState, '', '/');
    } else {
      const appState = history.state;
      history.replaceState({ ...appState, [marker]: 'first' }, '', '/');
      history.pushState(appState, '', '/');
    }
    show(false);
  });

  window.addEventListener(
    'popstate',
    (event) => {
      if (event.state?.[marker] && location.pathname === '/') {
        event.stopImmediatePropagation();
        show(true);
      } else if (document.documentElement.dataset.unmaskedView === 'welcome') {
        show(false);
      }
    },
    { capture: true },
  );
})();
