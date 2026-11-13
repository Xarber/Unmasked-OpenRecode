// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Conversation } from '@unmasked/contracts';
import { api } from '../api';
import { MotionPanel } from '../motion';
import { useApp } from '../provider';
import { exportText } from '../export';
import { Label, Button, Field, Card, useColors } from '../ui';
interface Mode {
  mode: { state: string; inviter_id: string } | null;
  disclosures: { user_id: string; field: string; value: string }[];
}
export function ConversationOptions({
  id,
  conv,
  onStarter,
  action,
}: {
  id: string;
  conv: Conversation | undefined;
  onStarter: () => void;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const app = useApp(),
    c = useColors(),
    [groupName, setGroupName] = useState(''),
    [invitee, setInvitee] = useState('');
  const others = conv?.members.filter((m) => m.id !== app.user!.id) ?? [];
  const mode = useQuery({
    queryKey: ['unmasked', id],
    queryFn: () => api<Mode>(`/conversations/${id}/unmasked`),
    enabled: conv?.kind === 'direct',
  });
  return (
    <MotionPanel>
      <ScrollView
        style={{ maxHeight: 340, borderBottomWidth: 1, borderColor: c.line }}
        contentContainerStyle={{ padding: 20, gap: 14 }}
      >
        <Label muted style={{ fontSize: 12 }}>
          Transport encryption depends on your server’s HTTPS configuration. This conversation is
          not end-to-end encrypted.
        </Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            title={conv?.pinned ? 'Unpin' : 'Pin conversation'}
            secondary
            onPress={() =>
              void action(() => api(`/conversations/${id}`, 'PATCH', { pinned: !conv?.pinned }))
            }
          />
          <Button
            title="Export conversation"
            secondary
            onPress={() =>
              void action(async () =>
                exportText(
                  'unmasked-conversation.json',
                  JSON.stringify(
                    {
                      schemaVersion: 1,
                      conversation: conv,
                      ...(await api<object>(`/conversations/${id}/export`)),
                    },
                    null,
                    2,
                  ),
                ),
              )
            }
          />
          <Button title="Conversation starter" secondary onPress={onStarter} />
        </View>
        {conv?.kind === 'group' ? (
          <Card>
            <Label style={{ fontWeight: '600' }}>Group members · {conv.members.length}/16</Label>
            {conv.members.map((m) => (
              <View key={m.id} style={{ gap: 6 }}>
                <Label>
                  {m.displayName} · {m.role}
                </Label>
                {conv.members.find((p) => p.id === app.user!.id)?.role === 'admin' &&
                  m.id !== app.user!.id && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Button
                        title="Make administrator"
                        secondary
                        onPress={() =>
                          void action(() =>
                            api(`/conversations/${id}/membership`, 'POST', {
                              action: 'promote',
                              userId: m.id,
                            }),
                          )
                        }
                      />
                      <Button
                        title="Remove participant"
                        secondary
                        onPress={() =>
                          void action(() =>
                            api(`/conversations/${id}/membership`, 'POST', {
                              action: 'remove',
                              userId: m.id,
                            }),
                          )
                        }
                      />
                    </View>
                  )}
              </View>
            ))}
            {conv.members.find((p) => p.id === app.user!.id)?.role === 'admin' && (
              <>
                <Field label="New group name" value={groupName} onChangeText={setGroupName} />
                <Button
                  title="Rename group"
                  secondary
                  onPress={() =>
                    void action(() =>
                      api(`/conversations/${id}/membership`, 'POST', {
                        action: 'rename',
                        title: groupName,
                      }),
                    )
                  }
                />
                <Field
                  label="Contact username to invite"
                  value={invitee}
                  onChangeText={setInvitee}
                />
                <Button
                  title="Add accepted contact"
                  secondary
                  onPress={() =>
                    void action(async () => {
                      const data = await api<{ contacts: { id: string; username: string }[] }>(
                        '/connections',
                      );
                      const contact = data.contacts.find((p) => p.username === invitee);
                      if (!contact) throw Error('Choose an accepted contact');
                      await api(`/conversations/${id}/membership`, 'POST', {
                        action: 'add',
                        userId: contact.id,
                      });
                    })
                  }
                />
              </>
            )}
            <Button
              title="Leave group"
              secondary
              onPress={() =>
                void action(async () => {
                  await api(`/conversations/${id}/membership`, 'POST', { action: 'leave' });
                  const { router } = await import('expo-router');
                  router.replace('/');
                })
              }
            />
          </Card>
        ) : (
          <Card>
            <Label style={{ fontWeight: '600' }}>Unmasked Mode</Label>
            <Label muted style={{ fontSize: 13 }}>
              Get to know each other on your own terms. Each of you decides what to share. Ending
              the mode removes disclosures here; it can’t erase what someone has already seen.
            </Label>
            {mode.isError ? (
              <Label>Mode unavailable. Check the connection or blocked accounts.</Label>
            ) : (
              <>
                <Label>Status: {mode.data?.mode?.state ?? 'not started'}</Label>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {!mode.data?.mode || mode.data.mode.state === 'ended' ? (
                    <Button
                      title="Invite to Unmasked Mode"
                      onPress={() =>
                        void action(() =>
                          api(`/conversations/${id}/unmasked`, 'POST', { action: 'invite' }),
                        )
                      }
                    />
                  ) : (
                    <>
                      {mode.data.mode.state === 'pending' &&
                        mode.data.mode.inviter_id !== app.user!.id && (
                          <Button
                            title="Accept invitation"
                            onPress={() =>
                              void action(() =>
                                api(`/conversations/${id}/unmasked`, 'POST', {
                                  action: 'accept',
                                }),
                              )
                            }
                          />
                        )}
                      <Button
                        title="End mode"
                        secondary
                        onPress={() =>
                          void action(() =>
                            api(`/conversations/${id}/unmasked`, 'POST', { action: 'end' }),
                          )
                        }
                      />
                      {mode.data.mode.state === 'active' &&
                        (['bio', 'status'] as const).map((field) => {
                          const revealed = mode.data!.disclosures.some(
                            (d) => d.user_id === app.user!.id && d.field === field,
                          );
                          return (
                            <Button
                              key={field}
                              title={`${revealed ? 'Hide' : 'Share'} my ${field}`}
                              secondary
                              onPress={() =>
                                void action(() =>
                                  api(`/conversations/${id}/unmasked`, 'POST', {
                                    action: revealed ? 'hide' : 'reveal',
                                    field,
                                  }),
                                )
                              }
                            />
                          );
                        })}
                    </>
                  )}
                </View>
                {mode.data?.disclosures.map((d) => (
                  <Label key={d.user_id + d.field}>
                    {d.user_id === app.user!.id
                      ? 'You'
                      : others.find((p) => p.id === d.user_id)?.displayName}{' '}
                    shared {d.field}: {d.value || '(empty)'}
                  </Label>
                ))}
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </MotionPanel>
  );
}
