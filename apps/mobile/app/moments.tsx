// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { api } from '../src/api';
import { useApp } from '../src/provider';
import { exportText } from '../src/export';
import { Shell, Card, Label, Button, Empty, Loading } from '../src/ui';
interface Moment {
  id: string;
  body: string;
  note: string;
  created_at: string;
  conversation_id: string;
}
export default function Moments() {
  const app = useApp(),
    qc = useQueryClient(),
    q = useQuery({ queryKey: ['moments'], queryFn: () => api<Moment[]>('/moments') });
  async function remove(id: string) {
    try {
      await api(`/moments/${id}`, 'DELETE');
      await qc.invalidateQueries();
    } catch (e) {
      app.setNotice((e as Error).message);
    }
  }
  return (
    <Shell
      title="Saved moments"
      subtitle="Some words are worth keeping."
      scroll
      action={
        <Button
          title="Export"
          secondary
          onPress={() =>
            void exportText('unmasked-moments.json', JSON.stringify(q.data ?? [], null, 2))
          }
        />
      }
    >
      <Label muted>
        Only you can see these bookmarks. Shared bookmarks are not available in this version.
      </Label>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Button title="Try again" onPress={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <Empty
          icon="bookmark-outline"
          title="Keep the moments that matter."
          description="Open a message’s actions and choose Save moment. It stays private to you."
        />
      ) : (
        q.data.map((m) => (
          <Card key={m.id}>
            <Label style={{ fontSize: 19, lineHeight: 29 }}>“{m.body}”</Label>
            {m.note !== '' && <Label muted>{m.note}</Label>}
            <Label muted style={{ fontSize: 11 }}>
              {new Date(m.created_at).toLocaleDateString()}
            </Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Open conversation"
                secondary
                onPress={() => router.push(`/conversation/${m.conversation_id}`)}
              />
              <Button title="Remove bookmark" secondary onPress={() => void remove(m.id)} />
            </View>
          </Card>
        ))
      )}
    </Shell>
  );
}
