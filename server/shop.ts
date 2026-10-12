/**
 * The Mercado shop — reserve now, pay at pickup (no payments in-app).
 *
 *   orders/<userId>              { orders: OrderRecord[] }       (CAS)
 *   pickup/<TT-XXXX>             { userId, orderId }             (onlyIfNew → unique code)
 *   requests/<userId>/<product>  ShopRequestRecord               (idempotent per user/product)
 */
import type { Order, OrderItemInput, OrdersResponse, ShopRequestResponse } from '../shared/api';
import { productById, type ShopProduct } from '../shared/content/shop';
import type { Ctx, Services } from './context';
import { ApiError, badRequest, isPlainObject, json, optString, readJson } from './http';
import { casUpdate, NO_CHANGE } from './store';
import type { OrderRecord, ShopRequestRecord } from './types';
import { getUser } from './users';
import { randomCrockford, randomId } from './util';

export const MAX_ACTIVE_RESERVATIONS = 5;
const MAX_LINES = 20;

type OrdersDoc = { orders: OrderRecord[] };
const ordersKey = (userId: string) => `orders/${userId}`;
const pickupKey = (code: string) => `pickup/${code}`;
const PICKUP_RE = /^TT-[0-9A-HJKMNP-TV-Z]{4}$/;

export const toOrder = (o: OrderRecord): Order => ({
  id: o.id,
  pickupCode: o.pickupCode,
  status: o.status,
  items: o.items.map((i) => ({ ...i })),
  total: o.total,
  createdAt: o.createdAt,
});

