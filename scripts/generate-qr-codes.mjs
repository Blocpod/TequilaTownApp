#!/usr/bin/env node
/**
 * Generates a printable HTML sheet of signed venue QR codes — one per `scan`
 * step in shared/content/missions.ts.
 *
 *   QR_SIGNING_SECRET=… PUBLIC_BASE_URL=https://tequilatown.com npm run qr
 *   node scripts/generate-qr-codes.mjs [--base https://…] [--format url|deeplink|raw] [--out qr-codes/qr-codes.html]
 *   node scripts/generate-qr-codes.mjs --verify AGV-SHRINE-7K2QD
 *
 * QR payload formats (the app's scanner accepts all three):
 *   url       https://<base>/s/<CODE>   (default — a phone camera opens the landing page → app)
 *   deeplink  tequilatown://scan/<CODE>
 *   raw       <CODE>
 *
 * The secret MUST be the same QR_SIGNING_SECRET the deployed site uses. A `.env`
 * file in the repo root is loaded automatically. Without a secret the fixed
 * development secret is used and the sheet is watermarked "DEV — DO NOT PRINT".
 *
 * Requires Node ≥ 22.18 (imports the TypeScript sources directly via type stripping).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { DEV_QR_SECRET, normalizeScanPayload, signCode, verifyCode } from '../server/codes.ts';
import { experiences } from '../shared/content/experiences.ts';
import { missions } from '../shared/content/missions.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- args / env ---------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const secret = process.env.QR_SIGNING_SECRET?.trim() || DEV_QR_SECRET;
const isDev = secret === DEV_QR_SECRET;
const fingerprint = createHash('sha256').update(secret).digest('hex').slice(0, 8);

if (arg('verify')) {
  const input = arg('verify');
  const code = normalizeScanPayload(input);
  const slug = code ? verifyCode(code, secret) : null;
  console.log(slug ? `VALID   ${code} → slug ${slug}` : `INVALID ${input}`);
  process.exit(slug ? 0 : 1);
}

const format = arg('format') ?? 'url';
if (!['url', 'deeplink', 'raw'].includes(format)) {
  console.error(`Unknown --format ${format} (use url, deeplink or raw)`);
  process.exit(2);
}
const base = (arg('base') ?? process.env.PUBLIC_BASE_URL ?? 'https://tequilatown.com').replace(/\/+$/, '');
const out = path.resolve(root, arg('out') ?? 'qr-codes/qr-codes.html');

if (isDev) {
  console.warn('\n⚠️  QR_SIGNING_SECRET is not set — using the DEVELOPMENT secret. These codes will NOT work in production.\n');
}

// ---- build ---------------------------------------------------------------------
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const payloadFor = (code) => (format === 'url' ? `${base}/s/${code}` : format === 'deeplink' ? `tequilatown://scan/${code}` : code);

const rows = [];
for (const mission of missions) {
  for (const step of mission.steps) {
    if (step.type !== 'scan' || !step.code) continue;
    const code = signCode(step.code, secret);
    const payload = payloadFor(code);
    // Round-trip exactly what the app will do with the scanned text.
    const normalized = normalizeScanPayload(payload);
    if (!normalized || verifyCode(normalized, secret) !== step.code) {
      console.error(`Self-check failed for ${step.code} (${payload})`);
      process.exit(1);
    }
    const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#2B1A10', light: '#FFFFFF' } });
    const zone = experiences.find((e) => e.id === mission.experienceId);
    rows.push({ mission, step, code, payload, svg, zone });
  }
}

const cards = rows
  .map(
    (r) => `<article class="card">
  <header><span class="zone">${escape(r.zone ? `Zone ${r.zone.zone} · ${r.zone.name}` : r.mission.experienceId)}</span><h2>${escape(r.mission.name)}</h2></header>
  <div class="qr">${r.svg}</div>
  <p class="step">${escape(r.step.title)}</p>
  <p class="code">${escape(r.code)}</p>
  <p class="payload">${escape(r.payload)}</p>
  <p class="meta">mission ${escape(r.mission.id)} · step ${escape(r.step.id)}</p>
</article>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tequila Town — venue QR codes</title>
<style>
  :root { --ink:#2B1A10; --orange:#AD3A00; --paper:#F3E9D2; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--paper); color: var(--ink); font: 14px/1.4 Georgia, serif; }
  h1 { margin: 0 0 4px; color: var(--orange); letter-spacing: .06em; text-transform: uppercase; }
  .info { font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; margin-bottom: 20px; }
  .dev { background: #b00020; color: #fff; padding: 10px 14px; font: 700 16px/1.3 system-ui, sans-serif; margin-bottom: 16px; border: 2px solid var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
  .card { background: #fff; border: 2px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); padding: 14px; text-align: center; page-break-inside: avoid; break-inside: avoid; position: relative; }
  .card h2 { margin: 2px 0 8px; font-size: 18px; }
  .zone { font: 700 10px/1 system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #4F7A5E; }
  .qr svg { width: 100%; max-width: 220px; height: auto; }
  .step { margin: 6px 0; font-style: italic; }
  .code { margin: 6px 0 2px; font: 700 18px/1.2 ui-monospace, Menlo, Consolas, monospace; letter-spacing: .06em; }
  .payload, .meta { margin: 2px 0; font: 10px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #6b5a4a; word-break: break-all; }
  ${isDev ? `.card::after { content: 'DEV — DO NOT PRINT'; position: absolute; inset: 40% 0 auto; transform: rotate(-18deg); font: 900 22px system-ui, sans-serif; color: rgba(176,0,32,.55); pointer-events: none; }` : ''}
  @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; } }
</style></head>
<body>
${isDev ? '<div class="dev">DEVELOPMENT SECRET — these codes only work against a local/dev server. Set QR_SIGNING_SECRET to the production value before printing.</div>' : ''}
<h1>Tequila Town · Venue QR codes</h1>
<div class="info">generated ${new Date().toISOString()} · ${rows.length} codes · format=${escape(format)} · base=${escape(base)} · secret fingerprint sha256:${fingerprint}${isDev ? ' (DEV)' : ''}</div>
<section class="grid">
${cards}
</section>
</body></html>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

console.log(`Signed ${rows.length} venue codes (secret fingerprint sha256:${fingerprint}${isDev ? ', DEV' : ''}):`);
for (const r of rows) console.log(`  ${r.code.padEnd(22)} ${r.mission.id} / ${r.step.id}`);
console.log(`\nWrote ${path.relative(root, out)}`);
