import React, { memo, useCallback, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * `.f7b-input` from the mock:
 *
 *   width:100%; padding:9px 11px; background:#fff;
 *   border:1.5px solid #e5e7eb; border-radius:8px;
 *   font-size:11px; font-weight:600; color:#0d2647; outline:none;
 *   transition:border-color .15s, box-shadow .15s;
 *   ::placeholder { color:#94a3b8; font-weight:500 }
 *   :focus        { border-color:#0d2647; box-shadow:0 0 0 3px rgba(13,38,71,0.08) }
 */
export type InputProps = Omit<TextInputProps, 'style'> & {
  /** Uppercase field label rendered above the control. */
  label?: string;
  /** Appends the red `*` used for required fields. */
  required?: boolean;
  /** Right-aligned label note, e.g. `verified`. */
  labelNote?: string;
  labelNoteColor?: string;
  /** Hint appended to the label in muted grey, e.g. `(select all that apply)`. */
  labelHint?: string;
  marginBottom?: number;
  /** `min-height` for textareas. */
  minHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Removes the border/background so the field can sit inside a compound row. */
  bare?: boolean;
};

const InputComponent: React.FC<InputProps> = ({
  label,
  required = false,
  labelNote,
  labelNoteColor = palette.gold,
  labelHint,
  marginBottom = 0,
  minHeight,
  containerStyle,
  inputStyle,
  bare = false,
  multiline,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    e => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    e => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <View style={[{ marginBottom: s(marginBottom) }, containerStyle]}>
      {label ? (
        <View style={labelNote ? styles.labelRow : undefined}>
          <Text style={styles.label}>
            {label}
            {labelHint ? (
              <Text style={styles.labelHint}>{` ${labelHint}`}</Text>
            ) : null}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
          {labelNote ? (
            <Text style={[styles.labelNote, { color: labelNoteColor }]}>
              {labelNote}
            </Text>
          ) : null}
        </View>
      ) : null}

      <TextInput
        style={[
          bare ? styles.bare : styles.input,
          !bare && focused ? styles.inputFocused : null,
          multiline ? styles.multiline : null,
          minHeight !== undefined ? { minHeight: s(minHeight) } : null,
          inputStyle,
        ]}
        placeholderTextColor={palette.slate400}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.fieldLabel,
    color: palette.slate500,
    textTransform: 'uppercase',
    marginBottom: s(4),
  },
  labelHint: {
    ...font(9, '400', { color: palette.slate400 }),
    textTransform: 'none',
  },
  labelNote: {
    ...typography.fieldLabel,
    textTransform: 'none',
    marginBottom: s(4),
  },
  required: { color: palette.red },
  input: {
    width: '100%',
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.md,
    ...typography.input,
    color: palette.navy,
  },
  inputFocused: {
    borderColor: palette.navy,
  },
  bare: {
    flex: 1,
    minWidth: 0,
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    ...typography.input,
    color: palette.navy,
  },
  multiline: {
    paddingTop: s(9),
  },
});

export const Input = memo(InputComponent);
Input.displayName = 'Input';

/**
 * The uppercase field label used on its own (outside `Input`).
 */
export const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  marginBottom?: number;
  style?: StyleProp<TextStyle>;
}> = memo(({ children, required = false, hint, marginBottom = 4, style }) => (
  <Text style={[styles.label, { marginBottom: s(marginBottom) }, style]}>
    {children}
    {hint ? <Text style={styles.labelHint}>{` ${hint}`}</Text> : null}
    {required ? <Text style={styles.required}> *</Text> : null}
  </Text>
));
FieldLabel.displayName = 'FieldLabel';
