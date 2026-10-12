<p align="center">
  <img src="mobile/assets/app/splash-logo.png" width="140" alt="Tequila Town" />
</p>

<h1 align="center">Tequila Town</h1>
<p align="center"><em>The Immersive Agave Experience — native iOS & Android festival companion</em></p>

<p align="center">
Expo SDK 57 · React Native 0.86 · Expo Router · Reanimated 4 · Netlify Functions + Blobs · OpenRouter AI
</p>

---

Tequila Town is the guest app for a twelve-zone tequila festival: an illustrated journey map, a passport you fill with
stamps by completing missions (QR scans, trivia, tastings), your festival ticket, a tequila guide, schedules, sponsor
stories, a reserve-and-pickup shop — and **the Oracle**, four AI experiences powered by OpenRouter.

This repository is a ground-up rebuild of the original web MVP (`Blocpod/tequila-town-trails`, a Lovable/Supabase
prototype) as a production native app with its own Netlify backend.

## What's inside

| Area | Highlights |
| --- | --- |
| **Onboarding** | 21+ age gate with a tactile drum date picker · welcome carousel · email/password + **Sign in with Apple** · "just browsing" guest mode |
| **Home** | Parallax agave hero, live festival countdown → "Live now · Day 2 · Up next" during the event, passport progress, collage category tiles, animated zone cards, sponsor stories |
| **Journey** | Pinch-zoom illustrated map with a pin on every zone's landmark (pulsing until stamped), zone list, zoomable venue floor plan |
| **Zones** | Parallax hero (animated collage art), drop-cap story, what's poured there, programming, mission, presenting sponsor, next stop |
| **Missions & Passport** | 11 missions; steps are server-validated: **signed QR scans**, trivia, tastings, native share. Stamp "thunk" + papel confetti on completion. Passport data page, stamp grid, levels, points history, leaderboard |
| **Ticket** | Claim by scanning or typing the code (+100 pts), die-cut ticket with QR, screen brightness boost for the gate |
| **The Oracle** | **El Cantinero** (AI bartender, streaming chat with recipe cards) · **La Mesa** (food pairings) · **La Memoria Viva** (selfie → 1870s tintype / 1940s Tri-X / sepia / Kodachrome jimador portrait, save & share) · **El Ojo** (bottle-label scanner) · **Agave Persona** from the onboarding Ritual |
| **Guide & program** | Tequila guide with style explainers and synced bookmarks, Food / Culture / Music timelines, sponsor houses with offers |
| **Mercado shop** | Reserve merch for pickup (pickup code + QR, no in-app payment), bespoke requests, bottle wait-lists |
| **Account** | Edit profile & avatar, haptics & leaderboard privacy settings, **in-app account deletion**, sign out |

Design language: vintage letterpress meets Mexican folk collage — cream paper, ink linework, hard offset "print"
shadows you press *into*, the TEQUILATOWN stencil face with Fraunces and Inter, papel picado that sways, and a night
palette for the Oracle. Every touch has spring physics and haptics; Reduce Motion and screen readers are respected.

## Architecture

```
┌──────────────────────────┐        HTTPS / JSON + SSE         ┌────────────────────────────────────┐
│  mobile/  (Expo app)     │  ───────────────────────────────▶ │  Netlify site (repo root)          │
│  iOS · Android           │                                    │  netlify/functions/api.mts  /api/* │
│  expo-router screens     │  ◀─── streamed Oracle replies ──── │  netlify/functions/share.mts /m /s │
│  React Query + zustand   │                                    │  server/  (framework-free logic)   │
└──────────┬───────────────┘                                    │  Netlify Blobs  (all storage)      │
           │ imports                                            │  web/  privacy · terms · support   │
           ▼                                                    └───────────────┬────────────────────┘
┌──────────────────────────┐                                                    │
│  shared/                 │  ◀──────────── imported by both ──────────────────┤
│  content + API contract  │                                                    ▼
└──────────────────────────┘                                          OpenRouter (Claude · Gemini)
```

- **`shared/`** — the single source of truth: zones, missions (with step validation rules), drinks, sponsors,
  programme, shop catalog, the onboarding Ritual, and `api.ts`, the typed request/response contract. The server
  validates every mission step against the same file the app renders.
- **`server/` + `netlify/functions/`** — auth (scrypt passwords, HS256 JWT access tokens, rotating refresh tokens,
  Apple identity-token verification), missions & signed QR codes, tickets, leaderboard, shop, account deletion and the
  OpenRouter integrations. All state lives in **Netlify Blobs** with conditional (`onlyIfMatch` / `onlyIfNew`) writes,
  so points and claims are race-safe without a database. See [`docs/BACKEND.md`](docs/BACKEND.md).
