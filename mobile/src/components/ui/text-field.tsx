import type { LucideIcon } from 'lucide-react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

import { Text } from './text';

type Props = TextInputProps & {
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  hint?: string;
  secure?: boolean;
  night?: boolean;
};

/** Labeled input with ink border, focus ring and inline error. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, icon: Icon, error, hint, secure, night, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const fg = night ? colors.paper : colors.ink;
  const borderColor = error ? colors.danger : focused ? colors.terracotta : night ? colors.nightLine : colors.ink;

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color={night ? colors.blush : colors.inkSoft}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: night ? 'rgba(243,233,210,0.06)' : colors.card },
          focused && { borderWidth: 2 },
        ]}
      >
        {Icon ? <Icon size={18} color={night ? colors.blush : colors.inkMuted} strokeWidth={2} /> : null}
        <TextInput
          ref={ref}
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          placeholderTextColor={night ? 'rgba(243,233,210,0.4)' : colors.inkMuted}
          selectionColor={colors.terracotta}
          maxFontSizeMultiplier={1.3}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: fg }, style]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            {hidden ? <Eye size={18} color={colors.inkMuted} /> : <EyeOff size={18} color={colors.inkMuted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={night ? 'rgba(243,233,210,0.6)' : colors.inkMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, paddingVertical: 14 },
});
