import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Icon from './Icon';
import { colors, font, glow, gradients, radius, shadow, softShadow, spacing, tracking, type } from '../theme';

// Unique gradient ids so multiple SVG defs never collide across instances.
let _gid = 0;
const useGradientId = prefix => {
  const ref = useRef(null);
  if (ref.current === null) ref.current = `${prefix}_${++_gid}`;
  return ref.current;
};

// AuroraBackdrop — an absolutely-filled SVG linear gradient with a soft corner
// highlight. Drop behind dark hero bands / command panels for lit depth.
export function AuroraBackdrop({ stops = gradients.aurora, style }) {
  const gid = useGradientId('aurora');
  const glowId = useGradientId('auroraGlow');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdropClip, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="1" stopColor={stops[1]} />
          </SvgLinearGradient>
          <RadialGradient id={glowId} cx="18%" cy="12%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
    </View>
  );
}

// GlowOrb — a soft radial light. Scatter behind hero elements for atmosphere.
export function GlowOrb({ color = colors.primary, size = 220, intensity = 0.5, style }) {
  const gid = useGradientId('orb');
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={String(intensity)} />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <SvgCircle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

// GradientButton — a lit pill CTA with a gradient fill + colored glow. Use for
// hero actions; keep PrimaryButton for standard solid actions.
export function GradientButton({ title, onPress, stops = gradients.brand, icon, loading, disabled, style }) {
  const gid = useGradientId('btn');
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.gButton, glow(stops[0], 0.4), (disabled || loading) && styles.disabled, style]}
      pressedStyle={styles.tilePressed}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={stops[0]} />
              <Stop offset="1" stopColor={stops[1]} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
        </Svg>
      </View>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.buttonInner}>
          {!!icon && <Icon name={icon} size={18} color="#fff" strokeWidth={2.1} />}
          <Text style={styles.buttonText}>{title}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function FadeInView({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        friction: 9,
        tension: 60,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function AnimatedPressable({ children, style, pressedStyle, disabled, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = value => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={({ pressed }) => [disabled && styles.disabled, pressed && pressedStyle]}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function PageHeader({ eyebrow, eyebrowStyle, title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {!!eyebrow && <Text style={[styles.eyebrow, eyebrowStyle]}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function PremiumCard({ children, style, dark = false }) {
  return <View style={[styles.card, dark && styles.darkCard, style]}>{children}</View>;
}

export function SurfaceBand({ children, style, elevated = true }) {
  return <View style={[styles.band, elevated && shadow, style]}>{children}</View>;
}

export function PremiumDivider({ style }) {
  return <View style={[styles.divider, style]} />;
}

function toneValues(tone = 'primary') {
  if (tone === 'danger') return { color: colors.danger, soft: colors.dangerSoft };
  if (tone === 'success') return { color: colors.success, soft: colors.successSoft };
  if (tone === 'warning') return { color: colors.warning, soft: colors.warningSoft };
  if (tone === 'accent') return { color: colors.accent, soft: colors.accentSoft };
  if (tone === 'violet') return { color: colors.violet, soft: colors.violetSoft };
  if (tone === 'teal') return { color: colors.teal, soft: colors.tealSoft };
  if (tone === 'dark') return { color: colors.ink, soft: '#EFEFF2' };
  return { color: colors.primary, soft: colors.primarySoft };
}

// IconMark = a tinted rounded chip holding a stroke icon. The tile/menu accent.
export function IconMark({ name = 'shield', tone = 'primary', size = 44, style }) {
  const { color, soft } = toneValues(tone);
  return (
    <View style={[styles.iconMark, { width: size, height: size, backgroundColor: soft }, style]}>
      <Icon name={name} size={Math.round(size * 0.5)} color={color} strokeWidth={1.9} />
    </View>
  );
}

export function PrimaryButton({ title, onPress, loading, disabled, tone = 'primary', icon, style }) {
  const backgroundColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'dark'
        ? colors.ink
        : tone === 'accent'
          ? colors.accent
          : tone === 'success'
            ? colors.success
            : colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.button, { backgroundColor }, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.buttonInner}>
          {!!icon && <Icon name={icon} size={18} color="#fff" strokeWidth={2.1} />}
          <Text style={styles.buttonText}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, tone = 'accent', icon, style, disabled = false }) {
  const color = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.accent;

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      style={[styles.ghostButton, disabled && styles.disabled, style]}
      onPress={onPress}>
      <View style={styles.buttonInner}>
        {!!icon && <Icon name={icon} size={15} color={disabled ? colors.faint : color} strokeWidth={2.1} />}
        <Text style={[styles.ghostText, { color: disabled ? colors.faint : color }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function Field(props) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      style={[styles.field, props.multiline && styles.textArea, props.style]}
    />
  );
}

export function StatPill({ label, value, tone = 'primary' }) {
  const { color, soft } = toneValues(tone);

  return (
    <View style={[styles.pill, { backgroundColor: soft }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export function ActionTile({ title, text, mark, icon, tone = 'primary', onPress, featured }) {
  const { color, soft } = toneValues(tone);

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.actionTile, featured && styles.actionTileFeatured]}
      pressedStyle={styles.tilePressed}>
      <View style={[styles.tileMark, { backgroundColor: soft }]}>
        <Icon name={icon} size={22} color={color} strokeWidth={1.9} />
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileText}>{text}</Text>
      </View>
      {!icon && !!mark && <Text style={styles.tileFallback}>{mark}</Text>}
    </AnimatedPressable>
  );
}

export function StatusBadge({ label, tone = 'primary', dot = true, style }) {
  const { color, soft } = toneValues(tone);

  return (
    <View style={[styles.statusBadge, { backgroundColor: soft }, style]}>
      {dot && <View style={[styles.statusDot, { backgroundColor: color }]} />}
      <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, text, icon = 'shield' }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Icon name={icon} size={22} color={colors.faint} strokeWidth={1.8} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontSize: type.micro,
    fontFamily: font.black,
    letterSpacing: tracking.widest,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: font.black,
    fontSize: type.display,
    letterSpacing: tracking.tighter,
    marginTop: 8,
    lineHeight: 32,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: type.body,
    lineHeight: 22,
    marginTop: 7,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...softShadow,
  },
  darkCard: {
    backgroundColor: colors.elevated,
    borderColor: colors.onDarkLine,
  },
  band: {
    backgroundColor: colors.elevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.onDarkLine,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonText: { color: '#fff', fontFamily: font.black, fontSize: type.body, letterSpacing: tracking.snug },
  disabled: { opacity: 0.55 },
  ghostButton: {
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ghostText: { fontFamily: font.black, fontSize: type.caption, letterSpacing: tracking.snug },
  field: {
    minHeight: 54,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: type.body,
    fontFamily: font.regular,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  pill: {
    minWidth: 92,
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pillValue: { fontFamily: font.black, fontSize: 26, letterSpacing: tracking.tight },
  pillLabel: { color: colors.muted, fontSize: type.caption, fontFamily: font.regular, marginTop: 4, letterSpacing: tracking.wide },
  actionTile: {
    minHeight: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...softShadow,
  },
  actionTileFeatured: {
    borderColor: 'rgba(255,45,85,0.24)',
    backgroundColor: '#FFF5F7',
  },
  tilePressed: { opacity: 0.92 },
  tileMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tileBody: { gap: 5 },
  tileTitle: { color: colors.ink, fontFamily: font.black, fontSize: type.subhead, lineHeight: 20, letterSpacing: tracking.snug },
  tileText: { color: colors.muted, fontFamily: font.regular, fontSize: type.caption, lineHeight: 18 },
  tileFallback: {
    color: colors.faint,
    fontSize: 10,
    fontFamily: font.black,
    marginTop: spacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: type.micro, fontFamily: font.black, textTransform: 'uppercase', letterSpacing: tracking.wide },
  empty: {
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'flex-start',
  },
  emptyMark: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.ink, fontFamily: font.black, fontSize: type.subhead, letterSpacing: tracking.snug },
  emptyText: { color: colors.muted, fontFamily: font.regular, marginTop: 4, lineHeight: 20, fontSize: type.callout },
  iconMark: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropClip: { borderRadius: radius.xl, overflow: 'hidden' },
  gButton: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
});
