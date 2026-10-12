import type { Recipe } from '@shared/api';
import { plainText } from '@shared/typography';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

export type Segment = { kind: 'text'; text: string } | { kind: 'recipe'; recipe: Recipe } | { kind: 'pending-recipe' };

const OPEN = '<recipe>';
const CLOSE = '</recipe>';

function isRecipe(v: unknown): v is Recipe {
  const r = v as Recipe;
  return !!r && typeof r.name === 'string' && Array.isArray(r.ingredients) && Array.isArray(r.steps);
}

/** House style applied after JSON.parse, so a curly quote can never break the recipe JSON. */
function cleanRecipe(r: Recipe): Recipe {
  const opt = (s?: string) => (typeof s === 'string' ? plainText(s) : undefined);
  return {
    name: plainText(r.name),
    glass: opt(r.glass),
    ingredients: r.ingredients.map((i) => plainText(String(i))),
    steps: r.steps.map((i) => plainText(String(i))),
    garnish: opt(r.garnish),
  };
}

/**
 * Split assistant text into prose and `<recipe>{json}</recipe>` cards (tolerates a
 * half-streamed block). Everything is run through the house-style `plainText`.
 */
export function parseSegments(content: string): Segment[] {
  const out: Segment[] = [];
  let rest = content;
  while (rest.length) {
    const start = rest.indexOf(OPEN);
    if (start === -1) {
      out.push({ kind: 'text', text: plainText(rest) });
      break;
    }
    if (start > 0) out.push({ kind: 'text', text: plainText(rest.slice(0, start)) });
    const end = rest.indexOf(CLOSE, start);
    if (end === -1) {
      out.push({ kind: 'pending-recipe' });
      break;
    }
    const json = rest.slice(start + OPEN.length, end).trim();
    try {
      const parsed = JSON.parse(json);
      if (isRecipe(parsed)) out.push({ kind: 'recipe', recipe: cleanRecipe(parsed) });
    } catch {
      /* malformed block: drop it rather than show raw JSON */
    }
    rest = rest.slice(end + CLOSE.length);
  }
  return out.filter((s) => s.kind !== 'text' || s.text.trim().length > 0);
}

/** Inline **bold** and *italic*. */
function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} style={{ fontFamily: fonts.sansBold, color }}>
              {p.slice(2, -2)}
            </Text>
          );
        }
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
          return (
            <Text key={i} style={{ fontFamily: fonts.serifItalic, color }}>
              {p.slice(1, -1)}
            </Text>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Minimal markdown: paragraphs, bullets, numbered lists, headings, bold/italic. */
export function RichText({ text, color = colors.paper }: { text: string; color?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        const heading = /^#{1,4}\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <Text key={i} style={[styles.p, { color, fontFamily: fonts.serif, fontSize: 17 }]}>
              <Inline text={heading[1]} color={color} />
            </Text>
          );
        }
        if (bullet || numbered) {
          return (
            <View key={i} style={styles.li}>
              {bullet ? (
                <View style={styles.dotCell}>
                  <View style={styles.dot} />
                </View>
              ) : (
                <Text style={[styles.p, styles.marker, { color: colors.sun }]}>{`${numbered![1]}.`}</Text>
              )}
              <Text style={[styles.p, { color, flex: 1 }]}>
                <Inline text={(bullet ? bullet[1] : numbered![2]) ?? ''} color={color} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.p, { color }]}>
            <Inline text={line} color={color} />
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  p: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 23 },
  li: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  marker: { fontFamily: fonts.sansBold, minWidth: 16 },
  dotCell: { minWidth: 16, height: 23, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun },
});
