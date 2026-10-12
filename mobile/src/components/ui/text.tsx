import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { type } from '@/theme/tokens';

export type TextVariant = keyof typeof type;

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Uppercase display text in the stencil face reads better slightly tracked. */
  upper?: boolean;
};

/** Brand text. Caps dynamic type at 1.35× so stencil headlines never break layouts. */
export function Text({ variant = 'body', color, align, upper, style, maxFontSizeMultiplier = 1.35, children, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[type[variant], color ? { color } : null, align ? { textAlign: align } : null, style]}
    >
      {upper && typeof children === 'string' ? children.toUpperCase() : children}
    </RNText>
  );
}
