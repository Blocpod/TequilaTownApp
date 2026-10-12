/**
 * Integration test of the BlobsStore adapter against the real @netlify/blobs
 * client and its local server (the same sandbox `netlify dev` uses).
 *
 * The local server differs from production in two ways the adapter must survive:
 *  - GET responses carry no ETag (the adapter recovers it from list());
 *  - ETags are derived from file mtime (ms), so tests space writes by a few ms.
 */
import { getStore } from '@netlify/blobs';
import { BlobsServer } from '@netlify/blobs/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { BlobsStore, casUpdate } from './store';
import { call, testConfig } from './test-utils';

const pause = (ms = 6) => new Promise((r) => setTimeout(r, ms));

let server: BlobsServer;
let dir: string;
let store: BlobsStore;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tt-blobs-'));
  server = new BlobsServer({ directory: dir, token: 'local-token', port: 0 });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  const bound = ((opts: Parameters<typeof getStore>[0]) =>
    getStore({ ...(opts as object), siteID: 'site-test', token: 'local-token', edgeURL: url, uncachedEdgeURL: url } as never)) as typeof getStore;
  store = new BlobsStore({ getStore: bound });
});

afterAll(async () => {
  await server?.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('BlobsStore on @netlify/blobs', () => {
  it('reads JSON with an ETag and honors onlyIfNew / onlyIfMatch', async () => {
    const kv = store.ns('progress');
    expect(await kv.getJSON('missing')).toBeNull();
    expect((await kv.setJSON('k', { n: 0 }, { onlyIfNew: true })).modified).toBe(true);
    expect((await kv.setJSON('k', { n: 9 }, { onlyIfNew: true })).modified).toBe(false);
    const cur = await kv.getJSON<{ n: number }>('k');
    expect(cur?.value).toEqual({ n: 0 });
    expect(cur?.etag).toBeTruthy();
    await pause();
    expect((await kv.setJSON('k', { n: 1 }, { onlyIfMatch: cur!.etag })).modified).toBe(true);
    await pause();
    // The stale ETag must now be rejected.
    expect((await kv.setJSON('k', { n: 2 }, { onlyIfMatch: cur!.etag })).modified).toBe(false);
    expect((await kv.getJSON<{ n: number }>('k'))?.value).toEqual({ n: 1 });
  });

  it('never performs a conditional write without an ETag', async () => {
    await expect(store.ns('progress').setJSON('k', { n: 3 }, { onlyIfMatch: '' })).rejects.toThrow(/without an ETag/);
  });

  it('casUpdate converges over sequential writers', async () => {
    const kv = store.ns('users');
    for (let i = 0; i < 4; i++) {
      await casUpdate<{ n: number }>(kv, 'counter', (d) => {
        d.n++;
      }, { init: () => ({ n: 0 }) });
      await pause();
    }
    expect((await kv.getJSON<{ n: number }>('counter'))?.value.n).toBe(4);
  });

  it('distinguishes keys that share a prefix', async () => {
    const kv = store.ns('users');
    await kv.setJSON('u1', { id: 1 });
    await kv.setJSON('u10', { id: 10 });
    expect((await kv.getJSON<{ id: number }>('u1'))?.value.id).toBe(1);
    expect(await kv.listKeys('u1')).toEqual(expect.arrayContaining(['u1', 'u10']));
  });

  it('stores bytes with metadata, streams them back, lists and deletes', async () => {
    const kv = store.ns('media');
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    await kv.setBytes('avatars/abc', bytes, { contentType: 'image/png', userId: 'u1' });
    expect((await kv.getMetadata('avatars/abc'))?.contentType).toBe('image/png');
    const got = await kv.getBytes('avatars/abc');
    expect([...got!.data]).toEqual([...bytes]);
    const streamed = await kv.getStream('avatars/abc');
    expect(new Uint8Array(await new Response(streamed!.stream).arrayBuffer())).toEqual(bytes);
    expect(await kv.listKeys('avatars/')).toEqual(['avatars/abc']);
    await kv.delete('avatars/abc');
    expect(await kv.getBytes('avatars/abc')).toBeNull();
    expect(await kv.getMetadata('avatars/abc')).toBeNull();
  });

  it('runs a real API flow on Blobs (signup → scan → complete → leaderboard)', async () => {
    const app = createApp({ store, config: testConfig() });
    const h = { app };
    const s = await call(h, 'POST', '/api/auth/signup', {
      body: { email: 'blobs@example.com', password: 'blobs-pass-1', name: 'Blob Tester', birthDate: '1990-01-01' },
    });
    expect(s.status).toBe(201);
    const token = s.body.accessToken as string;
    const { signCode } = await import('./codes');
    await call(h, 'POST', '/api/missions/step', { token, body: { missionId: 'mission-barrel-hunter', stepId: 's1' } });
    await pause();
    await call(h, 'POST', '/api/missions/step', { token, body: { missionId: 'mission-barrel-hunter', stepId: 's2', code: signCode('BRL-GOLD', 'test-qr-secret') } });
    await pause();
    await call(h, 'POST', '/api/missions/step', { token, body: { missionId: 'mission-barrel-hunter', stepId: 's3', answer: 1 } });
    await pause();
    const done = await call(h, 'POST', '/api/missions/complete', { token, body: { missionId: 'mission-barrel-hunter' } });
    expect(done.body.pointsAwarded).toBe(125);
    const board = await call(h, 'GET', '/api/leaderboard', { token });
    expect(board.body.you).toMatchObject({ rank: 1, points: 125, stamps: 1, name: 'Blob T.' });
    expect((await call(h, 'DELETE', '/api/me', { token })).status).toBe(200);
    expect(await store.ns('users').listKeys()).not.toContain(s.body.user.id);
  });
});
