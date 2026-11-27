// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import type { Person, ConnectionRequest } from '@unmasked/contracts';
import { api } from '../src/api';
import { useApp } from '../src/provider';
import { Shell, Card, Field, Button, Label, Avatar, Empty, Loading } from '../src/ui';
import { xcenterWebAvailable } from '../src/xcenterLogin';
import { exportText } from '../src/export';
export default function Connections() {
  const app = useApp(),
    qc = useQueryClient(),
    params = useLocalSearchParams<{ username?: string; invitation?: string }>(),
    [search, setSearch] = useState(params.username ?? ''),
    [results, setResults] = useState<Person[]>([]),
    [link, setLink] = useState(''),
    [group, setGroup] = useState(false),
    [title, setTitle] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState('');
  const [friends, setFriends] = useState<Person[]>();
  const account = useQuery({
    queryKey: ['xcenter-account', app.user?.id],
    queryFn: () => api<{ signedInWithXCenter: boolean }>('/xcenter/account'),
    enabled: xcenterWebAvailable,
    retry: false,
  });
  const q = useQuery({
    queryKey: ['connections'],
    queryFn: () =>
      api<{ contacts: Person[]; requests: ConnectionRequest[]; blocked: Person[] }>('/connections'),
  });
  async function action(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function open(ids: string[], groupTitle?: string) {
    const r = await api<{ id: string }>('/conversations', 'POST', {
      participants: ids,
      ...(groupTitle ? { title: groupTitle } : {}),
    });
    router.push(`/conversation/${r.id}`);
  }
  return (
    <Shell title="Connections" subtitle="Find your people. Keep your circle yours." scroll>
      {error !== '' && <Label style={{ color: '#C74359' }}>{error}</Label>}
      {account.data?.signedInWithXCenter && (
        <Card>
          <Button
            title="Find X-Center ID friends"
            icon="people-outline"
            onPress={() =>
              void action(async () => {
                setFriends(undefined);
                setFriends(await api<Person[]>('/xcenter/friends'));
              })
            }
          />
          {friends?.length === 0 && <Label muted>No discoverable X-Center ID friends found.</Label>}
          {friends?.map((friend) => (
            <Button
              key={friend.id}
              title={friend.displayName}
              secondary
              onPress={() => {
                setResults([friend]);
                setSearch(friend.username);
              }}
            />
          ))}
        </Card>
      )}
      <Card>
        <Label style={{ fontSize: 19, fontWeight: '600' }}>Start with a hello</Label>
        <Label muted>
          Search an adult’s discoverable username, or use a personal invitation from someone you
          know.
        </Label>
        <Field
          label="Username"
          placeholder="their_username"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            title="Search"
            onPress={() =>
              void action(async () =>
                setResults(await api<Person[]>(`/users?q=${encodeURIComponent(search)}`)),
              )
            }
          />
          <Button
            title="Send request"
            secondary
            onPress={() =>
              void action(async () => {
                await api('/connections/requests', 'POST', {
                  username: search,
                  ...(params.invitation ? { invitation: params.invitation } : {}),
                });
                app.setNotice('Connection request sent.');
              })
            }
          />
          <Button
            title="Create my invitation"
            secondary
            onPress={() =>
              void action(async () =>
                setLink((await api<{ url: string }>('/connections/invitation', 'POST')).url),
              )
            }
          />
        </View>
        {link !== '' && (
          <>
            <Label>Expires in 24 hours. Share only with someone you want to connect with.</Label>
            <Field label="Personal invitation" value={link} editable={false} />
            <Button
              title="Share invitation"
              secondary
              onPress={() => void exportText('Unmasked invitation', link)}
            />
          </>
        )}
        {results.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Avatar name={p.displayName} />
            <Label>
              {p.displayName} · @{p.username}
            </Label>
            <Button
              title="Invite"
              onPress={() =>
                void action(() => api('/connections/requests', 'POST', { username: p.username }))
              }
            />
          </View>
        ))}
      </Card>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Button title="Retry loading connections" onPress={() => void q.refetch()} />
      ) : (
        <>
          <Card>
            <Label style={{ fontSize: 19, fontWeight: '600' }}>Connection requests</Label>
            {q.data.requests.length === 0 ? (
              <Label muted>No pending requests. A little quiet is a good thing.</Label>
            ) : (
              q.data.requests.map((r) => (
                <View key={r.id} style={{ gap: 12 }}>
                  <Label>
                    {r.sender_id === app.user?.id
                      ? `Waiting for ${r.recipient.displayName}`
                      : `${r.sender.displayName} wants to connect`}
                  </Label>
                  {r.recipient_id === app.user?.id && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        title="Accept"
                        onPress={() =>
                          void action(() =>
                            api(`/connections/requests/${r.id}/respond`, 'POST', { accept: true }),
                          )
                        }
                      />
                      <Button
                        title="Decline"
                        secondary
                        onPress={() =>
                          void action(() =>
                            api(`/connections/requests/${r.id}/respond`, 'POST', { accept: false }),
                          )
                        }
                      />
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Label style={{ fontSize: 19, fontWeight: '600' }}>Your circle</Label>
              <Button
                title={group ? 'Cancel group' : 'New group'}
                secondary
                onPress={() => setGroup(!group)}
              />
            </View>
            {group && (
              <>
                <Field label="Group name" value={title} onChangeText={setTitle} />
                <Label muted>Select up to 15 contacts.</Label>
              </>
            )}
            {q.data.contacts.length === 0 ? (
              <Empty
                icon="people-outline"
                title="Your circle starts with one person."
                description="Accept a connection request to begin talking."
              />
            ) : (
              q.data.contacts.map((p) => (
                <View
                  key={p.id}
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Avatar name={p.displayName} />
                  <View style={{ flex: 1 }}>
                    <Label style={{ fontWeight: '600' }}>{p.displayName}</Label>
                    <Label muted style={{ fontSize: 12 }}>
                      @{p.username}
                    </Label>
                  </View>
                  <Button
                    title={group ? (selected.includes(p.id) ? 'Selected' : 'Select') : 'Message'}
                    secondary
                    onPress={() =>
                      group
                        ? setSelected((v) =>
                            v.includes(p.id)
                              ? v.filter((x) => x !== p.id)
                              : [...v, p.id].slice(0, 15),
                          )
                        : void action(() => open([p.id]))
                    }
                  />
                  <Button
                    title="Block"
                    secondary
                    onPress={() => void action(() => api('/blocks', 'POST', { userId: p.id }))}
                  />
                </View>
              ))
            )}
            {group && (
              <Button
                title="Create group"
                disabled={selected.length < 2 || !title.trim()}
                onPress={() => void action(() => open(selected, title))}
              />
            )}
          </Card>
          {q.data.blocked.length > 0 && (
            <Card>
              <Label style={{ fontWeight: '600' }}>Blocked accounts</Label>
              {q.data.blocked.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                  <Label>{p.displayName}</Label>
                  <Button
                    title="Unblock"
                    secondary
                    onPress={() => void action(() => api(`/blocks/${p.id}`, 'DELETE'))}
                  />
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Shell>
  );
}