- **`mobile/`** — the Expo app. Routes in `src/app`, design system in `src/components` + `src/theme`, feature logic
  in `src/features`, API client (with silent token refresh and byte-safe SSE parsing) in `src/lib`.

## Quick start

Requirements: Node 22.18+ (24 recommended), npm, and for device builds an [Expo](https://expo.dev) account.

```bash
# 1. Backend (repo root) — serves http://localhost:8888
npm install
cp .env.example .env        # add OPENROUTER_API_KEY to enable the Oracle locally
npm run dev                 # netlify dev (via npx) — add -- --offline to skip Netlify login
```

```bash
# 2. App
cd mobile
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8888
npx expo start              # press i / a, or scan with Expo Go
```

Without `EXPO_PUBLIC_API_URL`, development builds talk to port 8888 on the machine running Metro.

## Deploy the backend to Netlify

1. Create a Netlify site from this repository (no build command; `netlify.toml` publishes `web/` and bundles
   `netlify/functions`). Netlify Blobs needs no setup.
2. Set environment variables (Site configuration → Environment variables):

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | **yes** | Access-token signing key (`openssl rand -base64 48`) |
| `QR_SIGNING_SECRET` | **yes** | HMAC key for venue QR codes — must match the one used with `npm run qr` |
| `OPENROUTER_API_KEY` | for the Oracle | Enables chat, La Memoria Viva, El Ojo and AI personas |
| `OPENROUTER_CHAT_MODEL` / `_VISION_MODEL` / `_IMAGE_MODEL` | no | Defaults: `anthropic/claude-sonnet-5.5`, `anthropic/claude-sonnet-5.5`, `google/gemini-3.1-flash-image` |
| `APPLE_BUNDLE_IDS` | no | Accepted Sign in with Apple audiences (default `com.tequilatown.app`) |
| `RESEND_API_KEY`, `RESET_EMAIL_FROM` | no | Turns on password reset by email |
| `ADMIN_API_KEY` | no | Staff endpoints: pickup lookup, Ritual aggregates for sponsors |
| `PUBLIC_BASE_URL`, `APP_STORE_URL`, `PLAY_STORE_URL` | no | Absolute links and store buttons on shared pages |

3. Point the app at it: set `EXPO_PUBLIC_API_URL` in `mobile/eas.json` (`build.base.env`).

## Ship to the App Store & Google Play

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                               # links the project, writes the EAS projectId
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform all --profile production
```

`preview` builds an installable APK / ad-hoc iOS build for testers; `development` builds a dev client.

Store checklist (already handled in code unless noted):

- [x] Bundle id / package `com.tequilatown.app`, icons, adaptive icon (with monochrome), splash
- [x] Permission strings for camera, photo library (save portraits)
- [x] Sign in with Apple offered alongside email sign-in (`usesAppleSignIn`)
- [x] In-app account deletion (Me → Settings) and a web deletion page (`/support#delete-account`)
- [x] Privacy policy `/privacy`, terms `/terms`, support `/support` served by the Netlify site
- [x] Usable without an account (guest browsing); 21+ age gate
- [ ] Age rating: answer the alcohol questions (expect 17+ / Mature)
- [ ] Have counsel review `web/privacy.html` and `web/terms.html` (templates)
- [ ] Confirm festival dates, venue and support email in `shared/content/festival.ts`

## Venue QR codes

Scan steps only accept codes signed with `QR_SIGNING_SECRET`. Print the sheet for staff:

```bash
QR_SIGNING_SECRET=... PUBLIC_BASE_URL=https://your-site.netlify.app npm run qr   # → qr-codes/qr-codes.html
```

Each code also works typed in by hand (Scan → Enter code). Ticket validation is a stub that accepts any well-formed
code (as in the MVP) — `server/tickets.ts` marks where the Tixr API plugs in.

## Content & art

- Edit zones, missions, drinks, schedules, sponsors, shop and the Ritual in `shared/content/*.ts`.
- Re-process the original artwork (83.7 MB → 11.4 MB WebP with blurhash placeholders, plus app icons):
  `npm run assets -- <path-to-original-assets>` regenerates `mobile/assets/images` and
  `mobile/src/theme/images.generated.ts`.

## Quality checks

```bash
npm test                    # backend unit + end-to-end tests (vitest, in-memory store)
npm run typecheck           # backend types
cd mobile && npx tsc --noEmit && npx expo lint
npx expo export --platform ios --platform android    # full native bundle check
```
