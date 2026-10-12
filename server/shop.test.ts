import { describe, expect, it } from 'vitest';
import type { Order, OrdersResponse } from '../shared/api';
import { MAX_ACTIVE_RESERVATIONS, priceItems } from './shop';
import { call, makeHarness, signup, TEST_ADMIN_KEY } from './test-utils';

const ADMIN = { 'x-admin-key': TEST_ADMIN_KEY };

describe('priceItems', () => {
  it('prices server-side and merges duplicate lines', () => {
    const { items, total } = priceItems([
      { productId: 'merch-tee', qty: 1, size: 'M' },
      { productId: 'goods-tote', qty: 2 },
      { productId: 'merch-tee', qty: 1, size: 'M' },
      { productId: 'merch-tee', qty: 1, size: 'L', price: 0 },
    ]);
    expect(items).toEqual([
      { productId: 'merch-tee', name: 'Tequila Town Tee', qty: 2, size: 'M', price: 35 },
      { productId: 'goods-tote', name: 'Agave Tote', qty: 2, price: 25 },
      { productId: 'merch-tee', name: 'Tequila Town Tee', qty: 1, size: 'L', price: 35 },
    ]);
    expect(total).toBe(35 * 3 + 25 * 2);
  });

  it.each([
    [[], 'empty'],
    [[{ productId: 'nope', qty: 1 }], 'unknown product'],
    [[{ productId: 'bespoke-jacket', qty: 1 }], 'request-only product'],
    [[{ productId: 'bottle-blanco', qty: 1 }], 'waitlist product'],
    [[{ productId: 'merch-tee', qty: 1 }], 'missing size'],
    [[{ productId: 'merch-tee', qty: 1, size: 'XXL' }], 'invalid size'],
    [[{ productId: 'goods-tote', qty: 1, size: 'M' }], 'size on unsized product'],
    [[{ productId: 'goods-tote', qty: 0 }], 'zero qty'],
    [[{ productId: 'goods-tote', qty: 1.5 }], 'fractional qty'],
    [[{ productId: 'merch-hoodie', qty: 3, size: 'L' }], 'over limit'],
    [[{ productId: 'merch-hoodie', qty: 1, size: 'L' }, { productId: 'merch-hoodie', qty: 2, size: 'M' }], 'over limit across sizes'],
    ['not-an-array', 'not an array'],
  ] as [unknown, string][])('rejects %j (%s)', (items) => {
    expect(() => priceItems(items)).toThrow(expect.objectContaining({ code: 'BAD_REQUEST', status: 400 }));
  });
});

