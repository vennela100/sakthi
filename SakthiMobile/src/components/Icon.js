// Professional stroke-icon set (Feather/Lucide geometry) rendered with
// react-native-svg. Replaces the hand-built <View> glyphs. Every icon shares a
// 24x24 viewBox and a rounded 1.9 stroke so the set stays visually consistent.
//
// Usage: <Icon name="shield" size={22} color={colors.ink} />
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Each entry returns the inner SVG primitives. `c` = stroke colour, `sw` =
// stroke width. Fills are avoided except for deliberate accent dots.
const PATHS = {
  home: (c, sw) => (
    <>
      <Path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-4.5v-7h-6v7H4.5A1.5 1.5 0 0 1 3 20z" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </>
  ),
  track: (c, sw) => (
    <>
      <Path d="M12 21s7-6.3 7-11.5a7 7 0 1 0-14 0C5 14.7 12 21 12 21z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Circle cx="12" cy="9.5" r="2.6" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  navigate: (c, sw) => (
    <Path d="M3 11 21 3l-8 18-2.2-7.2L3 11z" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
  ),
  route: (c, sw) => (
    <>
      <Circle cx="5.5" cy="18.5" r="2.4" stroke={c} strokeWidth={sw} fill="none" />
      <Circle cx="18.5" cy="5.5" r="2.4" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M7.4 16.8C11 13 13 11 16.6 7.2" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeDasharray="0.2 3.4" fill="none" />
    </>
  ),
  voice: (c, sw) => (
    <>
      <Path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Path d="M5.5 11v1a6.5 6.5 0 0 0 13 0v-1" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <Line x1="12" y1="18.5" x2="12" y2="21.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="8.5" y1="21.5" x2="15.5" y2="21.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  ai: (c, sw) => (
    <>
      <Path d="M12 3.5 13.7 9.3 19.5 11 13.7 12.7 12 18.5 10.3 12.7 4.5 11 10.3 9.3z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Path d="M18.5 4 19.2 6.1 21.3 6.8 19.2 7.5 18.5 9.6 17.8 7.5 15.7 6.8 17.8 6.1z" fill={c} stroke="none" />
    </>
  ),
  timer: (c, sw) => (
    <>
      <Circle cx="12" cy="13" r="8.2" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M12 8.5V13l3 1.8" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1="9.5" y1="2.5" x2="14.5" y2="2.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  camera: (c, sw) => (
    <>
      <Path d="M3 8.5A1.8 1.8 0 0 1 4.8 6.7h2.4L8.7 4.3h6.6l1.5 2.4h2.4A1.8 1.8 0 0 1 21 8.5v9.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.7z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Circle cx="12" cy="13" r="3.4" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  map: (c, sw) => (
    <>
      <Path d="M9 4 3 6.5v13.5L9 17.5 15 20l6-2.5V4L15 6.5 9 4z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Line x1="9" y1="4" x2="9" y2="17.5" stroke={c} strokeWidth={sw} />
      <Line x1="15" y1="6.5" x2="15" y2="20" stroke={c} strokeWidth={sw} />
    </>
  ),
  report: (c, sw) => (
    <>
      <Path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Line x1="12" y1="9.5" x2="12" y2="13.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx="12" cy="17" r="0.4" fill={c} stroke={c} strokeWidth={sw * 0.7} />
    </>
  ),
  contacts: (c, sw) => (
    <>
      <Path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <Circle cx="9.5" cy="7.5" r="3.4" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M15.5 4.3a3.4 3.4 0 0 1 0 6.4" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
    </>
  ),
  shield: (c, sw) => (
    <>
      <Path d="M12 2.5 5 5v6c0 4.6 3 7.6 7 9.5 4-1.9 7-4.9 7-9.5V5l-7-2.5z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Path d="M9 11.5 11 13.5 15 9.5" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  more: (c, sw) => (
    <>
      <Rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke={c} strokeWidth={sw} fill="none" />
      <Rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke={c} strokeWidth={sw} fill="none" />
      <Rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke={c} strokeWidth={sw} fill="none" />
      <Rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  chevron: (c, sw) => (
    <Path d="M9 5l7 7-7 7" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  plus: (c, sw) => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  phone: (c, sw) => (
    <Path d="M21 16.4v2.6a2 2 0 0 1-2.2 2 18.6 18.6 0 0 1-8.1-2.9 18.4 18.4 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.2 4.2 2 2 0 0 1 4.2 2h2.6a2 2 0 0 1 2 1.7c.12.9.34 1.8.66 2.6a2 2 0 0 1-.45 2.1L7.9 9.5a14.8 14.8 0 0 0 5.6 5.6l1.1-1.1a2 2 0 0 1 2.1-.45c.84.32 1.7.54 2.6.66a2 2 0 0 1 1.7 2z" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
  ),
  send: (c, sw) => (
    <>
      <Line x1="21" y1="3" x2="10.5" y2="13.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M21 3 14.5 21l-4-8.5L2 8.5 21 3z" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </>
  ),
  search: (c, sw) => (
    <>
      <Circle cx="11" cy="11" r="7.2" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="16.5" y1="16.5" x2="21" y2="21" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  close: (c, sw) => (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  check: (c, sw) => (
    <Path d="M20 6 9 17l-5-5" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  power: (c, sw) => (
    <>
      <Path d="M18.4 7a8.5 8.5 0 1 1-12.8 0" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <Line x1="12" y1="2.5" x2="12" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  refresh: (c, sw) => (
    <>
      <Path d="M21 4v6h-6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M3 20v-6h6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M19 10A8 8 0 0 0 5.6 6.6L3 9M21 15l-2.6 2.4A8 8 0 0 1 5 14" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  bell: (c, sw) => (
    <>
      <Path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Path d="M13.7 20a2 2 0 0 1-3.4 0" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
    </>
  ),
  pin: (c, sw) => (
    <>
      <Path d="M12 21s7-6.3 7-11.5a7 7 0 1 0-14 0C5 14.7 12 21 12 21z" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      <Circle cx="12" cy="9.5" r="2.6" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  alert: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="12" y1="7.5" x2="12" y2="13" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx="12" cy="16.5" r="0.4" fill={c} stroke={c} strokeWidth={sw * 0.7} />
    </>
  ),
  trash: (c, sw) => (
    <>
      <Path d="M4 7h16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M10 11v6M14 11v6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M6.5 7l1 14h9l1-14M9 7V4h6v3" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </>
  ),
  google: () => (
    <>
      <Path d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
      <Path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .95-3.4.95-2.6 0-4.8-1.75-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
      <Path d="M6.4 13.95a6 6 0 0 1 0-3.85V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05" />
      <Path d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.85-2.85A10 10 0 0 0 3.1 7.5L6.4 10.1C7.2 7.75 9.4 5.8 12 5.8z" fill="#EA4335" />
    </>
  ),
};

export default function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.9, style }) {
  const render = PATHS[name];
  if (!render) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {render(color, strokeWidth)}
    </Svg>
  );
}

export const iconNames = Object.keys(PATHS);
