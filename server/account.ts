/** /api/me — profile, avatar and full account deletion. */
import type { MeResponse } from '../shared/api';
import { drinkById } from '../shared/content/drinks';
import type { Ctx } from './context';
import { badRequest, decodeImageUpload, json, optBoolean, readJson } from './http';
import { removeFromLeaderboard, syncLeaderboard } from './leaderboard';
import { deleteMedia, mediaKey, purgeMedia } from './media';
import { loadProgress, mutateProgress, toProgress } from './progress';
import { recordRitualAnalytics } from './ritual';
import { NO_CHANGE } from './store';
import type { MemoryRecord, OrderRecord, ProgressRecord, UserRecord } from './types';
import { appleIndexKey, emailIndexKey, releaseIndex, toApiUser, updateUser, validateName, validatePhone } from './users';
import { randomId, sha256hex } from './util';

export const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;
export const MAX_BOOKMARKS = 50;

async function meResponse(ctx: Ctx, user: UserRecord, progress?: ProgressRecord): Promise<MeResponse> {
  const rec = progress ?? (await loadProgress(ctx.svc, user.id));
  return { user: toApiUser(user, ctx.origin), progress: toProgress(rec, ctx.svc.now()) };
}

export async function getMe(ctx: Ctx): Promise<Response> {
  return json(await meResponse(ctx, ctx.user));
}

export async function patchMe(ctx: Ctx): Promise<Response> {
  const body = await readJson(ctx.req);
  const name = body.name !== undefined ? validateName(body.name) : undefined;
  const phone = body.phone !== undefined ? validatePhone(body.phone) : undefined;
  const show = optBoolean(body, 'showOnLeaderboard');
  let bookmarks: string[] | undefined;
  if (body.bookmarks !== undefined) {
    if (!Array.isArray(body.bookmarks)) throw badRequest('`bookmarks` must be an array of drink ids', { field: 'bookmarks' });
    const unique = [...new Set(body.bookmarks)];
    if (unique.length > MAX_BOOKMARKS) throw badRequest(`At most ${MAX_BOOKMARKS} bookmarks`, { field: 'bookmarks' });
    const bad = unique.filter((id) => typeof id !== 'string' || !drinkById(id));
    if (bad.length) throw badRequest('Unknown drink in bookmarks', { field: 'bookmarks', invalid: bad.slice(0, 5) });
    bookmarks = unique as string[];
  }

  let user = ctx.user;
  if (name !== undefined || phone !== undefined || show !== undefined) {
    ({ user } = await updateUser(ctx.svc, user.id, (u) => {
      if (name !== undefined) u.name = name;
      if (phone !== undefined) u.phone = phone;
      if (show !== undefined) u.showOnLeaderboard = show;
    }));
    if (name !== undefined || show !== undefined) {
      const id = user.id;
      ctx.defer(() => syncLeaderboard(ctx.svc, id), 'leaderboard.sync');
    }
  }
  let progress: ProgressRecord | undefined;
  if (bookmarks !== undefined) {
    const next = bookmarks;
    ({ record: progress } = await mutateProgress(ctx, (rec) => {
      if (JSON.stringify(rec.bookmarks) === JSON.stringify(next)) return NO_CHANGE;
      rec.bookmarks = next;
    }));
  }
  return json(await meResponse(ctx, user, progress));
}

export async function putAvatar(ctx: Ctx): Promise<Response> {
  const { svc } = ctx;
  const body = await readJson(ctx.req, 3 * 1024 * 1024);
  const { bytes, contentType } = decodeImageUpload(body.image, MAX_AVATAR_BYTES);
  const id = randomId(16);
  await svc.store.ns('media').setBytes(mediaKey('avatars', id), bytes, { userId: ctx.user.id, contentType, createdAt: svc.now().toISOString() });
  const { user, result: previous } = await updateUser(svc, ctx.user.id, (u) => {
    const prev = u.avatar?.id ?? null;
    u.avatar = { id, contentType };
    return prev;
  });
  if (previous) {
    await deleteMedia(svc, 'avatars', previous);
    ctx.defer(() => purgeMedia(svc, [previous]), 'media.purge');
  }
  ctx.defer(() => syncLeaderboard(svc, user.id), 'leaderboard.sync');
  return json(await meResponse(ctx, user));
}

/**
 * DELETE /api/me — erases everything tied to the account. The user record goes
 * last, so if any step fails the request can simply be retried with the same token.
 */
export async function deleteAccount(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const uid = user.id;
  const s = svc.store;
  const purge: string[] = [];

  // Progress + tickets (released so they can be claimed again).
  const progress = await s.ns('progress').getJSON<ProgressRecord>(uid);
  const tickets = s.ns('tickets');
  for (const hash of progress?.value.ticketHashes ?? []) {
    const t = await tickets.getJSON<{ userId: string }>(hash);
    if (t && t.value.userId === uid) await tickets.delete(hash);
  }
  await s.ns('progress').delete(uid);

  // La Memoria Viva portraits + index.
  const memories = await s.ns('memories').getJSON<{ items: MemoryRecord[] }>(uid);
  for (const m of memories?.value.items ?? []) {
    await deleteMedia(svc, 'memories', m.id);
    purge.push(m.id);
  }
  await s.ns('memories').delete(uid);

  // Avatar.
  if (user.avatar) {
    await deleteMedia(svc, 'avatars', user.avatar.id);
    purge.push(user.avatar.id);
  }

  // Shop: orders, pickup codes, requests/waitlists.
  const shop = s.ns('shop');
  const orders = await shop.getJSON<{ orders: OrderRecord[] }>(`orders/${uid}`);
  for (const o of orders?.value.orders ?? []) await shop.delete(`pickup/${o.pickupCode}`);
  await shop.delete(`orders/${uid}`);
  for (const key of await shop.listKeys(`requests/${uid}/`)) await shop.delete(key);

  // Leaderboard + survey analytics (aggregate counts are decremented).
  await removeFromLeaderboard(svc, uid);
  await recordRitualAnalytics(svc, uid, null);

  // Sessions & auth artifacts.
  const tokens = s.ns('tokens');
  for (const h of user.refreshHashes ?? []) await tokens.delete(`refresh/${h}`);
  if (user.email) {
    await tokens.delete(`reset/${sha256hex(user.email)}`);
    await tokens.delete(`loginfail/${sha256hex(user.email)}`);
    await releaseIndex(svc, emailIndexKey(user.email), uid);
  }
  if (user.appleSub) await releaseIndex(svc, appleIndexKey(user.appleSub), uid);

  // Finally the account itself.
  const latest = await s.ns('users').getJSON<UserRecord>(uid);
  for (const h of latest?.value.refreshHashes ?? []) await tokens.delete(`refresh/${h}`);
  await s.ns('users').delete(uid);
  // A leaderboard sync deferred by an earlier request could have re-added the entry.
  await removeFromLeaderboard(svc, uid);

  if (purge.length) ctx.defer(() => purgeMedia(svc, purge), 'media.purge');
  svc.log.info('account.deleted', { userId: uid, requestId: ctx.requestId });
  return json({ ok: true });
}
