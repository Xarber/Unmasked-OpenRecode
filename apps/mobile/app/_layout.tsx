// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { developerTools, hosted } from '../src/distribution';
import { Stack, usePathname, router } from 'expo-router';
import { View, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider, useApp } from '../src/provider';
import { Brand, Card, Label, Loading, Button, useColors } from '../src/ui';
import { IntroductionProvider } from '../src/onboarding';
import Auth from '../src/screens/Auth';
import { MotionPreferences, useReducedMotionPreference } from '../src/motion';
function Gate() {
  const app = useApp(),
    c = useColors(),
    path = usePathname(),
    reduced = useReducedMotionPreference();
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
  if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW === '1')
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 460, gap: 16 }}>
          <Brand />
          <Card>
            <Label style={{ fontSize: 24, fontWeight: '700' }}>
              {hosted ? 'Unmasked preview' : 'Private web preview'}
            </Label>
            <Label muted>Accounts and messaging are unavailable in this preview.</Label>
          </Card>
        </View>
      </View>
    );
  if (!app.ready) return <Loading />;
  if (!app.user) return <Auth />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={app.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: reduced ? 'fade' : 'default' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="connections" options={{ animation: 'none' }} />
        <Stack.Screen name="moments" options={{ animation: 'none' }} />
        <Stack.Screen name="settings" options={{ animation: 'none' }} />
      </Stack>
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
            title={developerTools ? 'Developer access expired · Go to Settings' : 'Go to Settings'}
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
        <MotionPreferences>
          <IntroductionProvider>
            <Gate />
          </IntroductionProvider>
        </MotionPreferences>
      </Provider>
    </SafeAreaProvider>
  );
}
