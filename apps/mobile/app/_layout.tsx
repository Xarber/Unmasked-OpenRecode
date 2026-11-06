// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { Stack, usePathname, router } from 'expo-router';
import { View, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider, useApp } from '../src/provider';
import { Loading, Button, useColors } from '../src/ui';
import Auth from '../src/screens/Auth';
function Gate() {
  const app = useApp(),
    c = useColors(),
    path = usePathname();
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !('serviceWorker' in navigator) || __DEV__) return;
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const show = () => {
          if (reg.waiting)
            app.setNotice(
              'An app-shell update is ready. Save your work, then use Reload in Settings.',
            );
        };
        show();
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', show);
        });
      })
      .catch(() => app.setNotice('Offline app shell could not be installed.'));
  }, []);
  if (!app.ready) return <Loading />;
  if (!app.user) return <Auth />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={app.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
      {path.startsWith('/developer') && !app.developer && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: c.bg,
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <Button
            title="Developer access expired · Go to Settings"
            onPress={() => router.replace('/settings')}
          />
        </View>
      )}
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <Provider>
        <Gate />
      </Provider>
    </SafeAreaProvider>
  );
}
