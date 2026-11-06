// SPDX-License-Identifier: AGPL-3.0-only
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Idea } from '@unmasked/contracts';
export const uuid = () => Crypto.randomUUID();
export async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(`unmasked:${key}`);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}
export const write = (key: string, value: unknown) =>
  AsyncStorage.setItem(`unmasked:${key}`, JSON.stringify(value));
export const remove = (key: string) => AsyncStorage.removeItem(`unmasked:${key}`);
export async function clearAccountCache(user: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(`unmasked:account:${user}:`),
  );
  await AsyncStorage.multiRemove(keys);
}
export const ideaStore = {
  read: () => read<Idea[]>('ideas', []),
  write: (ideas: Idea[]) => write('ideas', ideas),
};
export interface QueuedMessage {
  id: string;
  conversationId: string;
  text: string;
  replyTo?: string;
  createdAt: string;
  state: 'pending' | 'failed';
  error?: string;
}
let queueLock: Promise<unknown> = Promise.resolve();
export function updateQueue(user: string, update: (items: QueuedMessage[]) => QueuedMessage[]) {
  const task = queueLock.then(async () => {
    const items = await read<QueuedMessage[]>(`account:${user}:outbox`, []);
    const next = update(items);
    await write(`account:${user}:outbox`, next);
    return next;
  });
  queueLock = task.catch(() => {});
  return task;
}

export async function clearReadCache(user: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) =>
      k.startsWith(`unmasked:account:${user}:cache:`) ||
      k.startsWith(`unmasked:account:${user}:messages:`),
  );
  await AsyncStorage.multiRemove(keys);
}
