// SPDX-License-Identifier: AGPL-3.0-only
import { xcenterLoginResult } from './xcenterLogin';
import { developerTools } from './distribution';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { Profile } from '@unmasked/contracts';
import {
  socketOrigin,
  api,
  accessToken,
  refresh,
  acceptAuth,
  clearAuth,
  authLost,
  ApiError,
  type AuthResult,
} from './api';
import { read, write, remove, updateQueue, clearAccountCache, type QueuedMessage } from './storage';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
interface Context {
  user: Profile | null;
  ready: boolean;
  online: boolean;
  dark: boolean;
  theme: string;
  setTheme: (v: string) => void;
  signIn: (r: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  outbox: QueuedMessage[];
  send: (cid: string, text: string, replyTo?: string) => Promise<void>;
  retry: () => Promise<void>;
  notice: string;
  setNotice: (v: string) => void;
  developer: boolean;
  unlock: () => void;
  lock: () => void;
  touch: () => void;
}
const C = createContext<Context | null>(null);
export const useApp = () => useContext(C)!;
export function Provider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null),
    [ready, setReady] = useState(false),
    [online, setOnline] = useState(true),
    [theme, setThemeState] = useState('system'),
    [outbox, setOutbox] = useState<QueuedMessage[]>([]),
    [notice, setNotice] = useState(''),
    [developer, setDeveloper] = useState(false);
  const scheme = useColorScheme(),
    socket = useRef<Socket | null>(null),
    flushing = useRef(false),
    activeUser = useRef<string | null>(null),
    expiry = useRef<ReturnType<typeof setTimeout> | null>(null),
    authEpoch = useRef(0);
  activeUser.current = user?.id ?? null;
  const lock = useCallback(() => {
    setDeveloper(false);
    if (expiry.current) clearTimeout(expiry.current);
  }, []);
  const touch = useCallback(() => {
    if (expiry.current) clearTimeout(expiry.current);
    expiry.current = setTimeout(lock, 30000);
  }, [lock]);
  const signOut = useCallback(async () => {
    try {
      if (accessToken()) await api('/auth/logout', 'POST');
    } catch {
      setNotice('Could not contact the server. Revoke this device from another session if needed.');
    }
    socket.current?.disconnect();
    const previousUser = activeUser.current;
    activeUser.current = null;
    authEpoch.current++;
    if (previousUser) await clearAccountCache(previousUser);
    await clearAuth();
    await write('signedOut', true);
    await remove('offlineProfile');
    setUser(null);
    setOutbox([]);
    queryClient.clear();
    lock();
  }, [lock]);
  const reloadUser = useCallback(async () => {
    const epoch = authEpoch.current;
    const profile = await api<Profile>('/users/me');
    if (epoch !== authEpoch.current) return;
    setUser(profile);
    await write('offlineProfile', profile);
  }, []);
  const flush = useCallback(async () => {
    const who = activeUser.current;
    if (!who || flushing.current) return;
    flushing.current = true;
    try {
      const items = await updateQueue(who, (x) => x);
      for (const item of items) {
        if (activeUser.current !== who) break;
        try {
          await api(`/conversations/${item.conversationId}/messages`, 'POST', {
            id: item.id,
            text: item.text,
            ...(item.replyTo ? { replyTo: item.replyTo } : {}),
          });
          if (activeUser.current !== who) break;
          const next = await updateQueue(who, (x) => x.filter((m) => m.id !== item.id));
          if (activeUser.current === who) setOutbox(next);
          setOnline(true);
          queryClient.invalidateQueries();
        } catch (e) {
          if (activeUser.current !== who) break;
          const permanent = e instanceof ApiError && e.status >= 400 && e.status < 500;
          const next = await updateQueue(who, (x) =>
            x.map((m) =>
              m.id === item.id
                ? {
                    ...m,
                    state: permanent ? 'failed' : 'pending',
                    error: permanent ? (e as Error).message : undefined,
                  }
                : m,
            ),
          );
          if (activeUser.current === who) setOutbox(next);
          if (!permanent) {
            setOnline(false);
            break;
          }
        }
      }
    } finally {
      flushing.current = false;
    }
  }, []);
  useEffect(() => {
    authLost(() => {
      socket.current?.disconnect();
      activeUser.current = null;
      authEpoch.current++;
      void remove('offlineProfile');
      setUser(null);
      setOutbox([]);
      queryClient.clear();
      lock();
    });
    async function restore() {
      try {
        setThemeState(await read('theme', 'system'));
        const preview = Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW === '1';
        const xcenterResult = xcenterLoginResult();
        const providerSignIn = xcenterResult === 'signed-in';
        if (xcenterResult === 'linked')
          setNotice('X-Center ID linked. You can now use it to sign in.');
        if (xcenterResult && !['signed-in', 'linked'].includes(xcenterResult)) {
          setNotice(
            xcenterResult === 'unlinked'
              ? 'Link X-Center ID in Settings before signing in.'
              : xcenterResult === 'cancelled'
                ? 'X-Center ID sign-in was cancelled.'
                : 'X-Center ID could not complete this request. Try again.',
          );
        }
        if (!preview && (providerSignIn || !(await read('signedOut', false)))) {
          try {
            const result = await refresh();
            if (providerSignIn) await write('signedOut', false);
            setUser(result.profile);
            await write('offlineProfile', result.profile);
          } catch (e) {
            if (!providerSignIn && e instanceof TypeError) {
              const cached = await read<Profile | null>('offlineProfile', null);
              if (cached) {
                setUser(cached);
                setOnline(false);
              }
            }
          }
        }
      } finally {
        setReady(true);
      }
    }
    void restore();
    return () => {
      lock();
    };
  }, [lock]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void updateQueue(user.id, (x) => x).then((items) => {
      if (!cancelled) setOutbox(items);
    });
    const s = io(socketOrigin, { auth: { token: accessToken() }, transports: ['websocket'] });
    socket.current = s;
    s.on('connect', () => {
      setOnline(true);
      queryClient.invalidateQueries();
      void flush();
    });
    s.on('disconnect', () => setOnline(false));
    s.on('sync', () => {
      queryClient.invalidateQueries();
      void reloadUser().catch(() => {});
    });
    s.on('connect_error', () => {
      setOnline(false);
    });
    const timer = setInterval(() => {
      void flush();
      if (!s.connected)
        void refresh()
          .then(() => {
            s.auth = { token: accessToken() };
            s.connect();
          })
          .catch(() => {});
    }, 20000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void flush();
        void reloadUser().catch(() => {});
      } else lock();
    });
    return () => {
      cancelled = true;
      s.disconnect();
      clearInterval(timer);
      appState.remove();
    };
  }, [user?.id, flush, lock, reloadUser]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !developer) return;
    const active = () => touch();
    document.addEventListener('keydown', active);
    document.addEventListener('pointerdown', active);
    return () => {
      document.removeEventListener('keydown', active);
      document.removeEventListener('pointerdown', active);
    };
  }, [developer, touch]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      setOnline(true);
      void flush();
    };
    const offline = () => setOnline(false);
    globalThis.addEventListener('online', handler);
    globalThis.addEventListener('offline', offline);
    return () => {
      globalThis.removeEventListener('online', handler);
      globalThis.removeEventListener('offline', offline);
    };
  }, [flush]);
  async function signIn(r: AuthResult) {
    authEpoch.current++;
    await acceptAuth(r);
    await write('signedOut', false);
    await write('offlineProfile', r.profile);
    setUser(r.profile);
    const previous = await read<string | null>('lastVersion', null);
    if (previous && previous !== '0.1.0')
      setNotice(
        'What’s new in 0.1.0: private conversations, contact invitations, consent-based Unmasked Mode.',
      );
    await write('lastVersion', '0.1.0');
  }
  async function send(cid: string, text: string, replyTo?: string) {
    if (!user) throw Error('Sign in first');
    const { uuid } = await import('./storage');
    const message: QueuedMessage = {
      id: uuid(),
      conversationId: cid,
      text,
      replyTo,
      createdAt: new Date().toISOString(),
      state: 'pending',
    };
    setOutbox(await updateQueue(user.id, (x) => [...x, message]));
    void flush();
  }
  return (
    <QueryClientProvider client={queryClient}>
      <C.Provider
        value={{
          user,
          ready,
          online,
          dark: theme === 'dark' || (theme === 'system' && scheme === 'dark'),
          theme,
          setTheme: (v) => {
            setThemeState(v);
            void write('theme', v);
          },
          signIn,
          signOut,
          reloadUser,
          outbox,
          send,
          retry: flush,
          notice,
          setNotice,
          developer,
          unlock: () => {
            if (!developerTools) return;
            setDeveloper(true);
            touch();
          },
          lock,
          touch,
        }}
      >
        {children}
      </C.Provider>
    </QueryClientProvider>
  );
}
