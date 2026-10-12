/**
 * House style: nothing a guest reads uses em or en dashes, the ellipsis glyph,
 * arrows, middle dots, curly quotes or ornament symbols. The copy is written that
 * way; AI output is run through `plainText` as a backstop because models drift.
 */

const ARROWS = '→⟶➜➔➤⇒►▸';
const BULLETS = `•▪◆◇✦✧❖${ARROWS}`;
const ORNAMENTS = /[✦✧★☆✓✔✗✘◆◇▪▫❖❧◀▶◂►▸]/gu;

export function plainText(input: string): string {
  return (
    input
      // Curly and prime quotes become straight quotes.
      .replace(/[“”„″]/g, '"')
      .replace(/[‘’‚′]/g, "'")
      // Glyph bullets at the start of a line become plain "- " bullets.
      .replace(new RegExp(`^([ \\t]*)[${BULLETS}][ \\t]+`, 'gmu'), '$1- ')
      // Ranges: 2–12 months, 1930s–50s, 3—5 notes.
      .replace(/(\d\w*)(?:[ \t]*–[ \t]*|—)(?=\d)/g, '$1 to ')
      // A dash opening or closing a line is dropped; anywhere else it reads as a comma.
      .replace(/^([ \t]*)[–—]+[ \t]*/gm, '$1')
      .replace(/[ \t]*[–—]+[ \t]*$/gm, '')
      .replace(/[ \t]*[–—]+[ \t]*/g, ', ')
      .replace(new RegExp(`[ \\t]*[${ARROWS}][ \\t]*`, 'gu'), ' to ')
      .replace(/[ \t]*·[ \t]*/g, ', ')
      .replace(/…/g, '...')
      .replace(/×/g, 'x')
      .replace(ORNAMENTS, '')
      // Tidy what the swaps can leave behind: ", ." and "( ," and doubled spaces.
      .replace(/,[ \t]*(?=[,.;:!?)])/g, '')
      .replace(/\([ \t]*,[ \t]*/g, '(')
      .replace(/(\S)[ \t]{2,}/g, '$1 ')
      .replace(/[ \t]+$/gm, '')
  );
}
