// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { ideaExport, mergeIdeas, type Idea } from '@unmasked/contracts';
import { useApp } from '../src/provider';
import { ideaStore, uuid } from '../src/storage';
import { exportText } from '../src/export';
import { API } from '../src/api';
import { Shell, Card, Label, Field, Button, SectionHeading } from '../src/ui';
import { SampleConversation } from '../src/components/SampleConversation';

export default function Developer() {
  const [samples, setSamples] = useState(false);
  const app = useApp(),
    [ideas, setIdeas] = useState<Idea[]>([]),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [category, setCategory] = useState<Idea['category']>('Improvement'),
    [priority, setPriority] = useState<Idea['priority']>('normal'),
    [status, setStatus] = useState<Idea['status']>('Pending'),
    [statusFilter, setStatusFilter] = useState('All'),
    [input, setInput] = useState(''),
    [incoming, setIncoming] = useState<Idea[] | null>(null),
    [error, setError] = useState(''),
    [sort, setSort] = useState('date');
  useEffect(() => {
    void ideaStore
      .read()
      .then(setIdeas)
      .catch(() => setError('Ideas storage could not be read. Existing data was preserved.'));
  }, []);
  async function persist(next: Idea[]) {
    try {
      await ideaStore.write(next);
      setIdeas(next);
    } catch {
      setError('Could not save ideas. Existing data was preserved.');
    }
  }
  async function save() {
    const now = new Date().toISOString(),
      old = ideas.find((i) => i.id === editing);
    const idea: Idea = {
      id: old?.id ?? uuid(),
      title: title.trim(),
      description,
      category,
      priority,
      status,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      history: [...(old?.history ?? []), { at: now, status }],
    };
    if (!idea.title) return;
    await persist([...ideas.filter((i) => i.id !== idea.id), idea]);
    setEditing(null);
    setTitle('');
    setDescription('');
  }
  function edit(i: Idea) {
    setEditing(i.id);
    setTitle(i.title);
    setDescription(i.description);
    setCategory(i.category);
    setStatus(i.status);
    setPriority(i.priority);
  }
  if (!app.developer) return null;
  return (
    <Shell
      title="Developer options"
      subtitle="Local tools. No personal data is sent to AI services."
      back
      scroll
    >
      <Card>
        <SectionHeading title="Screenshot previews" icon="camera-outline" />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Label>Sample Data</Label>
          <Switch accessibilityLabel="Sample Data" value={samples} onValueChange={setSamples} />
        </View>
        {samples && <SampleConversation />}
      </Card>
      {error !== '' && <Label style={{ color: '#C74359' }}>{error}</Label>}
      <Card>
        <SectionHeading title="Diagnostics" icon="pulse-outline" />
        <Label>Version 0.1.0 · {process.env.EXPO_PUBLIC_BUILD_COMMIT ?? 'development'}</Label>
        <Label>API: {API}</Label>
        <Label>
          Socket: {app.online ? 'connected' : 'disconnected'} · queued messages: {app.outbox.length}
        </Label>
        <Label>Encryption: no E2EE · Presence: disabled · Analytics: disabled</Label>
        <Label muted>
          Access expires after 30 seconds of inactivity or when switching main tabs. No credentials
          or message bodies appear in diagnostics.
        </Label>
      </Card>
      <Card>
        <SectionHeading title="Ideas" icon="bulb-outline" />
        <Label muted>
          {ideas.filter((i) => i.status === 'Pending').length} pending ·{' '}
          {ideas.filter((i) => i.status === 'Approved').length} approved ·{' '}
          {ideas.filter((i) => i.status === 'Deferred').length} deferred
        </Label>
        <Field label="Search ideas" value={search} onChangeText={setSearch} />
        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
          {['All', 'Pending', 'Approved', 'Deferred', 'In Progress', 'Implemented', 'Rejected'].map(
            (s) => (
              <Button
                key={s}
                title={s}
                secondary={statusFilter !== s}
                onPress={() => setStatusFilter(s)}
              />
            ),
          )}
        </View>
        <Button
          title={`Sort: ${sort === 'date' ? 'newest first' : 'priority'}`}
          secondary
          onPress={() => setSort(sort === 'date' ? 'priority' : 'date')}
        />
        {ideas
          .filter(
            (i) =>
              (statusFilter === 'All' || i.status === statusFilter) &&
              `${i.title} ${i.description}`.toLowerCase().includes(search.toLowerCase()),
          )
          .sort((a, b) =>
            sort === 'date'
              ? b.updatedAt.localeCompare(a.updatedAt)
              : ['high', 'normal', 'low'].indexOf(a.priority) -
                ['high', 'normal', 'low'].indexOf(b.priority),
          )
          .map((i) => (
            <Card key={i.id}>
              <Label style={{ fontWeight: '600' }}>{i.title}</Label>
              <Label>{i.description}</Label>
              <Label muted style={{ fontSize: 12 }}>
                {i.category} · {i.priority} · {i.status}
              </Label>
              <Label muted style={{ fontSize: 11 }}>
                Updated {new Date(i.updatedAt).toLocaleString()}
              </Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button title="Edit" secondary onPress={() => edit(i)} />
                <Button
                  title="Duplicate"
                  secondary
                  onPress={() => {
                    const now = new Date().toISOString();
                    void persist([
                      ...ideas,
                      {
                        ...i,
                        id: uuid(),
                        title: `${i.title} (copy)`,
                        createdAt: now,
                        updatedAt: now,
                        status: 'Pending',
                        history: [{ at: now, status: 'Pending' }],
                      },
                    ]);
                  }}
                />
                <Button
                  title="Share"
                  secondary
                  onPress={() =>
                    void exportText(
                      'unmasked-idea.json',
                      JSON.stringify(
                        {
                          schemaVersion: 1,
                          project: 'org.openrecode.unmasked',
                          exportedAt: new Date().toISOString(),
                          ideas: [i],
                        },
                        null,
                        2,
                      ),
                    )
                  }
                />
                <Button
                  title="Delete idea"
                  secondary
                  onPress={() => void persist(ideas.filter((v) => v.id !== i.id))}
                />
              </View>
            </Card>
          ))}
      </Card>
      <Card>
        <Label style={{ fontWeight: '600' }}>{editing ? 'Edit idea' : 'Record an idea'}</Label>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field
          label="Description / reproduction steps"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Label muted>Category</Label>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(['Feature', 'Improvement', 'Bug Fix', 'UI/UX', 'Performance', 'Other'] as const).map(
            (v) => (
              <Button key={v} title={v} secondary={category !== v} onPress={() => setCategory(v)} />
            ),
          )}
        </View>
        <Label muted>Priority</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['low', 'normal', 'high'] as const).map((v) => (
            <Button key={v} title={v} secondary={priority !== v} onPress={() => setPriority(v)} />
          ))}
        </View>
        <Label muted>Status</Label>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(
            ['Pending', 'Approved', 'Deferred', 'In Progress', 'Implemented', 'Rejected'] as const
          ).map((v) => (
            <Button key={v} title={v} secondary={status !== v} onPress={() => setStatus(v)} />
          ))}
        </View>
        <Button title="Save idea" disabled={!title.trim()} onPress={() => void save()} />
      </Card>
      <Card>
        <Label style={{ fontWeight: '600' }}>Portable ideas collection</Label>
        <Label muted>
          Ideas stay on this device. Export the file into docs/IDEAS.json for a future coding
          session. Import review preserves existing entries unless you explicitly choose to merge
          newer conflicts.
        </Label>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            title="Export JSON"
            secondary
            onPress={() =>
              void exportText(
                'IDEAS.json',
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    project: 'org.openrecode.unmasked',
                    exportedAt: new Date().toISOString(),
                    ideas,
                  },
                  null,
                  2,
                ),
              )
            }
          />
          <Button
            title="Export Markdown"
            secondary
            onPress={() =>
              void exportText(
                'IDEAS.md',
                ideas
                  .map(
                    (i) =>
                      `## ${i.title}\n${i.status} · ${i.category} · ${i.priority}\n\n${i.description}\n\nID: ${i.id}`,
                  )
                  .join('\n\n'),
              )
            }
          />
        </View>
        <Field
          label="Paste exported JSON to import"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Button
          title="Review import"
          secondary
          onPress={() => {
            try {
              const parsed = ideaExport.parse(JSON.parse(input));
              setIncoming(parsed.ideas);
              setError('');
            } catch {
              setError(
                'Invalid JSON, incompatible schema, or another application’s export. No changes applied.',
              );
            }
          }}
        />
        {incoming && (
          <>
            <Label>
              {incoming.length} incoming ·{' '}
              {incoming.filter((i) => ideas.some((e) => e.id === i.id)).length} existing IDs. Review
              entries below before applying.
            </Label>
            {incoming.map((i) => (
              <Label key={i.id}>
                {i.title} · {i.status} · {i.updatedAt}
              </Label>
            ))}
            <Button
              title="Import new entries only"
              onPress={() => {
                void persist(mergeIdeas(ideas, incoming));
                setIncoming(null);
              }}
            />
            <Button
              title="Also merge newer versions of existing entries"
              secondary
              onPress={() => {
                void persist(mergeIdeas(ideas, incoming, true));
                setIncoming(null);
              }}
            />
            <Button title="Cancel import" secondary onPress={() => setIncoming(null)} />
          </>
        )}
      </Card>
    </Shell>
  );
}