/** Validates the cart against the catalog and returns priced line items (merged by product+size). */
export function priceItems(raw: unknown): { items: Order['items']; total: number } {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest('`items` must be a non-empty array', { field: 'items' });
  if (raw.length > MAX_LINES) throw badRequest(`At most ${MAX_LINES} lines per order`, { field: 'items' });
  const lines = new Map<string, { product: ShopProduct; size?: string; qty: number }>();
  raw.forEach((it: unknown, i) => {
    if (!isPlainObject(it)) throw badRequest(`items[${i}] must be an object`, { field: 'items' });
    const input = it as Partial<OrderItemInput>;
    const product = typeof input.productId === 'string' ? productById(input.productId) : undefined;
    if (!product) throw badRequest(`items[${i}]: unknown product`, { field: 'items', index: i });
    if (product.action !== 'reserve') {
      throw badRequest(`${product.name} can't be reserved — use ${product.action === 'waitlist' ? 'the waitlist' : 'a request'} instead`, {
        field: 'items',
        index: i,
        productId: product.id,
      });
    }
    if (!Number.isInteger(input.qty) || (input.qty as number) < 1 || (input.qty as number) > product.limit) {
      throw badRequest(`items[${i}]: quantity must be between 1 and ${product.limit}`, { field: 'items', index: i, productId: product.id });
    }
    let size: string | undefined;
    if (product.sizes) {
      if (typeof input.size !== 'string' || !product.sizes.includes(input.size)) {
        throw badRequest(`Choose a size for ${product.name} (${product.sizes.join(', ')})`, { field: 'items', index: i, productId: product.id });
      }
      size = input.size;
    } else if (input.size !== undefined && input.size !== null) {
      throw badRequest(`${product.name} doesn't come in sizes`, { field: 'items', index: i, productId: product.id });
    }
    const key = `${product.id}|${size ?? ''}`;
    const line = lines.get(key) ?? { product, size, qty: 0 };
    line.qty += input.qty as number;
    lines.set(key, line);
  });
  // Per-product limit across sizes within this order.
  const perProduct = new Map<string, number>();
  for (const l of lines.values()) perProduct.set(l.product.id, (perProduct.get(l.product.id) ?? 0) + l.qty);
  for (const [id, qty] of perProduct) {
    const p = productById(id)!;
    if (qty > p.limit) throw badRequest(`Limit ${p.limit} per guest for ${p.name}`, { field: 'items', productId: id });
  }
  const items = [...lines.values()].map((l) => ({
    productId: l.product.id,
    name: l.product.name,
    qty: l.qty,
    ...(l.size ? { size: l.size } : {}),
    price: l.product.price,
  }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return { items, total };
}

async function reservePickupCode(svc: Services, userId: string, orderId: string): Promise<string> {
  const shop = svc.store.ns('shop');
  for (let i = 0; i < 12; i++) {
    const code = `TT-${randomCrockford(4)}`;
    const res = await shop.setJSON(pickupKey(code), { userId, orderId }, { onlyIfNew: true });
    if (res.modified) return code;
  }
  throw new ApiError('CONFLICT', 'Could not allocate a pickup code — please try again');
}

export async function createOrder(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const body = await readJson(ctx.req);
  const { items, total } = priceItems(body.items);
  const shop = svc.store.ns('shop');

  // Cheap pre-check before allocating a pickup code (re-checked inside the CAS).
  const existing = (await shop.getJSON<OrdersDoc>(ordersKey(user.id)))?.value.orders ?? [];
  checkLimits(existing, items);

  const id = randomId(12);
  const pickupCode = await reservePickupCode(svc, user.id, id);
  const now = svc.now().toISOString();
  const order: OrderRecord = { id, pickupCode, status: 'reserved', items, total, createdAt: now, updatedAt: now, userId: user.id };
  try {
    await casUpdate<OrdersDoc>(
      shop,
      ordersKey(user.id),
      (doc) => {
        checkLimits(doc.orders, items);
        doc.orders.push(order);
      },
      { init: () => ({ orders: [] }) },
    );
  } catch (e) {
    await shop.delete(pickupKey(pickupCode)).catch(() => undefined);
    throw e;
  }
  svc.log.info('shop.order_created', { userId: user.id, orderId: id, total, requestId: ctx.requestId });
  return json(toOrder(order), 201);
}

function checkLimits(orders: OrderRecord[], items: Order['items']) {
  const active = orders.filter((o) => o.status === 'reserved');
  if (active.length >= MAX_ACTIVE_RESERVATIONS) {
    throw new ApiError('LIMIT_REACHED', `You can hold up to ${MAX_ACTIVE_RESERVATIONS} reservations at a time — pick one up or cancel one first`, {
      status: 409,
      details: { maxActive: MAX_ACTIVE_RESERVATIONS },
    });
  }
  // Per-guest product limits apply across all active reservations.
  for (const item of items) {
    const p = productById(item.productId)!;
    const held = active.flatMap((o) => o.items).filter((i) => i.productId === item.productId).reduce((s, i) => s + i.qty, 0);
    const wanted = items.filter((i) => i.productId === item.productId).reduce((s, i) => s + i.qty, 0);
    if (held + wanted > p.limit) {
      throw new ApiError('LIMIT_REACHED', `Limit ${p.limit} per guest for ${p.name} — you already have ${held} reserved`, {
        status: 409,
        details: { productId: p.id, limit: p.limit, reserved: held },
      });
    }
  }
}

export async function listOrders(ctx: Ctx): Promise<Response> {
  const doc = await ctx.svc.store.ns('shop').getJSON<OrdersDoc>(ordersKey(ctx.user.id));
  const orders = [...(doc?.value.orders ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toOrder);
  return json({ orders } satisfies OrdersResponse);
}

export async function cancelOrder(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const id = ctx.params.id;
  const now = svc.now().toISOString();
  const { value, result } = await casUpdate<OrdersDoc, OrderRecord>(
    svc.store.ns('shop'),
    ordersKey(user.id),
    (doc) => {
      const o = doc.orders.find((x) => x.id === id);
      if (!o) throw new ApiError('NOT_FOUND', 'Order not found');
      if (o.status === 'cancelled') return NO_CHANGE;
      if (o.status === 'picked_up') throw new ApiError('CONFLICT', 'This order was already picked up');
      o.status = 'cancelled';
      o.cancelledAt = now;
      o.updatedAt = now;
      return o;
    },
    { init: () => ({ orders: [] }) },
  );
  const order = result ?? value.orders.find((x) => x.id === id)!;
  return json(toOrder(order));
}

export async function createShopRequest(ctx: Ctx): Promise<Response> {
  const { svc, user } = ctx;
  const body = await readJson(ctx.req);
  const product = typeof body.productId === 'string' ? productById(body.productId) : undefined;
  if (!product) throw badRequest('Unknown product', { field: 'productId' });
  if (product.action === 'reserve') throw badRequest(`${product.name} can be reserved directly from the shop`, { field: 'productId' });
  const message = optString(body, 'message', { min: 0, max: 500 }) || null;
  const kind = product.action;
  const now = svc.now().toISOString();
  const shop = svc.store.ns('shop');
  const key = `requests/${user.id}/${product.id}`;
  const fresh: ShopRequestRecord = { userId: user.id, productId: product.id, kind, message, createdAt: now, updatedAt: now };
  const created = await shop.setJSON(key, fresh, { onlyIfNew: true });
  if (!created.modified && message) {
    // Idempotent per user/product: a repeat only refreshes the note.
    await casUpdate<ShopRequestRecord>(shop, key, (rec) => {
      if (rec.message === message) return NO_CHANGE;
      rec.message = message;
      rec.updatedAt = now;
    });
  }
  if (created.modified) svc.log.info('shop.request', { userId: user.id, productId: product.id, kind, requestId: ctx.requestId });
  return json({ ok: true, kind } satisfies ShopRequestResponse);
}

// ---------------------------------------------------------------------------
// Admin (x-admin-key)
// ---------------------------------------------------------------------------

async function findByPickupCode(svc: Services, raw: string) {
  const code = raw.trim().toUpperCase();
  if (!PICKUP_RE.test(code)) throw new ApiError('NOT_FOUND', 'Pickup code not found');
  const idx = await svc.store.ns('shop').getJSON<{ userId: string; orderId: string }>(pickupKey(code));
  if (!idx) throw new ApiError('NOT_FOUND', 'Pickup code not found');
  return idx.value;
}

export async function adminGetPickup(ctx: Omit<Ctx, 'user'>): Promise<Response> {
  const { userId, orderId } = await findByPickupCode(ctx.svc, ctx.params.code);
  const doc = await ctx.svc.store.ns('shop').getJSON<OrdersDoc>(ordersKey(userId));
  const order = doc?.value.orders.find((o) => o.id === orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found');
  const user = await getUser(ctx.svc, userId);
  return json({ order: toOrder(order), customer: { name: user?.name ?? '(deleted account)' }, pickedUpAt: order.pickedUpAt ?? null });
}

export async function adminMarkPickedUp(ctx: Omit<Ctx, 'user'>): Promise<Response> {
  const { svc } = ctx;
  const { userId, orderId } = await findByPickupCode(svc, ctx.params.code);
  const now = svc.now().toISOString();
  const { value } = await casUpdate<OrdersDoc>(svc.store.ns('shop'), ordersKey(userId), (doc) => {
    const o = doc.orders.find((x) => x.id === orderId);
    if (!o) throw new ApiError('NOT_FOUND', 'Order not found');
    if (o.status === 'picked_up') return NO_CHANGE;
    if (o.status === 'cancelled') throw new ApiError('CONFLICT', 'This order was cancelled by the guest');
    o.status = 'picked_up';
    o.pickedUpAt = now;
    o.updatedAt = now;
  });
  const order = value.orders.find((x) => x.id === orderId)!;
  svc.log.info('shop.picked_up', { orderId, requestId: ctx.requestId });
  return json({ order: toOrder(order), pickedUpAt: order.pickedUpAt ?? null });
}

/** Admin: bespoke requests + bottle waitlists, with contact details for follow-up. */
export async function adminListShopRequests(ctx: Omit<Ctx, 'user'>): Promise<Response> {
  const { svc } = ctx;
  const shop = svc.store.ns('shop');
  const keys = await shop.listKeys('requests/');
  const rows = await Promise.all(keys.map((k) => shop.getJSON<ShopRequestRecord>(k)));
  const users = new Map<string, Awaited<ReturnType<typeof getUser>>>();
  const requests = [];
  for (const row of rows) {
    if (!row) continue;
    const r = row.value;
    if (!users.has(r.userId)) users.set(r.userId, await getUser(svc, r.userId));
    const u = users.get(r.userId);
    if (!u) continue;
    requests.push({
      productId: r.productId,
      product: productById(r.productId)?.name ?? r.productId,
      kind: r.kind,
      message: r.message,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      customer: { name: u.name, email: u.email, phone: u.phone },
    });
  }
  requests.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return json({ requests });
}
