import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { festival } from '@shared/content/festival';

import { PapelPicado } from '@/components/art/papel-picado';
import { BirthDatePicker, partsToDate, todayParts } from '@/components/birth-date-picker';
import { Button } from '@/components/ui/button';
import { PaperBackground } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ageOn, toIsoDate } from '@/lib/age';
import { API_URL } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/state/prefs';
import { art } from '@/theme/art';
import { colors, gutter } from '@/theme/tokens';

export default function AgeGate() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const passAgeGate = usePrefs((s) => s.passAgeGate);
  const [dob, setDob] = useState(todayParts);
  const [denied, setDenied] = useState(false);

  const heroH = Math.min(height * 0.36, 330);
  const logo = Math.min(width * 0.42, 170);

  const verify = () => {
    const birth = partsToDate(dob);
    if (ageOn(birth) >= festival.ageMinimum) {
      haptic.success();
      passAgeGate(toIsoDate(birth));
    } else {
      haptic.error();
      setDenied(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH }}>
          <Image source={art.heroAgaveBloom.source} placeholder={{ blurhash: art.heroAgaveBloom.blurhash! }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(243,233,210,0)', 'rgba(243,233,210,0)', colors.paper]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <PapelPicado width={width} style={{ position: 'absolute', top: insets.top + 4 }} />
        </View>

        <Animated.View entering={ZoomIn.springify().damping(13).delay(120)} style={[styles.logoWrap, { marginTop: -logo * 0.62, width: logo, height: logo }]}>
          <Image source={art.logo.source} style={{ width: logo, height: logo }} contentFit="contain" accessibilityLabel="Tequila Town" />
        </Animated.View>

        {denied ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.body}>
            <Text variant="display" align="center" color={colors.terracotta}>
              LO SENTIMOS
            </Text>
            <Text variant="lede" align="center">
              Tequila Town is for guests {festival.ageMinimum} and over.
            </Text>
            <Text variant="body" align="center">
              Come back and raise a glass with us when you&apos;re of legal drinking age. Until then, agua fresca is on us.
            </Text>
            <Button label="I entered it wrong" variant="secondary" size="md" onPress={() => setDenied(false)} style={{ alignSelf: 'center', marginTop: 8 }} />
          </Animated.View>
        ) : (
          <View style={styles.body}>
            <Animated.View entering={FadeInDown.delay(220).springify()} style={{ gap: 6 }}>
              <Text variant="lede" align="center" color={colors.terracotta}>
                Before we pour
              </Text>
              <Text variant="heading" align="center" style={{ fontSize: 26, lineHeight: 32 }}>
                Are you {festival.ageMinimum} or older?
              </Text>
              <Text variant="body" align="center">
                Enter your date of birth to step inside.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(320).springify()}>
              <BirthDatePicker value={dob} onChange={setDob} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(420).springify()} style={{ gap: 18 }}>
              <Button label="Enter Tequila Town" onPress={verify} full />
              <Text variant="small" align="center">
                Your birth date is used only to confirm you&apos;re of legal drinking age.{'\n'}By entering you agree to our{' '}
                <Text variant="small" style={styles.link} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/terms.html`)}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text variant="small" style={styles.link} onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy.html`)}>
                  Privacy Policy
                </Text>
                . Please enjoy responsibly.
              </Text>
            </Animated.View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignSelf: 'center' },
  body: { paddingHorizontal: gutter, gap: 22, marginTop: 14 },
  link: { color: colors.terracotta, textDecorationLine: 'underline', fontFamily: 'Inter_600SemiBold' },
});
