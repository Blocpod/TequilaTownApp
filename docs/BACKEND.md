# Tequila Town — Backend

A Netlify site: static pages in `web/`, two Functions v2 (`netlify/functions/api.mts`, `share.mts`),
**Netlify Blobs** for all storage, **OpenRouter** for AI. The API contract is `shared/api.ts`.

```
web/                         landing, privacy, terms, support (+ account deletion), 404, fonts, logo
netlify/functions/api.mts    /api/*      → server/app.ts  createApp(deps).fetch(req)
netlify/functions/share.mts  /m/:id, /s/:code → server/share.ts
server/                      framework-free logic, dependency-injected (store, fetch, clock, Apple verifier)
  app.ts         router, CORS, auth/admin guards, error mapping, waitUntil
  store.ts       Store/KV interface · BlobsStore (strong consistency) · MemoryStore (tests) · casUpdate()
  auth.ts        scrypt, JWT (jose), refresh rotation, Apple, password reset (Resend), admin key
  codes.ts       signed venue QR codes (imports only node:crypto — used by scripts/ too)
  missions.ts    pure mission rules        progress.ts  progress record + CAS + ledger
  passport.ts    progress/mission/scan routes   tickets.ts   ticket claims (Tixr stub)
  ritual.ts      survey + analytics aggregate   persona.ts   AI persona + deterministic fallback
  leaderboard.ts single `scores` map (CAS)      shop.ts      reservations, pickup codes, requests
  account.ts     /api/me, avatar, full deletion media.ts     /api/media/:kind/:id
  ai/            openrouter client + SSE parser, prompts, chat (SSE), memory, identify, usage allowances
  share.ts       server-rendered /m and /s pages
scripts/generate-qr-codes.mjs   printable sheet of signed venue QR codes
```

## Local development

```bash
npm install
cp .env.example .env          # optional — without secrets, fixed DEV secrets are used (with a warning)
npx netlify-cli dev           # http://localhost:8888  (add --offline to skip Netlify login/linking)
npm test                      # vitest (in-memory store + a real @netlify/blobs local-server suite)
npm run typecheck             # tsc --noEmit
npm run qr                    # → qr-codes/qr-codes.html (git-ignored)
```

To exercise the AI routes without spending credits, point `OPENROUTER_BASE_URL` at a mock that speaks the
OpenAI chat-completions format (that is how the streaming smoke test was run).

### Two `netlify dev` quirks (local only)

1. **403/404 retries.** netlify-cli's dev proxy answers any 403/404 from a function by re-requesting
   `<path>.html`, `<path>.htm`, `<path>/index.html`, `<path>/index.htm` (static-file emulation) and returns the
   *last* response. `app.ts` maps those suffixes back to the real route when `NETLIFY_DEV=true`, so you still see
   `403 LOCKED` / `UNDERAGE` etc. A 403/404 is therefore executed up to 5× locally (all such paths are
   side-effect free). Never active when deployed.
2. **Local Blobs sandbox isn't atomic.** `@netlify/blobs/server` returns no ETag on GET (the adapter recovers it
   from `list()`) and checks `If-Match` non-atomically, so truly concurrent writes to one key can lose an update
   locally. Production Blobs enforces conditional writes server-side. `server/store.blobs.test.ts` runs the
   adapter against that local server.

## Deploying

1. Create a Netlify site from this repo (base directory = repo root). `netlify.toml` sets `publish = "web"`,
   `functions = "netlify/functions"`, Node 24. No build command.
