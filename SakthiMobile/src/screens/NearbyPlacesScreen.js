import React, { useState } from 'react';
import { Linking, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AnimatedPressable, AuroraBackdrop, FadeInView, GlowOrb, IconMark } from '../components/Premium';
import Icon from '../components/Icon';
import { colors, font, glow, gradients, layout, radius, spacing, tracking, type } from '../theme';

const places = [
  ['Police Stations', 'police station', 'shield', 'accent', gradients.sapphire],
  ['Hospitals', 'hospital', 'plus', 'danger', gradients.sos],
  ['Fire Stations', 'fire station', 'alert', 'warning', gradients.sunset],
  ['Pharmacies', 'pharmacy', 'plus', 'success', gradients.emerald],
];

async function locate() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return null;
  }
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

export default function NearbyPlacesScreen() {
  const [busy, setBusy] = useState(false);

  const openSearch = async query => {
    setBusy(true);
    const pos = await locate();
    setBusy(false);
    const url = pos
      ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${pos.latitude},${pos.longitude},15z`
      : `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <View style={styles.hero}>
            <AuroraBackdrop stops={gradients.royal} style={styles.heroBackdrop} />
            <GlowOrb color={colors.violet} size={240} intensity={0.5} style={styles.heroOrb} />
            <GlowOrb color={colors.accent} size={180} intensity={0.45} style={styles.heroOrbTwo} />
            <View style={styles.heroInner}>
              <Text style={styles.heroEyebrow}>Nearby Help</Text>
              <Text style={styles.heroTitle}>Safe Places</Text>
              <Text style={styles.heroSubtitle}>Open emergency support searches around your current location.</Text>
            </View>
          </View>
        </FadeInView>

        {places.map(([label, query, icon, tone, stops], index) => (
          <FadeInView key={label} delay={120 + index * 90}>
            <AnimatedPressable
              onPress={() => openSearch(query)}
              disabled={busy}
              style={[styles.card, glow(stops[0], 0.32)]}
              pressedStyle={styles.cardPressed}>
              <AuroraBackdrop stops={stops} style={styles.cardWash} />
              <View style={styles.cardRow}>
                <View style={styles.cardMark}>
                  <IconMark name={icon} tone={tone} size={54} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{label}</Text>
                  <Text style={styles.cardText}>Find nearest {label.toLowerCase()}</Text>
                </View>
                <View style={styles.openWrap}>
                  <Text style={styles.open}>Maps</Text>
                  <Icon name="chevron" size={16} color={colors.primary} strokeWidth={2.2} />
                </View>
              </View>
            </AnimatedPressable>
          </FadeInView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.screenX, paddingTop: layout.screenTop, paddingBottom: layout.screenBottom },
  hero: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    ...glow(colors.primary, 0.4),
  },
  heroBackdrop: { borderRadius: radius.xl },
  heroOrb: { position: 'absolute', top: -90, right: -70 },
  heroOrbTwo: { position: 'absolute', bottom: -80, left: -50 },
  heroInner: { gap: 7 },
  heroEyebrow: {
    color: '#fff',
    fontSize: type.micro,
    fontFamily: font.black,
    letterSpacing: tracking.widest,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: font.black,
    fontSize: type.display,
    letterSpacing: tracking.tighter,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: '#fff',
    fontFamily: font.regular,
    fontSize: type.body,
    lineHeight: 22,
    opacity: 0.82,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardWash: { borderRadius: radius.lg, opacity: 0.07 },
  cardPressed: { opacity: 0.95 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMark: { borderRadius: radius.md, overflow: 'hidden' },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.ink, fontFamily: font.bold, fontSize: type.subhead, letterSpacing: tracking.snug },
  cardText: { color: colors.muted, fontFamily: font.regular, marginTop: 4, fontSize: type.callout },
  openWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  open: { color: colors.primary, fontFamily: font.bold, fontSize: type.callout, letterSpacing: tracking.snug },
});
