import { describe, expect, it } from 'vitest';
import type { AgavePersona, PersonaResponse, RitualResponse } from '../shared/api';
import { drinks } from '../shared/content/drinks';
import { experiences } from '../shared/content/experiences';
import { bonusPoints } from '../shared/content/festival';
import { ritual, type RitualAnswers } from '../shared/content/ritual';
import { fallbackPersona, validatePersona } from './persona';
import { call, makeHarness, signup, TEST_ADMIN_KEY } from './test-utils';

const ANSWERS: RitualAnswers = {
  drinker_identity: 'whiskey_crossover',
  how_they_drink: 'neat',
  brand_behavior: 'rotate_brands',
  taste_profile: ['smoky', 'sweet_vanilla'],
  discovery_channel: 'festivals_events',
  occasion_context: 'tastings_events',
  culture_draw: 'craft_process',
};

const DRINK_IDS = new Set(drinks.map((d) => d.id));
const EXP_IDS = new Set(experiences.map((e) => e.id));

function expectValidPersona(p: AgavePersona) {
  expect(p.title.length).toBeGreaterThan(0);
  expect(p.archetype.length).toBeGreaterThan(0);
  expect(p.description.length).toBeGreaterThan(20);
  expect(p.flavorNotes.length).toBeGreaterThanOrEqual(2);
  expect(p.flavorNotes.length).toBeLessThanOrEqual(5);
  expect(p.recommendedDrinkIds.length).toBeGreaterThanOrEqual(2);
  expect(p.recommendedDrinkIds.length).toBeLessThanOrEqual(3);
  for (const id of p.recommendedDrinkIds) expect(DRINK_IDS.has(id)).toBe(true);
  expect(p.mustVisit.length).toBeGreaterThanOrEqual(2);
  expect(p.mustVisit.length).toBeLessThanOrEqual(3);
  for (const id of p.mustVisit) expect(EXP_IDS.has(id)).toBe(true);
  expect(new Set(p.recommendedDrinkIds).size).toBe(p.recommendedDrinkIds.length);
  expect(p.signatureCocktail.ingredients.length).toBeGreaterThanOrEqual(2);
  expect(p.signatureCocktail.method.length).toBeGreaterThan(10);
}

/** Every combination of the single-choice answers (sampled) × each flavor. */
function* answerCombos(): Generator<RitualAnswers> {
  const singles = ritual.filter((q) => q.kind === 'single');
  const taste = ritual.find((q) => q.id === 'taste_profile')!;
  let i = 0;
  for (const t of taste.options) {
    for (let k = 0; k < 12; k++, i++) {
      const a: RitualAnswers = {};
      singles.forEach((q, qi) => (a[q.id] = q.options[(i * (qi + 3) + k) % q.options.length].value));
      a.taste_profile = [t.value, taste.options[(i + 1) % taste.options.length].value].filter((v, idx, arr) => arr.indexOf(v) === idx);
      yield a;
    }
  }
}

