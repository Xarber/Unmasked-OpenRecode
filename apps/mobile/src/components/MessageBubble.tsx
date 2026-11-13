// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import type { Conversation, Message } from '@unmasked/contracts';
import { api } from '../api';
import { useApp } from '../provider';
import { Label, Button, Field, Card, useColors } from '../ui';
interface Props {
  m: Message;
  previous?: Message;
  conv?: Conversation;
  selected: boolean;
  onSelect: () => void;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}
export function MessageBubble({
  m,
  previous,
  conv,
  selected,
  onSelect,
  onReply,
  onEdit,
  action,
}: Props) {
  const app = useApp(),
    c = useColors(),
    [reportReason, setReportReason] = useState(''),
    [reporting, setReporting] = useState(false);
  const own = m.sender_id === app.user!.id,
    sender = conv?.members.find((p) => p.id === m.sender_id),
    others = conv?.members.filter((p) => p.id !== app.user!.id) ?? [],
    date = new Date(m.created_at).toLocaleDateString();
  return (
    <React.Fragment key={m.id}>
      {(!previous || new Date(previous.created_at).toLocaleDateString() !== date) && (
        <Label muted style={{ fontSize: 11, textAlign: 'center', marginVertical: 12 }}>
          {date}
        </Label>
      )}
      <View style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 5 }}>
        {conv?.kind === 'group' && !own && (
          <Label muted style={{ fontSize: 11 }}>
            {sender?.displayName ?? 'Deleted account'}
          </Label>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message: ${m.deleted_at ? 'Deleted' : m.body}. Open message actions`}
          onPress={() => {
            if (!m.deleted_at) {
              onSelect();
              setReporting(false);
            }
          }}
          style={{
            backgroundColor: own ? c.action : c.panel,
            borderRadius: 20,
            borderBottomRightRadius: own ? 5 : 20,
            borderBottomLeftRadius: own ? 20 : 5,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderWidth: own ? 0 : 1,
            borderColor: c.line,
          }}
        >
          {m.reply_to && (
            <Label style={{ fontSize: 11, color: own ? '#DBDDFF' : c.muted, marginBottom: 5 }}>
              ↳ Reply to a message
            </Label>
          )}
          <Label style={{ color: own ? '#FFF' : c.text, fontSize: 15 }}>
            {m.deleted_at ? 'Message deleted' : m.body}
          </Label>
        </Pressable>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            justifyContent: own ? 'flex-end' : 'flex-start',
          }}
        >
          <Label muted style={{ fontSize: 10 }}>
            {new Date(m.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {m.edited_at ? ' · edited' : ''}
            {own ? ' · saved to server' : ''}
          </Label>
          {own &&
            others.length > 0 &&
            others.every((p) => p.last_read && new Date(p.last_read) >= new Date(m.created_at)) && (
              <Label muted style={{ fontSize: 10 }}>
                Read
              </Label>
            )}
        </View>
        {m.reactions.length > 0 && (
          <Label style={{ fontSize: 13 }}>{m.reactions.map((r) => r.emoji).join(' ')}</Label>
        )}
        {selected && (
          <Card style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Button
                title="Reply"
                secondary
                onPress={() => {
                  onReply(m);
                }}
              />
              <Button
                title="Save moment"
                secondary
                onPress={() => void action(() => api('/moments', 'POST', { messageId: m.id }))}
              />
              {own && (
                <>
                  <Button
                    title="Edit"
                    secondary
                    onPress={() => {
                      onEdit(m);
                    }}
                  />
                  <Button
                    title="Delete for everyone"
                    danger
                    onPress={() => void action(() => api(`/messages/${m.id}`, 'DELETE'))}
                  />
                </>
              )}
              {!own && <Button title="Report" secondary onPress={() => setReporting(!reporting)} />}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {['❤️', '👍', '😂', '✨', '🙏'].map((emoji) => (
                <Button
                  key={emoji}
                  title={emoji}
                  secondary
                  onPress={() =>
                    void action(() => api(`/messages/${m.id}/reactions`, 'POST', { emoji }))
                  }
                />
              ))}
            </View>
            {reporting && (
              <>
                <Label muted>
                  Only this message and your reason will be submitted to the server operator.
                </Label>
                <Field
                  label="Reason for report"
                  value={reportReason}
                  onChangeText={setReportReason}
                />
                <Button
                  title="Submit report"
                  onPress={() =>
                    void action(async () => {
                      await api('/reports', 'POST', {
                        userId: m.sender_id,
                        messageId: m.id,
                        reason: reportReason,
                        submittedContent: m.body,
                      });
                      setReporting(false);
                      app.setNotice('Report recorded for your server operator.');
                    })
                  }
                />
              </>
            )}
          </Card>
        )}
      </View>
    </React.Fragment>
  );
}
