import { describe, expect, it } from 'vitest';

import { plainText } from '../shared/typography';

describe('plainText', () => {
  it('turns mid-sentence dashes into commas', () => {
    expect(plainText('Not a shot — a sip.')).toBe('Not a shot, a sip.');
    expect(plainText('Smooth—and bright')).toBe('Smooth, and bright');
    expect(plainText('Reposado – my favorite')).toBe('Reposado, my favorite');
  });

  it('writes ranges with "to"', () => {
    expect(plainText('Rested 2–12 months')).toBe('Rested 2 to 12 months');
    expect(plainText('The 1930s–50s')).toBe('The 1930s to 50s');
    expect(plainText('3—5 notes')).toBe('3 to 5 notes');
  });

  it('drops dashes that open or close a line and never leaves ", ."', () => {
    expect(plainText('— La Memoria Viva')).toBe('La Memoria Viva');
    expect(plainText('Wait for it —\nthere.')).toBe('Wait for it\nthere.');
    expect(plainText('(pásale — ) amigo')).toBe('(pásale) amigo');
    expect(plainText('Neat — .')).toBe('Neat.');
  });

  it('straightens quotes and replaces ellipsis, middle dot and multiply glyphs', () => {
    expect(plainText('“Salud,” he said. It’s…')).toBe('"Salud," he said. It\'s...');
    expect(plainText('Sepia · 1940s')).toBe('Sepia, 1940s');
    expect(plainText('2× dashes of bitters')).toBe('2x dashes of bitters');
  });

  it('turns glyph bullets into plain bullets and strips ornaments', () => {
    expect(plainText('• Lime\n  ✦ Salt\n→ Ice')).toBe('- Lime\n  - Salt\n- Ice');
    expect(plainText('Five stars ★★★★★ ✓')).toBe('Five stars');
    expect(plainText('Blanco → reposado')).toBe('Blanco to reposado');
  });

  it('leaves plain text, hyphens, markdown and emoji alone', () => {
    const s = '- **Paloma**: grapefruit-forward, 2 oz blanco 🥃\n1. Salt the rim';
    expect(plainText(s)).toBe(s);
  });
});