describe('fallback persona', () => {
  it('is valid for every answer combination', () => {
    let n = 0;
    for (const a of answerCombos()) {
      const p = fallbackPersona(a);
      expectValidPersona(p);
      expect(validatePersona(p as unknown as Record<string, unknown>)).toEqual(p);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(50);
  });

  it('is deterministic and reflects the answers', () => {
    const p = fallbackPersona(ANSWERS);
    expect(fallbackPersona(ANSWERS)).toEqual(p);
    expect(p.title).toBe('The Smoky Barrel Hunter');
    expect(p.archetype).toBe('Barrel Convert');
    expect(p.recommendedDrinkIds).toContain('patron-extra-anejo');
    expect(p.mustVisit[0]).toBe('la-rojena');
  });
});

describe('persona validation', () => {
  const good = fallbackPersona(ANSWERS) as unknown as Record<string, unknown>;
  it('rejects ids outside the catalog and wrong counts', () => {
    expect(validatePersona({ ...good, recommendedDrinkIds: ['made-up-tequila', 'another'] })).toBeNull();
    expect(validatePersona({ ...good, recommendedDrinkIds: ['cuervo-blanco'] })).toBeNull();
    expect(validatePersona({ ...good, recommendedDrinkIds: drinks.slice(0, 4).map((d) => d.id) })).toBeNull();
    expect(validatePersona({ ...good, mustVisit: ['narnia', 'mordor'] })).toBeNull();
    expect(validatePersona({ ...good, signatureCocktail: { name: 'x' } })).toBeNull();
    expect(validatePersona({ ...good, title: '' })).toBeNull();
    expect(validatePersona(null)).toBeNull();
  });
});

describe('POST /api/ritual', () => {
  it('validates answers', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const bad = await call(h, 'POST', '/api/ritual', { token: s.accessToken, body: { answers: { ...ANSWERS, taste_profile: ['smoky', 'smoky'] } } });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('BAD_REQUEST');
    const missing = await call(h, 'POST', '/api/ritual', { token: s.accessToken, body: { answers: { drinker_identity: 'casual_social' } } });
    expect(missing.status).toBe(400);
    const tooMany = await call(h, 'POST', '/api/ritual', {
      token: s.accessToken,
      body: { answers: { ...ANSWERS, taste_profile: ['smoky', 'sweet_vanilla', 'citrus_bright', 'herbal_vegetal'] } },
    });
    expect(tooMany.status).toBe(400);
  });

  it('stores answers, awards the bonus once and always yields a persona (no AI key)', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const res = await call<RitualResponse>(h, 'POST', '/api/ritual', { token: s.accessToken, body: { answers: { ...ANSWERS, extra: 'ignored' } } });
    expect(res.status).toBe(200);
    expect(res.body.pointsAwarded).toBe(bonusPoints.ritualComplete);
    expect(res.body.progress.ritual?.answers).toEqual(ANSWERS);
    expectValidPersona(res.body.progress.persona!);
    const again = await call<RitualResponse>(h, 'POST', '/api/ritual', { token: s.accessToken, body: { answers: { ...ANSWERS, how_they_drink: 'cocktails' } } });
    expect(again.body.pointsAwarded).toBe(0);
    expect(again.body.progress.points).toBe(bonusPoints.ritualComplete);
    expect(h.fetchMock.calls).toHaveLength(0);
  });

  it('uses the AI persona when it validates, and falls back when it does not', async () => {
    const h = makeHarness({ config: { openrouterKey: 'or-test' } });
    const s = await signup(h);
    const aiPersona = {
      title: 'The Golden Cartographer',
      archetype: 'Flavor Nomad',
      description: 'You chase oak and vanilla like a map of Jalisco.',
      flavorNotes: ['Vanilla', 'Toasted oak', 'Honey'],
      recommendedDrinkIds: ['don-julio-anejo', 'herradura-reposado'],
      mustVisit: ['barrel-gallery', 'la-cava'],
      signatureCocktail: { name: 'Mapa de Oro', ingredients: ['2 oz añejo', '0.25 oz agave'], method: 'Stir over ice and strain.' },
    };
    h.fetchMock.handler = () => Response.json({ choices: [{ message: { content: JSON.stringify(aiPersona) } }] });
    const res = await call<RitualResponse>(h, 'POST', '/api/ritual', { token: s.accessToken, body: { answers: ANSWERS } });
    expect(res.body.progress.persona).toEqual(aiPersona);
    const req = h.fetchMock.calls[0];
    expect(req.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = req.body as { response_format: { type: string; json_schema: { name: string; strict: boolean } }; model: string };
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.model).toBe('anthropic/claude-sonnet-5.5');
    expect((req.init?.headers as Record<string, string>)['x-title']).toBe('Tequila Town');

    // Regenerate: model invents a drink → validated away → deterministic fallback.
    h.fetchMock.handler = () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...aiPersona, recommendedDrinkIds: ['fake-1', 'fake-2'] }) } }] });
    const regen = await call<PersonaResponse>(h, 'POST', '/api/ai/persona', { token: s.accessToken });
    expect(regen.status).toBe(200);
    expect(regen.body.persona).toEqual(fallbackPersona(ANSWERS));
    expect(regen.body.progress.persona).toEqual(regen.body.persona);
    expect(regen.body.progress.ai.chat).toBeGreaterThan(0);

    // Upstream outage → fallback too.
    h.fetchMock.handler = () => new Response('upstream down', { status: 502 });
    const outage = await call<PersonaResponse>(h, 'POST', '/api/ai/persona', { token: s.accessToken });
    expect(outage.status).toBe(200);
    expectValidPersona(outage.body.persona);
  });

  it('persona regeneration requires a completed ritual', async () => {
    const h = makeHarness();
    const s = await signup(h);
    const res = await call(h, 'POST', '/api/ai/persona', { token: s.accessToken });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_STARTED');
  });
});

describe('admin ritual aggregates', () => {
  it('requires the admin key', async () => {
    const h = makeHarness();
    expect((await call(h, 'GET', '/api/admin/ritual-aggregates')).status).toBe(403);
    expect((await call(h, 'GET', '/api/admin/ritual-aggregates', { headers: { 'x-admin-key': 'wrong' } })).status).toBe(403);
    const unconfigured = makeHarness({ config: { adminKey: null } });
    expect((await call(unconfigured, 'GET', '/api/admin/ritual-aggregates', { headers: { 'x-admin-key': 'x' } })).body.code).toBe('NOT_CONFIGURED');
  });

  it('counts respondents per question/option with labels, tracking resubmissions', async () => {
    const h = makeHarness();
    const a = await signup(h);
    const b = await signup(h);
    await call(h, 'POST', '/api/ritual', { token: a.accessToken, body: { answers: ANSWERS } });
    await call(h, 'POST', '/api/ritual', { token: b.accessToken, body: { answers: { ...ANSWERS, how_they_drink: 'cocktails', taste_profile: ['smoky'] } } });
    // a changes their mind: counts move, respondents stay at 2.
    await call(h, 'POST', '/api/ritual', { token: a.accessToken, body: { answers: { ...ANSWERS, how_they_drink: 'rocks' } } });

    const res = await call(h, 'GET', '/api/admin/ritual-aggregates', { headers: { 'x-admin-key': TEST_ADMIN_KEY } });
    expect(res.status).toBe(200);
    expect(res.body.respondents).toBe(2);
    const how = res.body.questions.find((q: { id: string }) => q.id === 'how_they_drink');
    const count = (v: string) => how.options.find((o: { value: string }) => o.value === v).count;
    expect(count('neat')).toBe(0);
    expect(count('rocks')).toBe(1);
    expect(count('cocktails')).toBe(1);
    expect(how.options.find((o: { value: string }) => o.value === 'rocks').label).toBe('On the rocks');
    const taste = res.body.questions.find((q: { id: string }) => q.id === 'taste_profile');
    expect(taste.options.find((o: { value: string }) => o.value === 'smoky')).toMatchObject({ count: 2, percent: 100 });

    const recomputed = await call(h, 'GET', '/api/admin/ritual-aggregates?recompute=1', { headers: { 'x-admin-key': TEST_ADMIN_KEY } });
    expect(recomputed.body.questions).toEqual(res.body.questions);
  });
});