2. Set environment variables (below) for the **Functions** scope — at least `JWT_SECRET` and `QR_SIGNING_SECRET`.
3. Deploy. Check `GET /api/health` → `configured.jwt` and `configured.qr` must be `true`.
4. Print venue codes with the **same** `QR_SIGNING_SECRET`: `QR_SIGNING_SECRET=… PUBLIC_BASE_URL=https://… npm run qr`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | **yes** (deployed) | HS256 key for access tokens (≥ 32 random bytes). |
| `QR_SIGNING_SECRET` | **yes** (deployed) | HMAC key for venue QR codes; must match the printed sheet. |
| `OPENROUTER_API_KEY` | for AI | Enables chat, memories, identify and AI personas. |
| `OPENROUTER_CHAT_MODEL` / `_VISION_MODEL` / `_IMAGE_MODEL` | no | Defaults `anthropic/claude-sonnet-5.5`, same, `google/gemini-3.1-flash-image`. |
| `OPENROUTER_BASE_URL` | no | Default `https://openrouter.ai/api/v1` (proxy / local mock). |
| `RESEND_API_KEY` + `RESET_EMAIL_FROM` | for reset | Email password-reset codes. Without both → 501. |
| `APPLE_BUNDLE_IDS` | no | Accepted `aud` values for Apple identity tokens (default `com.tequilatown.app`). |
| `APPLE_SIGN_IN_ENABLED` | no | `false` disables Apple sign-in. |
| `ADMIN_API_KEY` | for admin | `x-admin-key` for `/api/admin/*`. Without it → 501. |
| `PUBLIC_BASE_URL` | recommended | Canonical origin for absolute URLs (else the request origin). |
| `APP_STORE_URL`, `PLAY_STORE_URL` | no | Download buttons on share pages. |
| `SCRYPT_N` | no | scrypt cost (default 2^17). |

Secrets missing on a deployed context → the endpoints that need them return `500 NOT_CONFIGURED` (never a
guessable fallback). "Deployed" = not `NETLIFY_DEV` and any of `CONTEXT`/`NETLIFY`/`AWS_LAMBDA_FUNCTION_NAME`/`SITE_ID`.

## Storage (Netlify Blobs, site-wide stores `tt-<namespace>`, strong consistency)

| Store | Keys |
|---|---|
| `tt-users` | `<userId>` → user (no birth date — only `ageVerifiedAt`) |
| `tt-indexes` | `email/<sha256(email)>`, `apple/<sub>` → `{userId}` (created `onlyIfNew` = uniqueness) |
| `tt-tokens` | `refresh/<sha256(token)>`, `reset/<sha256(email)>`, `loginfail/<sha256(email)>` |
| `tt-progress` | `<userId>` → missions, ledger, ritual, persona, bookmarks, ticket, daily AI usage |
| `tt-tickets` | `<sha256(code)>` → `{userId, ref, claimedAt}` (`onlyIfNew` = one owner) |
| `tt-media` | `avatars/<id>`, `memories/<id>` → bytes + metadata |
| `tt-memories` | `<userId>` → memory index |
| `tt-shop` | `orders/<userId>`, `pickup/<TT-XXXX>`, `requests/<userId>/<productId>` |
| `tt-leaderboard` | `scores` → one map userId → {name "First L.", avatarId, points, level, stamps, show, at} |
| `tt-analytics` | `ritual/<userId>` (mirror), `ritual-aggregate/onboarding_v2` (counts) |

Every read-modify-write uses `casUpdate()` (ETag + `onlyIfMatch`, jittered retry ≤ 5; ≤ 10 for the shared
`scores`/aggregate docs). A lost race after all retries → `409 CONFLICT` with `retry-after: 1`. The adapter
refuses any conditional write without an ETag (fails closed, never overwrites blindly).

## Endpoints

All JSON; errors are always `ApiErrorBody { error, code, details? }`. Authenticated routes need
`Authorization: Bearer <accessToken>`. CORS allows any origin.

