// SPDX-License-Identifier: AGPL-3.0-only
import { cachedApi } from '../src/cache';
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Conversation } from '@unmasked/contracts';
import { useApp } from '../src/provider';
import {
  Shell,
  Field,
  Button,
  Label,
  Avatar,
  Empty,
  Loading,
  Icon,
  useColors,
  accent,
  Card,
} from '../src/ui';
export default function Inbox() {
  const app = useApp(),
    c = useColors(),
    [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['conversations'],
    queryFn: () => cachedApi<Conversation[]>(app.user!.id, '/conversations', 'conversations'),
  });
  const items = (q.data ?? []).filter((x) =>
    (
      x.title ??
      x.members
        .filter((m) => m.id !== app.user?.id)
        .map((m) => m.displayName)
        .join(', ')
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Shell
      title="Conversations"
      subtitle="A space for your people."
      action={
        <Button title="New conversation" icon="add" onPress={() => router.push('/connections')} />
      }
    >
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 20,
          maxWidth: 1000,
          width: '100%',
          alignSelf: 'center',
          flexGrow: 1,
        }}
      >
        <Field placeholder="Search your conversations" value={search} onChangeText={setSearch} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 4,
          }}
        >
          <Label style={{ fontSize: 12, fontWeight: '600', letterSpacing: 1, color: c.muted }}>
            YOUR CONVERSATIONS
          </Label>
          <Label muted style={{ fontSize: 12 }}>
            {items.length} {items.length === 1 ? 'conversation' : 'conversations'}
          </Label>
        </View>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <Card>
            <Label>Couldn’t load your conversations.</Label>
            <Button title="Try again" onPress={() => void q.refetch()} />
          </Card>
        ) : items.length === 0 ? (
          <Empty
            title={search ? 'No conversations found' : 'Good conversations start here.'}
            description={
              search
                ? 'Try another name.'
                : 'Invite someone you know. There’s no public feed, and no rush to fill this space.'
            }
          />
        ) : (
          <View
            style={{
              backgroundColor: c.panel,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.line,
              overflow: 'hidden',
            }}
          >
            {items.map((conv, index) => {
              const title =
                conv.title ??
                conv.members
                  .filter((m) => m.id !== app.user?.id)
                  .map((m) => m.displayName)
                  .join(', ');
              return (
                <Pressable
                  key={conv.id}
                  accessibilityRole="link"
                  onPress={() => router.push(`/conversation/${conv.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    gap: 16,
                    padding: 21,
                    alignItems: 'center',
                    backgroundColor: pressed ? c.soft : undefined,
                    borderTopWidth: index ? 1 : 0,
                    borderColor: c.line,
                  })}
                >
                  <Avatar name={title} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Label style={{ fontWeight: '600' }}>{title}</Label>
                      {conv.pinned && <Icon name="pin" size={13} color={accent} />}
                    </View>
                    <Label muted style={{ fontSize: 13 }}>
                      {conv.latest ?? 'A new conversation, waiting for you.'}
                    </Label>
                  </View>
                  {conv.unread > 0 ? (
                    <View
                      style={{
                        backgroundColor: accent,
                        borderRadius: 12,
                        minWidth: 23,
                        padding: 3,
                        alignItems: 'center',
                      }}
                    >
                      <Label style={{ fontSize: 11, color: 'white' }}>{conv.unread}</Label>
                    </View>
                  ) : (
                    <Icon name="chevron-forward" size={16} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', gap: 5, padding: 16 }}>
          <Icon name="leaf-outline" size={18} color={c.muted} />
          <Label muted style={{ fontSize: 12 }}>
            Meaningful, at your own pace.
          </Label>
        </View>
      </ScrollView>
    </Shell>
  );
}
