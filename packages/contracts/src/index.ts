// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);
export const password = z.string().min(12).max(128);
export const registration = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  username,
  displayName: z.string().trim().min(1).max(60),
  password,
  ageBand: z.enum(['minor', 'adult']),
});
export const login = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().max(128),
  device: z.string().max(100).default('Personal device'),
});
export const privacy = z.object({
  discoverable: z.boolean(),
  readReceipts: z.boolean(),
  typingIndicators: z.boolean(),
});
export const profilePatch = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  username: username.optional(),
  bio: z.string().max(500).optional(),
  status: z.string().max(80).optional(),
});
export const sendMessage = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1).max(8000),
  replyTo: z.uuid().optional(),
});
export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  status: string;
  ageBand: 'minor' | 'adult';
  discoverable: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  email: string;
  verified: boolean;
}
export interface Person {
  id: string;
  username: string;
  displayName: string;
  status?: string;
}
export interface Conversation {
  id: string;
  title: string | null;
  kind: 'direct' | 'group';
  created_at: string;
  members: (Person & { role: string; last_read: string | null })[];
  latest: string | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
}
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reactions: { userId: string; emoji: string }[];
}
export interface ConnectionRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  state: string;
  created_at: string;
  sender: Person;
  recipient: Person;
}
export const ideaSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(160),
  description: z.string().max(10000),
  category: z.enum(['Feature', 'Improvement', 'Bug Fix', 'UI/UX', 'Performance', 'Other']),
  priority: z.enum(['low', 'normal', 'high']),
  status: z.enum(['Pending', 'Approved', 'Deferred', 'In Progress', 'Implemented', 'Rejected']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  history: z.array(z.object({ at: z.iso.datetime(), status: z.string() })).default([]),
  implementation: z.string().max(500).optional(),
});
export type Idea = z.infer<typeof ideaSchema>;
export const ideaExport = z.object({
  schemaVersion: z.literal(1),
  project: z.literal('org.openrecode.unmasked'),
  exportedAt: z.iso.datetime(),
  ideas: z.array(ideaSchema).max(10000),
});
export function mergeIdeas(existing: Idea[], incoming: Idea[], replaceConflicts = false): Idea[] {
  const map = new Map(existing.map((i) => [i.id, i]));
  for (const i of incoming) {
    const old = map.get(i.id);
    if (!old || (replaceConflicts && i.updatedAt > old.updatedAt)) map.set(i.id, i);
  }
  return [...map.values()];
}
export const prompts = [
  { category: 'Daily life', text: 'What made today different from yesterday?' },
  { category: 'Friendship', text: 'When do you feel most like yourself?' },
  {
    category: 'Deep conversations',
    text: 'What is something you wish people understood about you?',
  },
  { category: 'Lighthearted', text: 'What small thing made you smile recently?' },
];