| Method & path | Auth | Notes / error codes |
|---|---|---|
| `GET /api/health` | – | `{ok, configured:{jwt,qr,openrouter,resend,apple}}` |
| `GET /api/config` | – | `PublicConfig` (cache 60s) |
| `POST /api/auth/signup` | – | 201 Session · 400 · 403 `UNDERAGE` · 409 `EMAIL_TAKEN` |
| `POST /api/auth/login` | – | Session · 401 `INVALID_CREDENTIALS` · 429 `RATE_LIMITED` (10 fails / 15 min / email) |
| `POST /api/auth/apple` | – | 200/201 Session · 401 (bad token) · 400/403 when a new account lacks a valid 21+ `birthDate` |
| `POST /api/auth/refresh` | – | rotates; old token dies · 401 `UNAUTHORIZED` |
| `POST /api/auth/logout` | – | `{refreshToken}` → `{ok:true}` |
| `POST /api/auth/password/forgot` | – | always `{ok:true}` · 501 `NOT_CONFIGURED` |
| `POST /api/auth/password/reset` | – | Session · 400 `INVALID_CODE` (`details.attemptsRemaining`) · 501 |
| `GET/PATCH/DELETE /api/me` | ✓ | `MeResponse` (PATCH validates bookmarks ⊆ drinks, ≤ 50) · DELETE → `{ok:true}` |
| `PUT /api/me/avatar` | ✓ | base64 JPEG/PNG ≤ 1.5 MB → `MeResponse` · 413 |
| `GET /api/progress` | ✓ | `Progress` |
| `POST /api/missions/start` | ✓ | `Progress` · 403 `LOCKED` · 404 |
| `POST /api/missions/step` | ✓ | `Progress` · 400 `INVALID_CODE` / `WRONG_ANSWER` · 403 `LOCKED` |
| `POST /api/missions/complete` | ✓ | `CompleteMissionResponse` · 400 `NOT_STARTED` / `INCOMPLETE_STEPS` · 403 |
| `POST /api/scan` | ✓ | `ScanResult` · 403 `LOCKED` |
| `POST /api/tickets/claim` | ✓ | 201 claimed / 200 already_yours · 400 `INVALID_CODE` · 409 `TICKET_TAKEN` |
| `POST /api/ritual` | ✓ | `RitualResponse` (always includes a persona) · 400 |
| `POST /api/ai/persona` | ✓ | `PersonaResponse` · 400 `NOT_STARTED` |
| `GET /api/leaderboard` | ✓ | `LeaderboardResponse` (top 50 visible users with points > 0; `you` = true rank) |
| `POST/GET /api/shop/orders` | ✓ | `Order` (201) / `OrdersResponse` · 400 · 409 `LIMIT_REACHED` (5 active / per-guest product limit) |
| `DELETE /api/shop/orders/:id` | ✓ | `Order` (cancelled) · 404 · 409 (picked up) |
| `POST /api/shop/requests` | ✓ | `ShopRequestResponse` (idempotent per user/product) |
| `POST /api/ai/chat` | ✓ | **SSE** (below) · 400 · 429 `LIMIT_REACHED` · 501 · 503 `AI_UNAVAILABLE` · 422 `AI_REFUSED` |
| `POST /api/ai/memories` | ✓ | 201 `Memory` · 400/413 · 422 `AI_REFUSED` · 429 · 501 · 503 |
| `GET /api/ai/memories` · `DELETE /api/ai/memories/:id` | ✓ | `MemoriesResponse` · `{ok:true}` / 404 |
| `POST /api/ai/identify` | ✓ | `Identification` · 422 · 429 · 501 · 503 |
| `GET /api/media/:kind/:id` | – | bytes, `cache-control: public, max-age=31536000, immutable` |
| `GET /api/admin/ritual-aggregates[?recompute=1]` | admin | counts per question/option with labels + respondents |
| `GET /api/admin/pickup/:code` · `POST …/picked-up` | admin | `{order, customer:{name}}` · 409 if cancelled |
| `GET /api/admin/shop/requests` | admin | requests & waitlists with contact details |
| `POST /api/admin/leaderboard/rebuild` | admin | recompute `scores` from user + progress records |
| `GET /m/:id` · `GET /s/:code` | – | HTML share pages (`share.mts`) |

