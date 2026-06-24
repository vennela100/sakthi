import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import {
  ActionTile,
  AnimatedPressable,
  AuroraBackdrop,
  EmptyState,
  FadeInView,
  GhostButton,
  GlowOrb,
  PageHeader,
  PremiumCard,
  PremiumDivider,
  StatusBadge,
  SurfaceBand,
} from '../components/Premium';
import { api } from '../services/ApiService';
import { cacheEmergencyContacts, sendOfflineCapableSOS } from '../services/OfflineSOSService';
import { colors, font, gradients, layout, spacing, tracking, type } from '../theme';

const { RiskCamera } = NativeModules;

function requestLocationPermission() {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(
    result => result === PermissionsAndroid.RESULTS.GRANTED,
  );
}

function getLocationOrNull(options) {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      options,
    );
  });
}

async function getFastLocation() {
  const cached = await getLocationOrNull({ enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 });
  if (cached) return cached;
  return getLocationOrNull({ enableHighAccuracy: true, timeout: 5500, maximumAge: 30000 });
}

async function requestSmsPermission() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestCameraPermission() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

async function captureAutomaticEvidence() {
  const cameraOk = await requestCameraPermission();
  if (!cameraOk || !RiskCamera.captureEvidencePhoto) {
    return null;
  }

  try {
    return await withTimeout(
      RiskCamera.captureEvidencePhoto(),
      6500,
      'Automatic evidence capture timed out.',
    );
  } catch (_) {
    return null;
  }
}

function SosPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity, transform: [{ scale }] }]} />;
}

