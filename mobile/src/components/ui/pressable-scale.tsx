import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** scale at full press */
  pressedScale?: number;
  hapticOnPress?: 'tap' | 'press' | 'none';
};

/** The app's base touchable: springy scale-down + haptic, honoring Reduce Motion. */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { style, children, pressedScale = 0.97, hapticOnPress = 'tap', onPressIn, onPressOut, onPress, disabled, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      onPressIn={(e) => {
        if (!reduce) scale.set(withSpring(pressedScale, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.springBouncy));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOnPress !== 'none') haptic[hapticOnPress]();
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: 0.55 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
});