Admin example: `curl -H "x-admin-key: $ADMIN_API_KEY" https://…/api/admin/pickup/TT-7K2Q`

## Auth model

- Access token: JWT HS256, 1 h, `iss=tequila-town`, `aud=tt-app`, `sub=userId`, `ver=sessionVersion`.
  Expired → `401 TOKEN_EXPIRED`; anything else invalid → `401 UNAUTHORIZED`. A password reset bumps
  `sessionVersion`, killing every outstanding access token.
- Refresh token: opaque, 60 days, stored as sha256 only, max 10 per user (oldest evicted). **Each refresh
  rotates** and the presented token dies immediately; two concurrent refreshes with the same token → one wins,
  the other gets 401. The app must single-flight refreshes.
- Passwords: scrypt N=2^17, r=8, p=1, per-hash salt; login always runs scrypt (dummy hash for unknown
  emails) and returns one generic error.
- Age: `birthDate` is validated (21+, evaluated in UTC−12 so nobody is admitted early) and discarded.

## AI

- Chat (`POST /api/ai/chat`) streams `text/event-stream`. Each event is exactly `data: <json>\n\n`:
  `{"delta":"…"}` (0..n), then `{"done":true,"remaining":119}`, **or** `{"error":"…","code":"AI_UNAVAILABLE"}`
  if the upstream fails mid-stream. Errors before streaming (validation, allowance, upstream connect) are
  normal JSON responses. Client disconnect aborts the upstream request. Only the last 20 messages
  (each ≤ 2000 chars, roles `user|assistant`, last = `user`) are used.
- Assistant text may contain `<recipe>{"name","glass?","ingredients":[],"steps":[],"garnish?"}</recipe>`
  blocks (single line, valid JSON) followed by a line of prose.
- Daily allowances (UTC day, from `aiLimits`): chat 120, memories 6, identify 25. A use is reserved
  atomically before the model call and refunded on failure → only successes count. Remaining counts are in
  `progress.ai`, the `done` event, and the `x-ai-remaining` header (memories/identify).
- Memories: selfie (JPEG/PNG ≤ 4 MB) + style prompt → image model with `modalities:["image","text"]`;
  the first image in `choices[0].message.images[]` (data URL, https URL or base64) is stored.
- Identify & persona use `response_format: json_schema (strict)` and are validated server-side
  (unknown drink/zone ids are rejected; persona falls back to a deterministic rules-based one).

## Rate limiting

- Platform `rateLimit` (per IP+domain): API 1200/min, share pages 300/min — a backstop only, deliberately
  generous because festival guests share venue Wi-Fi/carrier NAT IPs. Netlify answers these with a bare
  `429` (no JSON body).
- In-memory per warm instance: auth 60/min/IP, 240/min/user, chat 12/min, memories 3/min, identify 8/min,
  persona 3/min, forgot-password 20/15 min/IP. Durable: login lockout (10 fails/15 min/email), reset-code
  resend (60 s), 5 attempts per reset code.

## Known limitations

- **Leaderboard is one document** (per spec). Every points change rewrites it via CAS (in `waitUntil`, after the
  response). Fine for thousands of active users; beyond that, shard `scores` by hash(userId).
- **Ticket validation is a stub** (`validateTicketWithProvider` in `server/tickets.ts`) that accepts any
  well-formed code — plug in Tixr there.
- Image generation must finish inside the 60 s sync limit (50 s upstream timeout).
- In-memory limits are per instance (burst guards, not quotas).
- Deleted media: storage is deleted immediately and the CDN copy is purged by cache tag (best-effort); devices
  that already downloaded an image keep their cached copy.
- Universal links / App Links (`/.well-known/apple-app-site-association`, `assetlinks.json`) aren't served yet;
  `/s/:code` falls back to the `tequilatown://` scheme.
