import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, TextInputInstance, View } from 'react-native';

import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The six-box one-time-code entry.
 *
 *   six 36×46 boxes · filled = gold border on #fff7e0 · the cursor walks
 *   forward on each digit and back on Backspace from an empty box
 *
 * Lifted out of the OTP Verification screen so every place that asks for a
 * code — signing in, and confirming an account deletion — types it into the
 * same boxes and behaves the same way. `tone="danger"` fills the boxes red for
 * the destructive flow; the shape and the keyboard handling do not change.
 */
export type OtpInputTone = 'gold' | 'danger';

export type OtpInputProps = {
  /** One entry per box; `''` for an empty one. */
  value: string[];
  onChange: (next: string[]) => void;
  tone?: OtpInputTone;
  autoFocus?: boolean;
  /**
   * Bump to put the cursor back in the first box — after a wrong code or a
   * resend has emptied them.
   */
  focusSignal?: number;
  editable?: boolean;
};

const TONE: Record<OtpInputTone, { border: string; fill: string }> = {
  gold: { border: palette.gold, fill: palette.goldTint },
  danger: { border: palette.red, fill: palette.redTint },
};

const OtpInputComponent: React.FC<OtpInputProps> = ({
  value,
  onChange,
  tone = 'gold',
  autoFocus = false,
  focusSignal,
  editable = true,
}) => {
  // `TextInputInstance`, not `TextInput`: as of React Native 0.87 the name
  // `TextInput` used in type position is the component, not what a ref to one
  // holds, so it no longer carries `focus`/`blur`.
  const inputs = useRef<Array<TextInputInstance | null>>([]);
  const length = value.length;
  const skin = TONE[tone];

  /* Held in a ref so a keystroke reads the latest boxes, not a stale render's. */
  const valueRef = useRef(value);
  valueRef.current = value;

  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    inputs.current[0]?.focus();
  }, [focusSignal]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const digit = text.replace(/[^0-9]/g, '').slice(-1);
      const next = [...valueRef.current];
      next[index] = digit;
      onChange(next);
      if (digit && index < length - 1) {
        inputs.current[index + 1]?.focus();
      }
    },
    [length, onChange],
  );

  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace' && !valueRef.current[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }, []);

  return (
    <View style={styles.boxes}>
      {value.map((digit, index) => (
        <TextInput
          key={index}
          ref={element => {
            inputs.current[index] = element;
          }}
          value={digit}
          onChangeText={text => handleChange(text, index)}
          onKeyPress={event => handleKeyPress(event.nativeEvent.key, index)}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          editable={editable}
          placeholder="•"
          placeholderTextColor={palette.slate400}
          style={[
            styles.box,
            digit
              ? [
                  styles.boxFilled,
                  { borderColor: skin.border, backgroundColor: skin.fill },
                ]
              : null,
          ]}
          accessibilityLabel={`Digit ${index + 1} of ${length}`}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  boxes: {
    flexDirection: 'row',
    gap: s(6),
    justifyContent: 'center',
    marginBottom: s(6),
  },
  box: {
    width: s(36),
    height: s(46),
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.lg,
    textAlign: 'center',
    ...font(18, '800', { color: palette.slate400 }),
  },
  boxFilled: { color: palette.navy },
});

export const OtpInput = memo(OtpInputComponent);
OtpInput.displayName = 'OtpInput';