export default function HomeScreen({ navigation }) {
  const { logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [reports, setReports] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [riskPhoto, setRiskPhoto] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, contactsRes, reportsRes, zonesRes] = await Promise.all([
        api.profile(),
        api.contacts(),
        api.reports(),
        api.dangerZones(),
      ]);
      setProfile(profileRes.data);
      const loadedContacts = contactsRes.data.results || contactsRes.data;
      setContacts(loadedContacts);
      cacheEmergencyContacts(loadedContacts);
      setReports((reportsRes.data.results || reportsRes.data).slice(0, 3));
      setZones(zonesRes.data.results || zonesRes.data);
    } catch (error) {
      Alert.alert('Connection error', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const triggerSOS = async () => {
    const ok = await requestLocationPermission();
    if (!ok) {
      Alert.alert('Location required', 'Location permission is needed for SOS.');
      return;
    }

    setSosLoading(true);
    try {
      const smsOk = await requestSmsPermission();
      if (!smsOk) {
        Alert.alert('SMS permission required', 'Allow SMS permission so SOS can send messages directly.');
        return;
      }

      const location =
        (await getFastLocation()) ||
        (profile?.last_latitude && profile?.last_longitude
          ? { latitude: Number(profile.last_latitude), longitude: Number(profile.last_longitude) }
          : null);
      const phoneList = contacts.map(c => c.phone_number).filter(Boolean);

      if (!phoneList.length) {
        Alert.alert('No contacts', 'Add trusted contacts before using SOS direct SMS.');
        return;
      }

      const pendingPhoto = riskPhoto || (await captureAutomaticEvidence());
      const sosResult = await sendOfflineCapableSOS({
        contacts,
        location,
        photo: pendingPhoto,
        title: 'SOS! I need help.',
        imageName: 'sos_evidence.jpg',
      });
      if (pendingPhoto && !sosResult.offline) {
        setRiskPhoto(null);
      }

      Alert.alert(
        sosResult.offline ? 'Offline SOS sent' : 'SOS sent',
        `${sosResult.sentCount}/${sosResult.totalCount} messages sent directly.${sosResult.firstFailure ? `\nIssue: ${sosResult.firstFailure}` : ''}${sosResult.backendIssue ? `\nBackend issue: ${sosResult.backendIssue}` : ''}\nTracking: ${sosResult.displayLink}${sosResult.storageFull ? '\nEvidence: NOT saved — storage is full' : sosResult.evidenceUrl ? `\nEvidence: ${sosResult.evidenceUrl}` : pendingPhoto ? '\nEvidence: captured locally or upload unavailable' : '\nEvidence: automatic capture unavailable'}`,
        [{ text: 'Call 112', onPress: () => Linking.openURL('tel:112') }, { text: 'OK' }],
      );

      // Surface a dedicated alert when evidence couldn't be stored because the
      // media account is full, so it isn't missed in the SOS summary above.
      if (sosResult.storageFull) {
        Alert.alert(
          'Storage is full',
          'Your SOS was sent, but the evidence photo could not be saved because cloud storage is full. Free up space by deleting old evidence in More → SOS Evidence.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      Alert.alert('SOS failed', error.response?.data?.detail || error.message);
    } finally {
      setSosLoading(false);
    }
  };

  const openRiskCamera = async () => {
    try {
      const ok = await requestCameraPermission();
      if (!ok) {
        Alert.alert('Camera permission required', 'Allow camera permission to capture evidence.');
        return;
      }
      const photo = await RiskCamera.capturePhoto();
      setRiskPhoto(photo);
      Alert.alert('Evidence ready', 'Photo captured. Press SOS to send the tracking and evidence link to your emergency contacts.');
    } catch (error) {
      if (error.code !== 'CAPTURE_CANCELLED') {
        Alert.alert('Camera unavailable', error.message || 'Unable to capture the photo.');
      }
    }
  };

  const openTool = target => {
    if (typeof target === 'function') {
      target();
      return;
    }

    if (['AIAssistant', 'SafetyTimer', 'Nearby', 'Reports', 'Contacts'].includes(target)) {
      navigation.navigate('More', { screen: target });
      return;
    }

    navigation.navigate(target);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <FadeInView>
          <PageHeader
            eyebrow="Sakthi"
            eyebrowStyle={{ fontSize: type.heading }}
            title={`Hi, ${profile?.first_name || profile?.username || 'User'}`}
            subtitle="Your safety tools are ready."
            right={<GhostButton title="Logout" tone="danger" icon="power" onPress={logout} />}
          />
        </FadeInView>

        <FadeInView delay={60}>
          <SurfaceBand style={styles.commandPanel}>
            <AuroraBackdrop stops={gradients.ink} />
            <View style={styles.sosBadgeRow}>
              <StatusBadge label="Protection active" tone="success" />
            </View>

            <View style={styles.sosStage}>
              <GlowOrb color={colors.danger} size={300} intensity={0.5} style={styles.sosGlow} />
              <SosPulse />
              <AnimatedPressable style={styles.bigSos} onPress={triggerSOS} disabled={sosLoading}>
                <View style={styles.bigSosInner}>
                  {sosLoading ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <>
                      <Text style={styles.bigSosText}>SOS</Text>
                      <Text style={styles.bigSosSub}>TAP TO ALERT</Text>
                    </>
                  )}
                </View>
              </AnimatedPressable>
            </View>

            <Text style={styles.sosTitle}>Ready for check-in</Text>
            <Text style={styles.sosCaption}>
              Sends direct SMS, your live location, and evidence to your trusted contacts.
            </Text>

            <PremiumDivider style={styles.commandDivider} />
            <View style={styles.commandMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{contacts.length}</Text>
                <Text style={styles.metaLabel}>Contacts</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{reports.length}</Text>
                <Text style={styles.metaLabel}>Reports</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>{zones.length}</Text>
                <Text style={styles.metaLabel}>Zones</Text>
              </View>
            </View>
          </SurfaceBand>
        </FadeInView>

        <Text style={styles.sectionEyebrow}>Priority tools</Text>
        <FadeInView delay={200} style={styles.grid}>
          {[
            ['Live Track', 'Share location with contacts', 'track', 'LiveTrack', 'success'],
            ['Safe Route', 'Compare routes and zones', 'route', 'SafeRoute', 'accent'],
            ['AI Assistant', 'Ask safety guidance', 'ai', 'AIAssistant', 'violet'],
            ['Safety Timer', 'Auto SOS countdown', 'timer', 'SafetyTimer', 'warning'],
            ['Voice SOS', 'Say help me to alert', 'voice', 'VoiceSOS', 'danger'],
            ['Risk Camera', riskPhoto ? 'Evidence ready for SOS' : 'Capture evidence fast', 'camera', openRiskCamera, 'accent'],
            ['Nearby Safe', 'Police, hospitals, pharmacy', 'map', 'Nearby', 'success'],
            ['Reports', 'Community safety feed', 'report', 'Reports', 'warning'],
            ['Contacts', `${contacts.length} trusted contacts`, 'contacts', 'Contacts', 'primary'],
          ].map(item => (
            <View key={item[0]} style={styles.tileWrap}>
              <ActionTile
                title={item[0]}
                text={item[1]}
                icon={item[2]}
                tone={item[4]}
                featured={item[5]}
                onPress={() => openTool(item[3])}
              />
            </View>
          ))}
        </FadeInView>

        <PremiumCard style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Local Safety Alerts</Text>
            <StatusBadge label={`${reports.length + zones.length} signals`} tone="warning" />
          </View>
          {reports.length ? (
            reports.map(report => (
              <View key={report.id} style={styles.row}>
                <Text style={styles.rowTitle}>{report.report_type_display || report.report_type}</Text>
                <Text style={styles.rowText}>{report.location}</Text>
              </View>
            ))
          ) : (
            <EmptyState title="No recent reports" text="Community reports from the web app will appear here." />
          )}
          {zones.slice(0, 3).map(zone => (
            <View key={zone.id} style={styles.row}>
              <Text style={styles.rowTitle}>{zone.name}</Text>
              <Text style={styles.rowText}>{zone.zone_type_display || zone.zone_type}</Text>
            </View>
          ))}
        </PremiumCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingTop: layout.screenTop, paddingBottom: 40 },
  commandPanel: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  sosBadgeRow: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sosStage: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  sosGlow: { position: 'absolute' },
  pulseRing: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.danger,
  },
  bigSos: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 8,
    borderColor: 'rgba(255,45,85,0.20)',
    shadowColor: colors.danger,
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  bigSosInner: { alignItems: 'center', justifyContent: 'center' },
  bigSosText: {
    color: '#fff',
    fontFamily: font.black,
    fontSize: 48,
    letterSpacing: 1.5,
    lineHeight: 52,
  },
  bigSosSub: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: tracking.widest,
    marginTop: 2,
  },
  sosTitle: {
    color: '#fff',
    fontFamily: font.black,
    fontSize: type.title,
    letterSpacing: tracking.tight,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  sosCaption: {
    color: colors.onDarkMuted,
    fontFamily: font.regular,
    fontSize: type.callout,
    lineHeight: 21,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  commandDivider: {
    marginVertical: spacing.lg,
    backgroundColor: colors.onDarkLine,
    alignSelf: 'stretch',
  },
  commandMeta: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, height: 30, backgroundColor: colors.onDarkLine },
  metaLabel: {
    color: colors.onDarkMuted,
    fontSize: type.micro,
    fontFamily: font.bold,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  metaValue: {
    color: '#fff',
    fontSize: 24,
    fontFamily: font.black,
    letterSpacing: tracking.snug,
  },
  sectionEyebrow: {
    color: colors.muted,
    fontFamily: font.black,
    fontSize: type.micro,
    letterSpacing: tracking.widest,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileWrap: {
    width: '47.8%',
  },
  panel: { marginTop: spacing.xl },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.ink, fontFamily: font.black, fontSize: type.heading, letterSpacing: tracking.snug, marginBottom: spacing.sm },
  row: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { color: colors.ink, fontFamily: font.black, fontSize: type.callout, letterSpacing: tracking.snug },
  rowText: { color: colors.muted, fontFamily: font.regular, marginTop: 3, lineHeight: 19, fontSize: type.caption },
});
