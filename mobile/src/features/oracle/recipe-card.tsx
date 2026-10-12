import type { Recipe } from '@shared/api';
import { GlassWater, Share2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { PrintCard } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { shareText } from '@/lib/share';
import { colors, fonts } from '@/theme/tokens';

/** A cocktail recipe the Cantinero wrote, set like a printed bar card. */
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const share = () =>
    shareText(
      `${recipe.name}\n\n${recipe.ingredients.map((i) => `• ${i}`).join('\n')}\n\n${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${recipe.garnish ? `\n\nGarnish: ${recipe.garnish}` : ''}\n\n— El Cantinero, Tequila Town 🥃`,
    );
  return (
    <Animated.View entering={FadeInUp.springify()}>
      <PrintCard background={colors.cardWarm} shadowColor={colors.terracotta} contentStyle={styles.card}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.terracotta}>
              Receta de la casa
            </Text>
            <Text style={styles.name}>{recipe.name.toUpperCase()}</Text>
            {recipe.glass ? (
              <View style={styles.glass}>
                <GlassWater size={13} color={colors.inkMuted} />
                <Text variant="small">{recipe.glass}</Text>
              </View>
            ) : null}
          </View>
          <IconButton icon={Share2} label={`Share ${recipe.name} recipe`} size={38} onPress={share} />
        </View>
        <View style={styles.rule} />
        <Text variant="label">Ingredients</Text>
        {recipe.ingredients.map((ing, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.dot}>✦</Text>
            <Text variant="body" color={colors.ink} style={{ flex: 1 }}>
              {ing}
            </Text>
          </View>
        ))}
        <Text variant="label" style={{ marginTop: 8 }}>
          Method
        </Text>
        {recipe.steps.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.num}>{i + 1}</Text>
            <Text variant="body" color={colors.ink} style={{ flex: 1 }}>
              {s}
            </Text>
          </View>
        ))}
        {recipe.garnish ? (
          <Text variant="lede" style={{ marginTop: 6, fontSize: 15 }}>
            Garnish: {recipe.garnish}
          </Text>
        ) : null}
      </PrintCard>
    </Animated.View>
  );
}

export function RecipePending() {
  return (
    <PrintCard background={colors.cardWarm} offset={0} contentStyle={[styles.card, { gap: 8 }]}>
      <Text variant="lede">Mixing your recipe…</Text>
      <Skeleton height={22} width="60%" />
      <Skeleton height={14} />
      <Skeleton height={14} width="80%" />
    </PrintCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 27, letterSpacing: 0.8, color: colors.ink, marginTop: 2 },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rule: { height: 1.2, backgroundColor: colors.inkFaint, marginVertical: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { color: colors.terracotta, fontSize: 12, lineHeight: 23 },
  num: { fontFamily: fonts.serifBlack, fontSize: 16, lineHeight: 23, color: colors.terracotta, minWidth: 14 },
});