describe('shop API', () => {
  it('reserves, lists newest first, cancels, and limits active reservations', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const created = await call<Order>(h, 'POST', '/api/shop/orders', {
      token: s.accessToken,
      body: { items: [{ productId: 'merch-cap', qty: 1 }, { productId: 'merch-tee', qty: 2, size: 'S' }] },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'reserved', total: 30 + 70 });
    expect(created.body.pickupCode).toMatch(/^TT-[0-9A-HJKMNP-TV-Z]{4}$/);

    for (let i = 1; i < MAX_ACTIVE_RESERVATIONS; i++) {
      h.clock.advance(1000);
      expect((await call(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-poster', qty: 1 }] } })).status).toBe(
        i <= 2 ? 201 : 409,
      );
    }
    // poster limit is 2 per guest across reservations → the 3rd/4th poster orders were refused
    let list = await call<OrdersResponse>(h, 'GET', '/api/shop/orders', { token: s.accessToken });
    expect(list.body.orders).toHaveLength(3);
    expect(list.body.orders[2].id).toBe(created.body.id);

    await call(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-jigger', qty: 1 }] } });
    await call(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-salt', qty: 1 }] } });
    const sixth = await call(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-tote', qty: 1 }] } });
    expect(sixth.status).toBe(409);
    expect(sixth.body.code).toBe('LIMIT_REACHED');

    const cancelled = await call<Order>(h, 'DELETE', `/api/shop/orders/${created.body.id}`, { token: s.accessToken });
    expect(cancelled.body.status).toBe('cancelled');
    expect((await call(h, 'DELETE', `/api/shop/orders/${created.body.id}`, { token: s.accessToken })).status).toBe(200);
    // A slot opened up.
    expect((await call(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-tote', qty: 1 }] } })).status).toBe(201);
    list = await call<OrdersResponse>(h, 'GET', '/api/shop/orders', { token: s.accessToken });
    expect(list.body.orders.filter((o) => o.status === 'reserved')).toHaveLength(MAX_ACTIVE_RESERVATIONS);
  });

  it("can't cancel someone else's order", async () => {
    const h = makeHarness();
    const a = await signup(h);
    const b = await signup(h);
    const o = await call<Order>(h, 'POST', '/api/shop/orders', { token: a.accessToken, body: { items: [{ productId: 'goods-tote', qty: 1 }] } });
    expect((await call(h, 'DELETE', `/api/shop/orders/${o.body.id}`, { token: b.accessToken })).status).toBe(404);
  });

  it('staff pickup flow by code', async () => {
    const h = makeHarness();
    const s = await signup(h, { name: 'Rosa Elena Díaz' });
    const o = await call<Order>(h, 'POST', '/api/shop/orders', { token: s.accessToken, body: { items: [{ productId: 'goods-caballitos', qty: 2 }] } });
    expect((await call(h, 'GET', `/api/admin/pickup/${o.body.pickupCode}`)).status).toBe(403);
    const look = await call(h, 'GET', `/api/admin/pickup/${o.body.pickupCode.toLowerCase()}`, { headers: ADMIN });
    expect(look.status).toBe(200);
    expect(look.body.order.total).toBe(90);
    expect(look.body.customer.name).toBe('Rosa Elena Díaz');
    const picked = await call(h, 'POST', `/api/admin/pickup/${o.body.pickupCode}/picked-up`, { headers: ADMIN });
    expect(picked.body.order.status).toBe('picked_up');
    expect((await call(h, 'POST', `/api/admin/pickup/${o.body.pickupCode}/picked-up`, { headers: ADMIN })).status).toBe(200);
    const cancel = await call(h, 'DELETE', `/api/shop/orders/${o.body.id}`, { token: s.accessToken });
    expect(cancel.status).toBe(409);
    expect((await call(h, 'GET', '/api/admin/pickup/TT-0000', { headers: ADMIN })).status).toBe(404);
  });

  it('records requests and waitlists idempotently', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const r1 = await call(h, 'POST', '/api/shop/requests', { token: s.accessToken, body: { productId: 'bespoke-jacket', message: 'Size M please' } });
    expect(r1.body).toEqual({ ok: true, kind: 'request' });
    const r2 = await call(h, 'POST', '/api/shop/requests', { token: s.accessToken, body: { productId: 'bespoke-jacket' } });
    expect(r2.body).toEqual({ ok: true, kind: 'request' });
    const w = await call(h, 'POST', '/api/shop/requests', { token: s.accessToken, body: { productId: 'bottle-anejo' } });
    expect(w.body).toEqual({ ok: true, kind: 'waitlist' });
    expect((await call(h, 'POST', '/api/shop/requests', { token: s.accessToken, body: { productId: 'merch-tee' } })).status).toBe(400);
    expect((await call(h, 'POST', '/api/shop/requests', { token: s.accessToken, body: { productId: 'nope' } })).status).toBe(400);

    const admin = await call(h, 'GET', '/api/admin/shop/requests', { headers: ADMIN });
    expect(admin.body.requests).toHaveLength(2);
    const jacket = admin.body.requests.find((r: { productId: string }) => r.productId === 'bespoke-jacket');
    expect(jacket.message).toBe('Size M please');
    expect(jacket.customer.email).toBe(s.user.email);
  });
});
