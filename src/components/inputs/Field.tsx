import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { Icon, IconName } from '@components/common/Icon';
import { palette } from '@theme/colors';
import { font, typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * `.field-lbl` + `.field` from the mock:
 *
 *   .field-lbl { font-size:10px; color:#64748b; font-weight:700;
 *                margin-bottom:4px; display:block }
 *   .field     { padding:10px 12px; border:1px solid #e5e7eb;
 *                border-radius:8px; background:#fff;
 *                font-size:12px; color:#0f172a;
 *                display:flex; align-items:center; gap:8px;
 *                min-height:40px; margin-bottom:10px }
 *
 * The signup screen uses a tinted variant:
 *   background:#f7f9fc; border:1.5px solid #e6ecf3; border-radius:10px;
 *   font-size:12px; font-weight:700
 * and a locked variant:
 *   background:#e6ecf3; border:1.5px solid #e6ecf3; font-weight:800
 */
export type FieldVariant = 'default' | 'tinted' | 'locked';

export type FieldProps = {
  /** Uppercase label rendered above the field. */
  label?: string;
  /** Appends the red `*`. */
  required?: boolean;
  /** Muted trailing note on the label, e.g. `optional`. */
  labelNote?: string;
  labelNoteColor?: string;
  /** Right-aligned label note, e.g. `verified` in gold. */
  labelRight?: string;
  labelRightColor?: string;

  /** Read-only display value. */
  value?: string;
  /** Leading glyph inside the field. */
  icon?: IconName;
  iconColor?: string;
  /** Trailing glyph inside the field. */
  trailingIcon?: IconName;
  trailingIconColor?: string;
  /** Trailing node (e.g. a VERIFIED chip). */
  trailing?: React.ReactNode;

  variant?: FieldVariant;
  marginBottom?: number;
  /** Multi-line address blocks align their icon to the top. */
  alignTop?: boolean;
  valueStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const FieldComponent: React.FC<FieldProps> = ({
  label,
  required = false,
  labelNote,
  labelNoteColor = palette.slate400,
  labelRight,
  labelRightColor = palette.gold,
  value,
  icon,
  iconColor = palette.navy,
  trailingIcon,
  trailingIconColor = palette.gold,
  trailing,
  variant = 'default',
  marginBottom = 10,
  alignTop = false,
  valueStyle,
  style,
  children,
}) => (
  <View style={{ marginBottom: s(marginBottom) }}>
    {label ? (
      <View style={labelRight ? styles.labelRow : undefined}>
        <Text style={styles.label}>
          {label}
          {labelNote ? (
            <Text style={[styles.labelNote, { color: labelNoteColor }]}>
              {` ${labelNote}`}
            </Text>
          ) : null}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {labelRight ? (
          <Text style={[styles.labelRight, { color: labelRightColor }]}>
            {labelRight}
          </Text>
        ) : null}
      </View>
    ) : null}

    <View
      style={[
        styles.field,
        variant === 'tinted' ? styles.fieldTinted : null,
        variant === 'locked' ? styles.fieldLocked : null,
        alignTop ? styles.fieldTop : null,
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={iconColor}
          strokeWidth={2}
        />
      ) : null}

      {children ?? (
        <Text
          style={[
            variant === 'default' ? styles.value : styles.valueStrong,
            variant === 'locked' ? styles.valueLocked : null,
            valueStyle,
          ]}
        >
          {value}
        </Text>
      )}

      {trailing}
      {!trailing && trailingIcon ? (
        <Icon name={trailingIcon} size={14} color={trailingIconColor} />
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // `.field-lbl` is 10px/700; the signup screen's uppercase labels are 9px/800.
  label: {
    ...typography.inputLabel,
    color: palette.slate500,
    textTransform: 'uppercase',
    marginBottom: s(4),
  },
  labelNote: {
    ...font(9, '600'),
    textTransform: 'none',
  },
  labelRight: {
    ...typography.inputLabel,
    textTransform: 'none',
    marginBottom: s(4),
  },
  required: { color: palette.red },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    minHeight: s(40),
    backgroundColor: palette.white,
    borderWidth: s(1),
    borderColor: palette.gray200,
    borderRadius: radius.md,
  },
  fieldTinted: {
    backgroundColor: palette.surfaceAlt,
    borderWidth: s(1.5),
    borderColor: palette.navyTint,
    borderRadius: radius.lg,
  },
  fieldLocked: {
    backgroundColor: palette.navyTint,
    borderWidth: s(1.5),
    borderColor: palette.navyTint,
    borderRadius: radius.lg,
  },
  fieldTop: { alignItems: 'flex-start' },

  value: { ...typography.fieldText, color: palette.slate900, flex: 1 },
  valueStrong: { ...font(12, '700', { color: palette.slate900 }), flex: 1 },
  valueLocked: { ...font(12, '800', { color: palette.navy }), flex: 1 },
});

export const Field = memo(FieldComponent);
Field.displayName = 'Field';
