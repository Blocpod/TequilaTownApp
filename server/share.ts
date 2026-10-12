/**
 * Public web pages served by netlify/functions/share.mts:
 *   GET /m/:id    — a shared La Memoria Viva portrait (OpenGraph/Twitter cards)
 *   GET /s/:code  — landing page for venue QR codes scanned with the phone camera;
 *                   bounces into the app via tequilatown://scan/<CODE>
 */
import { randomBytes } from 'node:crypto';
import { festival } from '../shared/content/festival';
import { memoryStyles } from '../shared/content/oracle';
import type { Config } from './config';
import { consoleLogger, mediaUrl, type Logger } from './context';
import { mediaKey } from './media';
import type { Store } from './store';
import { escapeHtml } from './util';

export type ShareDeps = { store: Store; config: Config; logger?: Logger };

const MEMORY_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const SCAN_CODE_RE = /^[A-Z0-9-]{3,100}$/;

type Shell = {
  title: string;
  description: string;
  origin: string;
  path: string;
  body: string;
  image?: { url: string; type?: string; alt: string };
  noindex?: boolean;
  nonce?: string;
  extraHead?: string;
};

function storeLinks(cfg: Config, origin: string): string {
  const links: string[] = [];
  if (cfg.appStoreUrl) links.push(`<a class="btn" href="${escapeHtml(cfg.appStoreUrl)}">Download on the App Store</a>`);
  if (cfg.playStoreUrl) links.push(`<a class="btn" href="${escapeHtml(cfg.playStoreUrl)}">Get it on Google Play</a>`);
  if (!links.length) links.push(`<a class="btn" href="${escapeHtml(origin)}/#download">Get the Tequila Town app</a>`);
  return links.join('\n');
}

