import type { User } from '../shared/api';
import { mediaUrl, type Services } from './context';
import { badRequest, cleanText } from './http';
import { casUpdate, NO_CHANGE } from './store';
import type { UserRecord } from './types';
import { sha256hex } from './util';

export const emailIndexKey = (email: string) => `email/${sha256hex(email.toLowerCase())}`;
export const appleIndexKey = (sub: string) => `apple/${sub.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function getUser(svc: Services, id: string): Promise<UserRecord | null> {
  if (!id) return null;
  const res = await svc.store.ns('users').getJSON<UserRecord>(id);
  return res?.value ?? null;
}

/** CAS update of a user record. Throws NOT_FOUND if the user doesn't exist. */
export async function updateUser<R = void>(
  svc: Services,
  id: string,
  mutate: (u: UserRecord) => R | typeof NO_CHANGE,
): Promise<{ user: UserRecord; result: R | undefined }> {
  const { value, result } = await casUpdate<UserRecord, R>(svc.store.ns('users'), id, mutate);
  return { user: value, result };
}

/** Resolves an email/apple index entry to a live user (ignores dangling entries). */
export async function userByIndex(svc: Services, key: string): Promise<UserRecord | null> {
  const idx = await svc.store.ns('indexes').getJSON<{ userId: string }>(key);
  if (!idx) return null;
  return getUser(svc, idx.value.userId);
}

/**
 * Claims a unique index key (email/apple) for `userId`. Returns false when a live
 * user already owns it. A dangling entry (its user no longer exists — e.g. a crash
 * mid-signup) is taken over with a conditional write.
 */
export async function claimIndex(svc: Services, key: string, userId: string): Promise<boolean> {
  const kv = svc.store.ns('indexes');
  const first = await kv.setJSON(key, { userId }, { onlyIfNew: true });
  if (first.modified) return true;
  const cur = await kv.getJSON<{ userId: string }>(key);
  if (!cur) return (await kv.setJSON(key, { userId }, { onlyIfNew: true })).modified;
  if (cur.value.userId === userId) return true;
  if (await getUser(svc, cur.value.userId)) return false;
  return (await kv.setJSON(key, { userId }, { onlyIfMatch: cur.etag })).modified;
}

/** Deletes an index entry only if it still points at `userId`. */
export async function releaseIndex(svc: Services, key: string, userId: string): Promise<void> {
  const kv = svc.store.ns('indexes');
  const cur = await kv.getJSON<{ userId: string }>(key);
  if (cur && cur.value.userId === userId) await kv.delete(key);
}

export function toApiUser(u: UserRecord, origin: string): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    avatarUrl: u.avatar ? mediaUrl(origin, 'avatars', u.avatar.id) : null,
    providers: [...u.providers],
    showOnLeaderboard: u.showOnLeaderboard,
    createdAt: u.createdAt,
  };
}

export function validateName(raw: unknown, field = 'name'): string {
  if (typeof raw !== 'string') throw badRequest(`\`${field}\` must be a string`, { field });
  const name = cleanText(raw).replace(/\s+/g, ' ');
  const len = [...name].length;
  if (len < 1) throw badRequest('Please tell us your name', { field });
  if (len > 60) throw badRequest('Name must be at most 60 characters', { field });
  return name;
}

export function validatePhone(raw: unknown): string | null {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw badRequest('`phone` must be a string or null', { field: 'phone' });
  const phone = cleanText(raw);
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!/^[+\d][\d\s().-]*$/.test(phone) || digits.length < 7 || digits.length > 15 || phone.length > 24) {
    throw badRequest('Please enter a valid phone number', { field: 'phone' });
  }
  return phone;
}

/** Privacy-safe leaderboard name: "Maria Lopez Garcia" → "Maria G." */
export function displayName(name: string): string {
  const parts = cleanText(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Guest';
  const first = [...parts[0]].slice(0, 20).join('');
  const cap = first.charAt(0).toLocaleUpperCase() + first.slice(1);
  if (parts.length === 1) return cap;
  const lastInitial = [...parts[parts.length - 1]][0]?.toLocaleUpperCase() ?? '';
  return lastInitial ? `${cap} ${lastInitial}.` : cap;
}
