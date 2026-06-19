// Sakthi design tokens — "Royal Aurora".
//
// Direction: a pristine, luminous royal-white canvas carrying a calm, expensive
// indigo→amethyst brand, with vivid rose-red reserved exclusively for emergency.
// Separating brand (royal indigo) from emergency (red) is intentional: when SOS
// fires, red detonates against an otherwise calm UI — a safety win, not just
// decoration. Depth comes from SVG gradients/glows (react-native-svg) and
// orchestrated motion, never from clutter.
//
// Inter is the only bundled family; `font.*` maps every weight. ALWAYS style
// text with `fontFamily: font.*`, never a bare `fontWeight` (that silently
// falls back to Roboto and breaks the type system).

import { Platform, StatusBar } from 'react-native';

export const colors = {
  // Neutrals — cool royal undertone (a whisper of indigo in the greys).
  ink: '#0B0B1A', // near-black, primary headings
  text: '#191926', // body text
  muted: '#5B5B70', // secondary label
  faint: '#9696AD', // tertiary / placeholder
  line: '#E8E8F1', // standard separator
  hairline: '#F2F2F9', // ultra-light inner divider

  // Surfaces (light) — royal white.
  surface: '#FFFFFF',
  surfaceSoft: '#F4F5FB',
  canvas: '#F6F7FC', // app background — royal white
  canvasSoft: '#FBFBFE',

  // Surfaces (dark) — hero/command bands and the login screen.
  canvasDark: '#0A0A1A',
  elevated: '#15152B',
  elevatedSoft: '#1E1E3A',
  onDarkLine: 'rgba(255,255,255,0.10)',
  onDarkMuted: '#9E9EC0',

  // Brand — royal indigo → amethyst. Calm, premium, everyday actions.
  primary: '#4F46E5',
  primaryDark: '#3A33B8',
  primarySoft: '#ECEBFF',

  // Emergency — vivid rose-red. Reserved for SOS / danger ONLY.
  danger: '#FF2D55',
  dangerDark: '#D11340',
  dangerSoft: '#FFE8EE',

  // Supporting jewel tones — used to encode meaning.
  success: '#00B488',
  successSoft: '#DEF7EF',
  warning: '#FF9F0A',
  warningSoft: '#FFF1DC',
  accent: '#2F6BFF', // sapphire — informational / actions
  accentSoft: '#E6EEFF',
  violet: '#7C3AED', // amethyst — AI assistant
  violetSoft: '#F0E9FF',
  teal: '#06B6D4',
  tealSoft: '#DEF6FB',
  gold: '#D4A12A',
  steel: '#3A3A52',
  navy: '#14142A',
};

// Gradient stop-pairs for react-native-svg <LinearGradient>/<RadialGradient>.
// Reference these (never raw hex) so atmosphere stays locked to the system.
export const gradients = {
  brand: ['#5B57F2', '#7C3AED'], // indigo → amethyst (primary identity)
  royal: ['#4F46E5', '#9333EA'], // deep royal aurora
  aurora: ['#4F46E5', '#DB2777'], // indigo → magenta (hero moments)
  sos: ['#FF2D55', '#FF6B3D'], // red → orange (emergency glow)
  emerald: ['#00B488', '#22D3A8'],
  sapphire: ['#2F6BFF', '#11C2E8'],
  sunset: ['#FF6B3D', '#FFB02E'],
  ink: ['#1B1B36', '#0A0A1A'], // dark command band
};

// Status-bar-aware top breathing room. Android's SafeAreaView does NOT pad the
// status bar, which made headers hug the top edge — use layout.screenTop as the
// content paddingTop on every screen.
const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;
export const layout = {
  screenTop: statusBarH + 22,
  screenX: 18,
  screenBottom: 40,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 34,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
};

export const font = {
  regular: 'Inter-Regular',
  medium: 'Inter-Bold',
  semibold: 'Inter-Bold',
  bold: 'Inter-Bold',
  black: 'Inter-Bold',
};

// Type scale — tightened toward a precise, modern rhythm.
export const type = {
  hero: 34,
  display: 28,
  title: 22,
  heading: 19,
  subhead: 16,
  body: 15,
  callout: 14,
  caption: 12.5,
  micro: 11,
};

// Letter-spacing scale. Inter reads cleanest with negative tracking on large
// headings and positive tracking on small uppercase labels.
export const tracking = {
  tighter: -0.8,
  tight: -0.5,
  snug: -0.25,
  normal: 0,
  wide: 0.4,
  wider: 1.0,
  widest: 1.6,
};

// Elevation — soft, layered, low-opacity ambient depth with a royal-ink tint.
export const shadow = {
  elevation: 8,
  shadowColor: '#1A1442',
  shadowOpacity: 0.12,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
};

export const softShadow = {
  elevation: 2,
  shadowColor: '#1A1442',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
};

// Colored glow — drop under brand/emergency hero elements for a "lit" feel.
export function glow(color, opacity = 0.45) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  };
}

// riskScale — the single source of truth for turning a 0–100 risk score into a
// colour + zone label. Both the route map (polylines, circles, badges) and the
// report/zone lists call this, so the safety palette and wording can never
// drift between them. Colours come only from the tokens above (never raw hex).
//
// Cut points 70/40 match the backend AIService risk_score calibration. Zone
// names use the colour vocabulary ("Red/Yellow/Green Zone") to stay consistent
// with the map marker copy elsewhere on the Safe Route screen.
export function riskScale(score) {
  const value = Number(score) || 0;
  if (value >= 70) return { color: colors.danger, tone: 'danger', zone: 'Red Zone' };
  if (value >= 40) return { color: colors.warning, tone: 'warning', zone: 'Yellow Zone' };
  return { color: colors.success, tone: 'success', zone: 'Green Zone' };
}
