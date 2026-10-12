import { describe, expect, it } from 'vitest';
import { missions } from '../shared/content/missions';
import { CROCKFORD_ALPHABET, crockfordBase32, normalizeScanPayload, signCode, verifyCode } from './codes';

const SECRET = 'unit-test-secret';

describe('crockfordBase32', () => {
  it('encodes known vectors', () => {
    expect(crockfordBase32(new Uint8Array([]))).toBe('');
    expect(crockfordBase32(new Uint8Array([0]))).toBe('00');
    expect(crockfordBase32(new Uint8Array([0xff]))).toBe('ZW');
    expect(crockfordBase32(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]))).toBe('ZZZZZZZZ');
  });
  it('only uses the Crockford alphabet', () => {
    const out = crockfordBase32(new Uint8Array(Array.from({ length: 64 }, (_, i) => i * 4)));
    for (const ch of out) expect(CROCKFORD_ALPHABET).toContain(ch);
  });
});

describe('signCode / verifyCode', () => {
  it('round-trips every scan step slug in the content', () => {
    const slugs = missions.flatMap((m) => m.steps.filter((s) => s.type === 'scan').map((s) => s.code!));
    expect(slugs.length).toBeGreaterThan(5);
    for (const slug of slugs) {
      const code = signCode(slug, SECRET);
      expect(code).toMatch(new RegExp(`^${slug}-[0-9A-HJKMNP-TV-Z]{5}$`));
      expect(verifyCode(code, SECRET)).toBe(slug);
    }
  });

  it('is deterministic and secret-dependent', () => {
    expect(signCode('AGV-SHRINE', SECRET)).toBe(signCode('AGV-SHRINE', SECRET));
    expect(signCode('AGV-SHRINE', SECRET)).not.toBe(signCode('AGV-SHRINE', 'other-secret'));
    expect(verifyCode(signCode('AGV-SHRINE', 'other-secret'), SECRET)).toBeNull();
  });

  it('rejects tampering', () => {
    const code = signCode('CAV-VAULT', SECRET);
    const sig = code.slice(-5);
    const flipped = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
    expect(verifyCode(code.slice(0, -5) + flipped, SECRET)).toBeNull();
    // Moving a valid signature onto another slug fails.
    expect(verifyCode(`ROJ-STILLS-${sig}`, SECRET)).toBeNull();
    expect(verifyCode('CAV-VAULT', SECRET)).toBeNull();
    expect(verifyCode(`${code}X`, SECRET)).toBeNull();
    expect(verifyCode('', SECRET)).toBeNull();
    expect(verifyCode(code, '')).toBeNull();
  });

  it('is case-insensitive and forgiving of O/0 and I/L/1 look-alikes', () => {
    const code = signCode('BRL-GOLD', SECRET);
    expect(verifyCode(code.toLowerCase(), SECRET)).toBe('BRL-GOLD');
    expect(verifyCode(`  ${code}  `, SECRET)).toBe('BRL-GOLD');
    const sig = code.slice(-5);
    const lookalike = sig.replace(/0/g, 'O').replace(/1/g, 'I');
    expect(verifyCode(code.slice(0, -5) + lookalike, SECRET)).toBe('BRL-GOLD');
  });

  it('refuses invalid slugs when signing', () => {
    expect(() => signCode('bad slug', SECRET)).toThrow();
    expect(() => signCode('', SECRET)).toThrow();
    expect(() => signCode('OK-SLUG', '')).toThrow();
  });
});

describe('normalizeScanPayload', () => {
  const code = signCode('NOC-FOUNT', SECRET);
  it.each([
    [code, code],
    [code.toLowerCase(), code],
    [`  ${code}\n`, code],
    [`tequilatown://scan/${code}`, code],
    [`TEQUILATOWN://scan/${code.toLowerCase()}`, code],
    [`tequilatown://scan/${code}?src=camera`, code],
    [`https://tequilatown.com/s/${code}`, code],
    [`https://preview--tt.netlify.app/s/${code}/`, code],
    [`http://localhost:8888/s/${encodeURIComponent(code)}?utm=x#frag`, code],
    ['TT-TICKET-12345', 'TT-TICKET-12345'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeScanPayload(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['https://example.com/'], ['https://example.com/x/ABC'], ['mailto:a@b.co'], ['javascript:alert(1)'], ['x'.repeat(2000)]])(
    'returns null for %s',
    (input) => {
      expect(normalizeScanPayload(input)).toBeNull();
    },
  );
});

describe('scripts/generate-qr-codes.mjs', () => {
  it('prints a sheet whose codes verify against the server', async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'tt-qr-'));
    try {
      const out = join(dir, 'sheet.html');
      const stdout = execFileSync(process.execPath, ['scripts/generate-qr-codes.mjs', '--base', 'https://tt.example', '--out', out], {
        env: { ...process.env, QR_SIGNING_SECRET: SECRET },
        encoding: 'utf8',
      });
      const codes = [...stdout.matchAll(/^\s+([A-Z0-9-]+-[0-9A-HJKMNP-TV-Z]{5})\s/gm)].map((m) => m[1]);
      const scanSteps = missions.flatMap((m) => m.steps.filter((s) => s.type === 'scan'));
      expect(codes).toHaveLength(scanSteps.length);
      for (const c of codes) expect(verifyCode(c, SECRET)).not.toBeNull();
      const html = readFileSync(out, 'utf8');
      expect((html.match(/<svg/g) ?? []).length).toBe(scanSteps.length);
      expect(html).toContain(`https://tt.example/s/${codes[0]}`);
      expect(html).not.toContain('DEV — DO NOT PRINT');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
