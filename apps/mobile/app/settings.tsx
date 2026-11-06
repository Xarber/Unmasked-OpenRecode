import { applyWebUpdate } from '../src/pwa';
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState, useRef } from 'react';
import { View, Pressable, Switch, Platform } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../src/api';
import { useApp } from '../src/provider';
import { clearReadCache } from '../src/storage';
import { exportText } from '../src/export';
import { Shell, Card, Label, Field, Button, Icon, accent } from '../src/ui';
interface Device {
  id: string;
  device: string;
  created_at: string;
}
export default function Settings() {
  const app = useApp(),
    [name, setName] = useState(app.user!.displayName),
    [handle, setHandle] = useState(app.user!.username),
    [bio, setBio] = useState(app.user!.bio),
    [status, setStatus] = useState(app.user!.status),
    [confirmation, setConfirmation] = useState(''),
    [remove, setRemove] = useState(false),
    [changelog, setChangelog] = useState(false),
    [reloadPending, setReloadPending] = useState(false),
    [busy, setBusy] = useState(false);
  const taps = useRef({ count: 0, at: 0 });
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api<Device[]>('/sessions') });
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      app.setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setPrivacy(
    field: 'discoverable' | 'readReceipts' | 'typingIndicators',
    value: boolean,
  ) {
    await action(async () => {
      await api('/settings/privacy', 'PATCH', {
        discoverable: app.user!.discoverable,
        readReceipts: app.user!.readReceipts,
        typingIndicators: app.user!.typingIndicators,
        [field]: value,
      });
      await app.reloadUser();
    });
  }
  return (
    <Shell title="Settings" subtitle="Make this space feel like yours." scroll>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Your profile</Label>
        <Field label="Display name" value={name} onChangeText={setName} />
        <Field label="Username" value={handle} onChangeText={setHandle} autoCapitalize="none" />
        <Field
          label="About you · shared only through Unmasked consent"
          value={bio}
          onChangeText={setBio}
          multiline
        />
        <Field
          label="Check-in · shared only through Unmasked consent"
          value={status}
          onChangeText={setStatus}
          placeholder="Open to talking, need some space…"
        />
        <Button
          title="Save profile"
          disabled={busy}
          onPress={() =>
            void action(async () => {
              await api('/users/me', 'PATCH', { displayName: name, username: handle, bio, status });
              await app.reloadUser();
              app.setNotice(
                'Profile saved. Your username can change without losing conversations.',
              );
            })
          }
        />
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Appearance</Label>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {['light', 'dark', 'system'].map((theme) => (
            <Button
              key={theme}
              title={`${app.theme === theme ? '✓ ' : ''}${theme[0]!.toUpperCase() + theme.slice(1)}`}
              secondary={app.theme !== theme}
              onPress={() => app.setTheme(theme)}
            />
          ))}
        </View>
        <Label muted>
          Text follows your device’s text-size settings. The interface uses no required motion.
        </Label>
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Privacy, by choice</Label>
        <Label muted>
          Conversations in this version are stored on your server and are not end-to-end encrypted.
          Use a server operator you trust.
        </Label>
        {[
          {
            key: 'discoverable',
            title: 'Allow username discovery',
            detail:
              app.user!.ageBand === 'minor'
                ? 'Restricted for under-18 accounts.'
                : 'Off by default. Personal invitations still work.',
          },
          {
            key: 'readReceipts',
            title: 'Share read receipts',
            detail: 'Your choice applies across all signed-in devices.',
          },
        ].map((item) => (
          <View key={item.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Label>{item.title}</Label>
              <Label muted style={{ fontSize: 12 }}>
                {item.detail}
              </Label>
            </View>
            <Switch
              accessibilityLabel={item.title}
              value={app.user![item.key as 'discoverable' | 'readReceipts']}
              disabled={busy || (item.key === 'discoverable' && app.user!.ageBand === 'minor')}
              onValueChange={(v) => void setPrivacy(item.key as 'discoverable' | 'readReceipts', v)}
              trackColor={{ true: accent }}
            />
          </View>
        ))}
        <Label muted style={{ fontSize: 12 }}>
          Online presence, typing indicators, advertising trackers and analytics are not emitted.
        </Label>
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Connected devices</Label>
        {q.isError ? (
          <Button title="Retry device list" secondary onPress={() => void q.refetch()} />
        ) : (
          q.data?.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Icon name="phone-portrait-outline" />
              <View style={{ flex: 1 }}>
                <Label>{d.device}</Label>
                <Label muted style={{ fontSize: 11 }}>
                  Signed in {new Date(d.created_at).toLocaleDateString()}
                </Label>
              </View>
              <Button
                title="Revoke"
                secondary
                onPress={() =>
                  void action(async () => {
                    await api(`/sessions/${d.id}`, 'DELETE');
                    await q.refetch();
                    await app.reloadUser();
                  })
                }
              />
            </View>
          ))
        )}
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Your data</Label>
        <Label muted>
          Exports contain private conversations. Keep the downloaded file somewhere safe. Clearing
          the local cache keeps drafts and queued messages. Signing out removes them from this
          device.
        </Label>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            title="Download account data"
            secondary
            onPress={() =>
              void action(async () =>
                exportText(
                  'unmasked-account.json',
                  JSON.stringify(await api('/account/export'), null, 2),
                ),
              )
            }
          />
          <Button
            title="Clear local cache"
            secondary
            onPress={() =>
              void action(async () => {
                await clearReadCache(app.user!.id);
                app.setNotice(
                  'Cached history cleared. Drafts and queued messages were preserved. Reload to clear in-memory history.',
                );
              })
            }
          />
          <Button title="Sign out" secondary onPress={() => void app.signOut()} />
          <Button title="Delete account…" secondary onPress={() => setRemove(!remove)} />
        </View>
        {remove && (
          <>
            <Label style={{ color: '#C74359' }}>
              This permanently deletes your account, revokes sessions and removes your message
              bodies from the active database. Other people’s exports, screenshots and operator
              backups cannot be erased here. Type DELETE to confirm.
            </Label>
            <Field
              label="Deletion confirmation"
              value={confirmation}
              onChangeText={setConfirmation}
            />
            <Button
              title="Permanently delete account"
              danger
              disabled={confirmation !== 'DELETE' || busy}
              onPress={() =>
                void action(async () => {
                  await api('/account', 'DELETE', { confirmation });
                  await app.signOut();
                })
              }
            />
          </>
        )}
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Updates & changelog</Label>
        <Label>0.1.0 · Development channel</Label>
        <Label muted>
          This is an unreleased development build. No native update channel or installation package
          is published.
        </Label>
        <Button
          title={changelog ? 'Hide release history' : 'View changelog'}
          secondary
          onPress={() => setChangelog(!changelog)}
        />
        {changelog && (
          <View style={{ gap: 12 }}>
            <Label style={{ fontWeight: '600' }}>0.1.0 · Unreleased</Label>
            <Label>💬 Persistent conversations, contact invitations, replies and reactions.</Label>
            <Label>🎭 Optional Unmasked Mode with independent, revocable profile sharing.</Label>
            <Label>🔖 Private saved moments and account data exports.</Label>
            <Label>🛠 Developer Ideas with portable JSON import and export.</Label>
            <Label muted>
              Fixes & Improvements: see the repository test report for verified behavior and known
              limitations.
            </Label>
          </View>
        )}
        {Platform.OS === 'web' && (
          <>
            <Button
              title="Reload app shell"
              secondary
              onPress={() => setReloadPending(!reloadPending)}
            />
            {reloadPending && (
              <>
                <Label>
                  Reloading keeps saved drafts but discards unsaved changes in forms. Finish editing
                  before continuing.
                </Label>
                <Button title="Reload now" onPress={() => void action(applyWebUpdate)} />
                <Button title="Keep editing" secondary onPress={() => setReloadPending(false)} />
              </>
            )}
          </>
        )}
      </Card>
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>About Unmasked</Label>
        <Label>Be real. No covers.</Label>
        <Label muted>
          An OpenRecode project. No ads, paid visibility, streaks or subscription gates.
        </Label>
        <Label>AGPL-3.0-only · Third-party licenses are documented in the repository.</Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Application version. Tap three times for developer options."
          onPress={() => {
            const now = Date.now();
            taps.current = {
              count: now - taps.current.at < 1500 ? taps.current.count + 1 : 1,
              at: now,
            };
            if (taps.current.count === 3) {
              app.unlock();
              taps.current.count = 0;
            }
          }}
          style={{ paddingVertical: 14 }}
        >
          <Label muted style={{ fontSize: 12 }}>
            Version 0.1.0 · Commit {process.env.EXPO_PUBLIC_BUILD_COMMIT ?? 'development'}
          </Label>
        </Pressable>
        {app.developer && (
          <Button
            title="Developer options"
            secondary
            icon="code-slash-outline"
            onPress={() => router.push('/developer')}
          />
        )}
      </Card>
    </Shell>
  );
}
