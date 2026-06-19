import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { FadeInView, GlowOrb, PrimaryButton, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { colors, font, glow, radius, shadow, spacing, tracking } from '../theme';

async function askLocation() {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function LiveTrackScreen() {
  const [position, setPosition] = useState(null);
  const [path, setPath] = useState([]);
  const [reports, setReports] = useState([]);
  const watchRef = useRef(null);

  useEffect(() => {
    api.reports().then(res => setReports(res.data.results || res.data)).catch(() => {});
    askLocation().then(ok => {
      if (!ok) return;
      watchRef.current = Geolocation.watchPosition(
        pos => {
          const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setPosition(next);
          setPath(prev => [...prev.slice(-80), next]);
          api.updateLocation(next).catch(() => {});
        },
        error => Alert.alert('Location error', error.message),
        { enableHighAccuracy: true, distanceFilter: 5, interval: 7000, fastestInterval: 5000 },
      );
    });
    return () => {
      if (watchRef.current != null) Geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const share = () => {
    if (!position) return;
    const url = `https://maps.google.com/?q=${position.latitude},${position.longitude}`;
    Linking.openURL(`sms:?body=${encodeURIComponent(`My live location: ${url}`)}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <MapView
        style={styles.map}
        region={position ? { ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 } : { latitude: 17.385, longitude: 78.4867, latitudeDelta: 0.1, longitudeDelta: 0.1 }}>
        {position && <Marker coordinate={position} title="You are here" />}
        {path.length > 1 && <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={5} />}
        {reports.filter(r => r.latitude && r.longitude).map(report => (
          <Circle key={report.id} center={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }} radius={150} fillColor="rgba(255,45,85,0.10)" strokeColor={colors.danger} />
        ))}
      </MapView>
      <FadeInView style={styles.panelWrap}>
        <GlowOrb color={colors.primary} size={260} intensity={0.4} style={styles.panelGlow} />
        <View style={styles.panel}>
          <View style={styles.panelHandle} />
          <FadeInView delay={120}>
            <StatusBadge label={position ? 'Live tracking active' : 'Acquiring GPS'} tone={position ? 'success' : 'warning'} />
          </FadeInView>
          <Text style={styles.title}>Your location</Text>
          <Text style={styles.muted}>{position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Searching for satellites...'}</Text>
          <FadeInView delay={200}>
            <View style={styles.actions}>
              <PrimaryButton title="Share" icon="send" onPress={share} disabled={!position} style={styles.actionBtn} />
              <PrimaryButton title="Call 112" tone="danger" icon="phone" onPress={() => Linking.openURL('tel:112')} style={styles.actionBtn} />
            </View>
          </FadeInView>
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  map: { flex: 1 },
  panelWrap: {
    marginTop: -radius.xxl,
    ...shadow,
    ...glow(colors.primary, 0.18),
  },
  panelGlow: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
  },
  panel: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    marginBottom: spacing.md,
  },
  title: { color: colors.ink, fontFamily: font.black, fontSize: 20, letterSpacing: tracking.tight, marginTop: spacing.sm },
  muted: { color: colors.muted, fontFamily: font.regular, marginTop: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
