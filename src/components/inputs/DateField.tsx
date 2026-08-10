import React, { memo, useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Icon } from '@components/common/Icon';
import { FieldError } from './Input';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * `<input type="date">` from the mocks, as a native calendar.
 *
 * Renders like the other `.field-input` controls — same 1.5px border, 8px
 * radius and 9/11px type — but tapping opens the platform date picker instead
 * of a keyboard, so nobody has to hand-type `YYYY-MM-DD`.
 *
 * Value stays an ISO `YYYY-MM-DD` string so callers, validation counters and
 * the mock's quick-date chips keep working unchanged.
 */
export type DateFieldProps = {
  label?: string;
  required?: boolean;
  /** ISO `YYYY-MM-DD`, or empty for the placeholder. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  marginBottom?: number;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
  /** Why this field was rejected, shown beneath it in red. */
  error?: string;
};

const toIso = (d: Date): string => d.toISOString().split('T')[0];

const DateFieldComponent: React.FC<DateFieldProps> = ({
  label,
  required = false,
  value,
  onChange,
  placeholder = 'Select date',
  marginBottom = 0,
  minimumDate,
  maximumDate,
  style,
  error,
}) => {
  const [open, setOpen] = useState(false);

  const handleChange = useCallback(
    (event: { type: string }, selected?: Date) => {
      // Android's dialog is modal and reports dismissal; iOS's inline spinner
      // stays mounted until the field is tapped again.
      if (Platform.OS === 'android') {
        setOpen(false);
      }
      if (event.type === 'set' && selected) {
        onChange(toIso(selected));
      }
    },
    [onChange],
  );

  return (
    <View style={[{ marginBottom: s(marginBottom) }, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={[
          value
            ? `${label ?? 'Date'} ${value}. Change`
            : `Choose ${label ?? 'date'}`,
          error,
        ]
          .filter(Boolean)
          .join(', ')}
        style={({ pressed }) => [
          styles.field,
          error && styles.fieldInvalid,
          pressed && styles.pressed,
        ]}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value || placeholder}
        </Text>
        <Icon name="calendar-days" size={13} color={palette.slate400} />
      </Pressable>

      <FieldError>{error}</FieldError>

      {open ? (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...font(9, '800', { color: palette.slate500 }),
    textTransform: 'uppercase',
    marginBottom: s(4),
  },
  required: { color: palette.red },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.md,
  },
  fieldInvalid: {
    borderColor: palette.red,
  },
  pressed: { opacity: 0.8 },
  value: font(11, '700', { color: palette.navy }),
  placeholder: font(11, '600', { color: palette.slate400 }),
});

export const DateField = memo(DateFieldComponent);
DateField.displayName = 'DateField';
