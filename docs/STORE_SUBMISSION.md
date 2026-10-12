# Store submission kit

Everything App Store Connect and the Google Play Console will ask for, filled in from what the app actually does.
Review anything marked **CONFIRM** before submitting.

## Listing copy

**Name:** Tequila Town
**Subtitle (iOS, 30 chars):** The immersive agave festival
**Short description (Play, 80 chars):** Your passport to Tequila Town: map, missions, ticket, and the AI Oracle.
**Category:** Travel (primary) · Entertainment (secondary)
**Keywords (iOS, 100 chars):** tequila,festival,agave,mezcal,cocktail,bartender,passport,map,tasting,mexico,events,margarita

**Promotional text:**
Twelve zones. One journey. Collect every stamp, claim your ticket, and meet the Oracle — your AI cantinero.

**Description:**
Tequila Town is your companion for the immersive agave festival.

EXPLORE THE JOURNEY
• An illustrated, pinch-to-zoom map of all twelve zones — from the agave fields to Agave After Dark
• Stories, schedules and what's poured in every room
• Food, culture and music line-ups

FILL YOUR PASSPORT
• Complete missions by scanning QR codes, answering trivia and tasting your way through the zones
• Collect hand-stamped passport stamps, earn points, level up and climb the Hall of Legends
• Claim your festival ticket for entry — and 100 bonus points

MEET THE ORACLE
• El Cantinero: an AI bartender who finds your pour and writes you cocktail recipes
• La Mesa: food and tequila pairings for everything at the festival
• La Memoria Viva: take a selfie and become a jimador in a tintype, 1940s or Kodachrome portrait
• El Ojo: point at any bottle to learn its style, tasting notes and how to serve it
• Take the Ritual to reveal your agave persona and signature cocktail

SHOP THE MERCADO
• Reserve festival merch and goods in the app, pay and pick up at the Mercado

For guests 21 and over. Please enjoy responsibly.

**Support URL:** `https://<your-site>/support` · **Privacy policy URL:** `https://<your-site>/privacy` ·
**Account deletion URL (Play):** `https://<your-site>/delete-account`

## Screenshots to capture (6.9" iPhone + Android phone)

1. Home — hero, countdown and passport card
2. Journey map with pins
3. Mission with the stamp celebration
4. Passport data page + stamp grid
5. The Oracle hub (night)
6. El Cantinero chat with a recipe card
7. La Memoria Viva result
8. Ticket

## Age rating

- **Apple:** Alcohol, Tobacco, or Drug Use or References → *Frequent/Intense* → 17+. Unrestricted web access: No.
  Contests: No. Gambling: No. User-generated content: No (chat output is AI-generated, not shared between users).
- **Google Play (IARC):** references to alcohol → expect *Mature 17+* / PEGI 18. The app has a 21+ gate.

## Apple privacy "nutrition label"

Data **linked to the user** (used for App Functionality; no tracking, no advertising):

| Data type | Collected | Notes |
| --- | --- | --- |
| Contact info → Name | Yes | Profile display name |
| Contact info → Email address | Yes | Sign-in (email/password or Sign in with Apple) |
| Contact info → Phone number | Optional | Only if the guest adds it for shop pickup |
| User content → Photos | Yes | Avatar; La Memoria Viva selfies & generated portraits (stored until deleted). Bottle photos for El Ojo are processed, not stored |
| User content → Other user content | Yes | Onboarding Ritual answers (shared with sponsors only in aggregate) |
| Identifiers → User ID | Yes | Account id |
| Usage data → Product interaction | Yes | Mission progress, points, scans, bookmarks, shop reservations |
| Purchases | No | No in-app payments (reservations are paid at pickup) |
| Location | No | |
| Diagnostics | No | (Add if you integrate crash reporting) |

**Tracking:** No. **Third parties receiving data:** OpenRouter → model providers (Anthropic, Google) process chat
text and photos to produce responses (service providers, not tracking).

## Google Play Data safety

- Data collected: Name, Email, Phone (optional), User IDs, Photos, App interactions, Other user-generated content.
- Shared: No (processing by service providers is not "sharing" under Play's definitions).
- Encrypted in transit: Yes (HTTPS).
- Users can request deletion: Yes — in-app (Me → Settings → Delete account) and `https://<your-site>/delete-account`.
- Purpose: App functionality, Account management, Personalization.

## Sign in with Apple

Enable the *Sign in with Apple* capability for `com.tequilatown.app` in the Apple Developer portal (EAS does this
automatically when it manages credentials). The backend verifies identity tokens against `APPLE_BUNDLE_IDS`.

## Review notes (paste into "Notes for reviewer")

> Tequila Town is the companion app for an in-person 21+ tequila festival. Browse without an account via
> "Just browsing". To test account features, create an account with any email (birth date must be 21+).
> Mission QR codes are physical signs at the venue; to try a scan step, use Scan → Enter code with
> `AGV-SHRINE-XXXXX` from the attached code sheet (**CONFIRM**: attach `qr-codes/qr-codes.html` output).
> Tickets: any code in the format `TT-REVIEW-0001` claims a demo ticket. AI features require network access.
