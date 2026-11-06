// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { View, ScrollView, Text, Pressable, useWindowDimensions, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../provider';
import { api, type AuthResult, API } from '../api';
import { Brand, Button, Field, Label, Card, Icon, useColors, accent } from '../ui';
type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
export default function Auth() {
  const app = useApp(),
    c = useColors(),
    { width } = useWindowDimensions(),
    [mode, setMode] = useState<Mode>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [handle, setHandle] = useState(''),
    [code, setCode] = useState(''),
    [minor, setMinor] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await app.signIn(
          await api<AuthResult>('/auth/login', 'POST', { email, password, device: 'Unmasked app' }),
        );
      } else if (mode === 'register') {
        const result = await api<{ message: string }>('/auth/register', 'POST', {
          email,
          password,
          username: handle,
          displayName: name,
          ageBand: minor ? 'minor' : 'adult',
        });
        setMessage(result.message);
        setMode('verify');
      } else if (mode === 'verify') {
        const r = await api<{ message: string }>('/auth/verify', 'POST', { token: code });
        setMessage(r.message);
        setMode('login');
      } else if (mode === 'forgot') {
        const r = await api<{ message: string }>('/auth/forgot', 'POST', { email });
        setMessage(r.message);
        setMode('reset');
      } else {
        const r = await api<{ message: string }>('/auth/reset', 'POST', { token: code, password });
        setMessage(r.message);
        setMode('login');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.panel }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            flex: 1,
            flexDirection: width > 850 ? 'row' : 'column',
            minHeight: width > 850 ? 700 : undefined,
          }}
        >
          {width > 850 && (
            <View
              style={{
                flex: 1,
                backgroundColor: app.dark ? '#24253E' : '#EEEEFD',
                padding: 64,
                justifyContent: 'space-between',
                minWidth: 0,
              }}
            >
              <Brand />
              <View style={{ gap: 24, maxWidth: 480 }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: app.dark ? '#363852' : '#E1E1FC',
                  }}
                >
                  <Label style={{ fontSize: 12, color: accent, fontWeight: '600' }}>
                    LESS NOISE. MORE CONNECTION.
                  </Label>
                </View>
                <Text
                  style={{
                    fontSize: 58,
                    lineHeight: 64,
                    letterSpacing: -2.5,
                    fontWeight: '700',
                    color: c.text,
                  }}
                >
                  A space to be{'\n'}a little more{'\n'}
                  <Text style={{ color: accent }}>yourself.</Text>
                </Text>
                <Label muted style={{ fontSize: 17, lineHeight: 28 }}>
                  Good conversations don’t need a perfect profile.{'\n'}Just you, and someone worth
                  talking to.
                </Label>
                <View
                  style={{
                    marginTop: 20,
                    padding: 24,
                    borderRadius: 24,
                    backgroundColor: c.panel,
                    gap: 16,
                    transform: [{ rotate: '-2deg' }],
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Icon name="sparkles-outline" color={accent} />
                    <Label muted style={{ fontSize: 12 }}>
                      A LITTLE CONVERSATION STARTER
                    </Label>
                  </View>
                  <Label style={{ fontSize: 21, lineHeight: 30 }}>
                    “When do you feel most like yourself?”
                  </Label>
                  <Label muted style={{ fontSize: 12 }}>
                    No right answer. No pressure to share.
                  </Label>
                </View>
              </View>
              <Label muted style={{ fontSize: 12 }}>
                OPENRECODE / BUILT FOR PEOPLE, NOT ALGORITHMS
              </Label>
            </View>
          )}
          <View
            style={{
              flex: 1,
              padding: width > 850 ? 64 : 28,
              justifyContent: 'center',
              maxWidth: 650,
              alignSelf: 'center',
              width: '100%',
              gap: 24,
            }}
          >
            {width <= 850 && <Brand />}
            <View style={{ gap: 10 }}>
              <Label style={{ fontSize: 32, fontWeight: '700', letterSpacing: -1 }}>
                {mode === 'login'
                  ? 'Welcome back.'
                  : mode === 'register'
                    ? 'Make yourself at home.'
                    : mode === 'verify'
                      ? 'Check your inbox.'
                      : mode === 'forgot'
                        ? 'Let’s get you back in.'
                        : 'A fresh start.'}
              </Label>
              <Label muted>
                {mode === 'login'
                  ? 'Your people. Your conversations. Your pace.'
                  : mode === 'register'
                    ? 'No real name or photo required. Just be you.'
                    : 'Enter the code from your email to continue securely.'}
              </Label>
            </View>
            {message !== '' && (
              <Card>
                <Label>{message}</Label>
              </Card>
            )}
            {error !== '' && <Label style={{ color: '#C74359' }}>{error}</Label>}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <Field
                label="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
              />
            )}
            {mode === 'register' && (
              <>
                <Field
                  label="Display name"
                  value={name}
                  onChangeText={setName}
                  placeholder="What should we call you?"
                />
                <Field
                  label="Username"
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  placeholder="your_handle"
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !minor }}
                  onPress={() => setMinor(!minor)}
                  style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 }}
                >
                  <Icon name={minor ? 'square-outline' : 'checkbox'} color={accent} />
                  <Label>I am 18 or older</Label>
                </Pressable>
                <Label muted style={{ fontSize: 12 }}>
                  Under 18? Keep this unchecked for restricted discovery and invitation-only
                  connections.
                </Label>
              </>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <Field
                label={mode === 'reset' ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                placeholder="At least 12 characters"
                onSubmitEditing={() => void submit()}
              />
            )}
            {mode === 'verify' && (
              <>
                <Field
                  label="Registration email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Button
                  title="Resend verification email"
                  secondary
                  onPress={() => {
                    void api<{ message: string }>('/auth/resend', 'POST', { email })
                      .then((r) => setMessage(r.message))
                      .catch((e) => setError(e.message));
                  }}
                />
              </>
            )}
            {(mode === 'verify' || mode === 'reset') && (
              <Field
                label="Email code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                placeholder="Paste your verification code"
              />
            )}
            <Button
              title={
                busy
                  ? 'One moment…'
                  : mode === 'login'
                    ? 'Sign in'
                    : mode === 'register'
                      ? 'Create account'
                      : mode === 'verify'
                        ? 'Verify email'
                        : mode === 'forgot'
                          ? 'Send reset code'
                          : 'Reset password'
              }
              disabled={busy}
              onPress={() => void submit()}
              icon="arrow-forward"
            />
            {mode === 'login' ? (
              <View style={{ gap: 12 }}>
                <Button
                  title="New here? Create an account"
                  secondary
                  onPress={() => {
                    setMode('register');
                    setError('');
                  }}
                />
                <Button title="Forgot password?" secondary onPress={() => setMode('forgot')} />
                <Button
                  title="Already have a verification code?"
                  secondary
                  onPress={() => setMode('verify')}
                />
              </View>
            ) : (
              <Button
                title="Back to sign in"
                secondary
                onPress={() => {
                  setMode('login');
                  setError('');
                }}
              />
            )}
            {__DEV__ && (
              <Pressable onPress={() => void Linking.openURL(`${API}/dev/mailbox`)}>
                <Label muted style={{ fontSize: 12 }}>
                  Local development · Open the development mailbox ↗
                </Label>
              </Pressable>
            )}
            <View style={{ gap: 10, paddingTop: 16, borderTopWidth: 1, borderColor: c.line }}>
              <Label muted style={{ fontSize: 12 }}>
                No ads. No popularity scores. No pressure.
              </Label>
              <Label muted style={{ fontSize: 11 }}>
                Conversations are not end-to-end encrypted in this version. Self-host with HTTPS
                before using real personal data.
              </Label>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
