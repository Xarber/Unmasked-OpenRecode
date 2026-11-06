import { MessageBubble } from '../../src/components/MessageBubble';
// SPDX-License-Identifier: AGPL-3.0-only
import { cachedApi } from '../../src/cache';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conversation, Message } from '@unmasked/contracts';
import { prompts } from '@unmasked/contracts';
import { api } from '../../src/api';
import { useApp } from '../../src/provider';
import { read, write, remove } from '../../src/storage';
import { ConversationOptions } from '../../src/components/ConversationOptions';
import {
  Shell,
  Label,
  Button,
  Field,
  Card,
  Empty,
  Loading,
  Icon,
  useColors,
  accent,
} from '../../src/ui';
interface Page {
  messages: Message[];
  nextCursor: string | null;
}
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useApp(),
    c = useColors(),
    qc = useQueryClient(),
    [text, setText] = useState(''),
    [draftReady, setDraftReady] = useState(false),
    [selected, setSelected] = useState<Message | null>(null),
    [reply, setReply] = useState<Message | null>(null),
    [editing, setEditing] = useState<Message | null>(null),
    [options, setOptions] = useState(false),
    [starter, setStarter] = useState(false),
    [older, setOlder] = useState<Message[]>([]),
    [next, setNext] = useState<string | null | undefined>(undefined),
    [search, setSearch] = useState(''),
    [searchInput, setSearchInput] = useState(''),
    [error, setError] = useState('');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const key = `account:${app.user!.id}:draft:${id}`;
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => cachedApi<Conversation[]>(app.user!.id, '/conversations', 'conversations'),
  });
  const conv = conversations.data?.find((x) => x.id === id);
  const others = conv?.members.filter((m) => m.id !== app.user!.id) ?? [];
  const title = conv?.title ?? others.map((m) => m.displayName).join(', ');
  const q = useQuery({
    queryKey: ['messages', id, search],
    queryFn: async () => {
      try {
        const data = await api<Page>(
          `/conversations/${id}/messages${search ? `?q=${encodeURIComponent(search)}` : ''}`,
        );
        if (!search) await write(`account:${app.user!.id}:messages:${id}`, data);
        return data;
      } catch (e) {
        if (e instanceof TypeError && !search) {
          const cached = await read<Page | null>(`account:${app.user!.id}:messages:${id}`, null);
          if (cached) return cached;
        }
        throw e;
      }
    },
  });
  useEffect(() => {
    setDraftReady(false);
    setText('');
    setOlder([]);
    setNext(undefined);
    let active = true;
    void read(key, '').then((v) => {
      if (active) {
        setText(v);
        setDraftReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (draftReady) void write(key, text);
  }, [text, key, draftReady]);
  const lastId = q.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (lastId && !search) void api(`/conversations/${id}/read`, 'POST').catch(() => {});
  }, [id, lastId, search]);
  useEffect(() => {
    if (!older.length && !search) scroll.current?.scrollToEnd({ animated: false });
  }, [lastId, app.outbox.length]);
  async function action(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send() {
    if (!text.trim()) return;
    const value = text;
    if (editing) {
      await action(async () => {
        await api(`/messages/${editing.id}`, 'PATCH', { text: value });
        setEditing(null);
        setText('');
      });
      return;
    }
    await action(async () => {
      await app.send(id, value, reply?.id);
      setText('');
      setReply(null);
      await remove(key);
    });
  }
  async function more() {
    await action(async () => {
      const cursor = next === undefined ? q.data?.nextCursor : next;
      if (!cursor) return;
      const page = await api<Page>(
        `/conversations/${id}/messages?before=${encodeURIComponent(cursor)}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      );
      setOlder((v) => [...page.messages, ...v]);
      setNext(page.nextCursor);
    });
  }
  const messages = [
    ...new Map([...older, ...(q.data?.messages ?? [])].map((m) => [m.id, m])).values(),
  ];
  const queue = app.outbox.filter((m) => m.conversationId === id);
  return (
    <Shell
      title={title || 'Conversation'}
      subtitle={
        conv?.kind === 'group'
          ? `${conv.members.length} people · private group`
          : 'Your conversation, at your pace.'
      }
      back
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Conversation options"
          onPress={() => setOptions(!options)}
          style={{ padding: 10 }}
        >
          <Icon name="ellipsis-horizontal" />
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {options && (
          <ConversationOptions
            id={id}
            conv={conv}
            onStarter={() => setStarter(!starter)}
            action={action}
          />
        )}
        {error !== '' && (
          <View style={{ padding: 12 }}>
            <Label style={{ color: '#C74359' }}>{error}</Label>
          </View>
        )}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field
              placeholder="Search messages in this conversation"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => {
                setOlder([]);
                setNext(undefined);
                setSearch(searchInput);
              }}
            />
          </View>
          <Button
            title="Search"
            secondary
            onPress={() => {
              setOlder([]);
              setNext(undefined);
              setSearch(searchInput);
            }}
          />
        </View>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 24, gap: 14, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {(next === undefined ? q.data?.nextCursor : next) && (
            <Button title="Load earlier messages" secondary onPress={() => void more()} />
          )}
          <Label muted style={{ textAlign: 'center', fontSize: 11 }}>
            JUST A CONVERSATION. NO EXPECTATIONS.
          </Label>
          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <Card>
              <Label>Couldn’t open this conversation.</Label>
              <Button title="Try again" onPress={() => void q.refetch()} />
            </Card>
          ) : (
            messages.length === 0 && (
              <Empty
                title={search ? 'No matching messages' : 'Say something that sounds like you.'}
                description={
                  search ? 'Try another word.' : 'A simple hello is a lovely place to start.'
                }
              />
            )
          )}{' '}
          {messages.map((m, index) => (
            <MessageBubble
              key={m.id}
              m={m}
              previous={messages[index - 1]}
              conv={conv}
              selected={selected?.id === m.id}
              onSelect={() => setSelected(selected?.id === m.id ? null : m)}
              onReply={(m) => {
                setReply(m);
                setSelected(null);
              }}
              onEdit={(m) => {
                setEditing(m);
                setText(m.body);
                setSelected(null);
              }}
              action={action}
            />
          ))}
          {queue.map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                padding: 16,
                borderRadius: 18,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: accent,
                gap: 5,
              }}
            >
              <Label>{m.text}</Label>
              <Label muted style={{ fontSize: 11 }}>
                {m.state === 'failed' ? m.error : 'Pending · waiting to send'}
              </Label>
              {m.state === 'failed' && (
                <Button title="Retry" secondary onPress={() => void app.retry()} />
              )}
            </View>
          ))}
        </ScrollView>
        {starter && (
          <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
            <Label muted style={{ fontSize: 12 }}>
              An invitation, never an obligation.
            </Label>
            <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
              {prompts.map((p) => (
                <Button
                  key={p.text}
                  title={p.text}
                  secondary
                  onPress={() => {
                    setText(p.text);
                    setStarter(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}
        {(reply || editing) && (
          <View style={{ padding: 12, backgroundColor: c.soft, flexDirection: 'row', gap: 10 }}>
            <Label style={{ flex: 1, fontSize: 12 }}>
              {editing ? 'Editing your message' : `Replying: ${reply?.body.slice(0, 80)}`}
            </Label>
            <Button
              title="Cancel"
              secondary
              onPress={() => {
                setReply(null);
                setEditing(null);
              }}
            />
          </View>
        )}
        <View
          style={{
            padding: 20,
            paddingBottom: Platform.OS === 'ios' ? 10 : 20,
            borderTopWidth: 1,
            borderColor: c.line,
            backgroundColor: c.panel,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-end',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Conversation starters"
            style={{ padding: 12 }}
            onPress={() => setStarter(!starter)}
          >
            <Icon name="sparkles-outline" color={accent} />
          </Pressable>
          <TextInput
            accessibilityLabel="Message"
            placeholder="Be yourself. Say hello…"
            placeholderTextColor={c.muted}
            value={text}
            onChangeText={setText}
            multiline
            editable={draftReady}
            style={{
              flex: 1,
              color: c.text,
              backgroundColor: c.bg,
              borderRadius: 16,
              padding: 14,
              fontSize: 16,
              minHeight: 48,
              maxHeight: 140,
            }}
          />
          <Button
            title={editing ? 'Save' : 'Send'}
            disabled={!text.trim() || !draftReady}
            icon="arrow-up"
            onPress={() => void send()}
          />
        </View>
      </KeyboardAvoidingView>
    </Shell>
  );
}