export function renderShell(s: Shell): string {
  const url = `${s.origin}${s.path}`;
  const img = s.image
    ? `<meta property="og:image" content="${escapeHtml(s.image.url)}">
<meta property="og:image:alt" content="${escapeHtml(s.image.alt)}">
${s.image.type ? `<meta property="og:image:type" content="${escapeHtml(s.image.type)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(s.image.url)}">
<meta name="twitter:image:alt" content="${escapeHtml(s.image.alt)}">`
    : `<meta property="og:image" content="${escapeHtml(s.origin)}/apple-touch-icon.png">
<meta name="twitter:card" content="summary">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(s.title)}</title>
<meta name="description" content="${escapeHtml(s.description)}">
${s.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta name="theme-color" content="#AD3A00">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tequila Town">
<meta property="og:title" content="${escapeHtml(s.title)}">
<meta property="og:description" content="${escapeHtml(s.description)}">
<meta property="og:url" content="${escapeHtml(url)}">
${img}
<meta name="twitter:title" content="${escapeHtml(s.title)}">
<meta name="twitter:description" content="${escapeHtml(s.description)}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
${s.extraHead ?? ''}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="brand" href="/"><img src="/logo.webp" alt="" width="44" height="44"><span>Tequila Town</span></a>
  <nav class="site-nav" aria-label="Site"><a href="/support.html">Support</a><a href="/privacy.html">Privacy</a></nav>
</div></header>
<main id="main" class="wrap">
${s.body}
</main>
<footer class="site-footer"><div class="wrap">
  <div class="links"><a href="/">Home</a><a href="/support.html">Support</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></div>
  <p class="fine">${escapeHtml(festival.name)} is for guests ${festival.ageMinimum}+. Please enjoy responsibly and never drink and drive.</p>
</div></footer>
</body>
</html>`;
}

function csp(nonce?: string): string {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    nonce ? `script-src 'nonce-${nonce}'` : "script-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function html(body: string, status: number, cache: string, nonce?: string, noindex = false): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cache,
      'content-security-policy': csp(nonce),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...(noindex ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
    },
  });
}

function notFound(cfg: Config, origin: string, path: string, what: string): Response {
  const body = `<section class="doc wrap-narrow center">
  <p class="kicker">404</p>
  <h1>Lost in the agave</h1>
  <p class="lede">${escapeHtml(what)}</p>
  <div class="btn-row">${storeLinks(cfg, origin)}<a class="btn btn-secondary" href="/">Back to Tequila Town</a></div>
</section>`;
  return html(renderShell({ title: 'Not found | Tequila Town', description: what, origin, path, body, noindex: true }), 404, 'public, max-age=60', undefined, true);
}

export async function renderMemoryPage(deps: ShareDeps, origin: string, id: string): Promise<Response> {
  const path = `/m/${id}`;
  if (!MEMORY_ID_RE.test(id)) return notFound(deps.config, origin, path, 'This memory has faded. It may have been deleted by its owner.');
  const meta = await deps.store.ns('media').getMetadata(mediaKey('memories', id));
  if (!meta) return notFound(deps.config, origin, path, 'This memory has faded. It may have been deleted by its owner.');
  const style = memoryStyles.find((s) => s.id === meta.style);
  const styleLine = style ? `${style.name}, ${style.era}` : 'Vintage portrait';
  const imageUrl = mediaUrl(origin, 'memories', id);
  const contentType = typeof meta.contentType === 'string' ? meta.contentType : undefined;
  const alt = `A ${style ? style.name.toLowerCase() : 'vintage'} portrait of a festival guest as a jimador harvesting agave`;
  const body = `<section class="share">
  <figure class="photo-frame">
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" width="800" height="1000">
    <figcaption>La Memoria Viva: ${escapeHtml(styleLine)}</figcaption>
  </figure>
  <div>
    <p class="kicker">La Memoria Viva</p>
    <h1>Made at Tequila Town</h1>
    <p class="lede">One guest, one selfie, one trip back in time, reimagined as a jimador in the agave fields of Jalisco.</p>
    <p>Every portrait is made in the Tequila Town app at ${escapeHtml(festival.venue)}, ${escapeHtml(festival.dailyHours)} during the festival. Collect stamps, meet El Cantinero, and make a memory of your own.</p>
    <div class="btn-row">${storeLinks(deps.config, origin)}</div>
    <p class="muted small mt">AI-generated image. ${festival.ageMinimum}+ only. Please enjoy responsibly.</p>
  </div>
</section>`;
  const page = renderShell({
    title: 'A memory from Tequila Town',
    description: `A ${styleLine} portrait made with La Memoria Viva at ${festival.name} ${festival.edition}.`,
    origin,
    path,
    body,
    image: { url: imageUrl, type: contentType, alt },
    noindex: true,
  });
  return html(page, 200, 'public, max-age=300', undefined, true);
}

export function renderScanPage(deps: ShareDeps, origin: string, rawCode: string): Response {
  let code = rawCode;
  try {
    code = decodeURIComponent(rawCode);
  } catch {
    // keep raw
  }
  code = code.trim().toUpperCase();
  const path = `/s/${encodeURIComponent(code)}`;
  if (!SCAN_CODE_RE.test(code)) return notFound(deps.config, origin, path, "We couldn't read that code. Try scanning it from the Scan tab in the Tequila Town app.");
  const deepLink = `tequilatown://scan/${encodeURIComponent(code)}`;
  const nonce = randomBytes(12).toString('base64');
  const body = `<section class="doc wrap-narrow center">
  <p class="kicker">Tequila Town Passport</p>
  <h1>Open in the app</h1>
  <p class="lede">This QR is a stop on your festival passport. Open it in the Tequila Town app to collect your stamp.</p>
  <div class="btn-row">
    <a class="btn" id="open" href="${escapeHtml(deepLink)}">Open in Tequila Town</a>
  </div>
  <div class="card mt left">
    <h3 class="flush">Didn't open?</h3>
    <ol class="steps">
      <li>Install the Tequila Town app and sign in.</li>
      <li>Tap <strong>Scan</strong> and point your camera at this QR code again.</li>
      <li>Or show this code to festival staff: <span class="code-chip">${escapeHtml(code)}</span></li>
    </ol>
    <div class="btn-row">${storeLinks(deps.config, origin)}</div>
  </div>
</section>
<script nonce="${nonce}">setTimeout(function(){window.location.href=${JSON.stringify(deepLink).replace(/</g, '\\u003c')};},250);</script>`;
  const page = renderShell({
    title: 'Open in Tequila Town',
    description: 'Scan festival QR codes with the Tequila Town app to collect passport stamps.',
    origin,
    path,
    body,
    noindex: true,
    nonce,
  });
  return html(page, 200, 'public, max-age=3600', nonce, true);
}

export function createShareHandler(deps: ShareDeps) {
  const log = deps.logger ?? consoleLogger;
  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const origin = deps.config.publicBaseUrl ?? url.origin;
      try {
        let m = /^\/m\/([^/]+)\/?$/.exec(url.pathname);
        if (m) return await renderMemoryPage(deps, origin, m[1]);
        m = /^\/s\/([^/]+)\/?$/.exec(url.pathname);
        if (m) return renderScanPage(deps, origin, m[1]);
        return notFound(deps.config, origin, url.pathname, 'That page wandered off into the agave fields.');
      } catch (e) {
        log.error('share.error', { path: url.pathname, error: e instanceof Error ? e.message : String(e) });
        return new Response('Something went wrong', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    },
  };
}
