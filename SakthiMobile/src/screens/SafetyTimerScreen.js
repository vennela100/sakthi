import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import { AnimatedPressable, FadeInView, GhostButton, GlowOrb, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { cacheEmergencyContacts, sendOfflineCapableSOS } from '../services/OfflineSOSService';
import { colors, font, glow, layout, radius, shadow, softShadow, spacing, tracking, type } from '../theme';

const { RiskCamera } = NativeModules;

const TIMER_OPTIONS = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '10 min', seconds: 10 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
];

function requestLocationPermission() {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(
    result => result === PermissionsAndroid.RESULTS.GRANTED,
  );
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
  return getLocationOrNull({ enableHighAccuracy: true, timeout: 6500, maximumAge: 30000 });
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

async function captureAutomaticEvidence() {
  const cameraOk = await requestCameraPermission();
  if (!cameraOk || !RiskCamera?.captureEvidencePhoto) {
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

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function SafetyTimerScreen() {
  const [contacts, setContacts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedSeconds, setSelectedSeconds] = useState(TIMER_OPTIONS[1].seconds);
  const [remainingSeconds, setRemainingSeconds] = useState(TIMER_OPTIONS[1].seconds);
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const triggeredRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, contactsRes] = await Promise.all([api.profile(), api.contacts()]);
      setProfile(profileRes.data);
      const loadedContacts = contactsRes.data.results || contactsRes.data;
      setContacts(loadedContacts);
      cacheEmergencyContacts(loadedContacts);
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

  const triggerAutoSOS = useCallback(async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setTimerActive(false);
    setSosLoading(true);

    try {
      const locationOk = await requestLocationPermission();
      const smsOk = await requestSmsPermission();
      const phoneList = contacts.map(c => c.phone_number).filter(Boolean);

      if (!phoneList.length) {
        Alert.alert('Auto SOS blocked', 'No trusted contacts are saved.');
        return;
      }
      if (!smsOk) {
        Alert.alert('Auto SOS blocked', 'SMS permission is required to message your contacts.');
        return;
      }

      const location =
        locationOk
          ? (await getFastLocation()) ||
            (profile?.last_latitude && profile?.last_longitude
              ? { latitude: Number(profile.last_latitude), longitude: Number(profile.last_longitude) }
              : null)
          : null;
      const photo = await captureAutomaticEvidence();
      const sosResult = await sendOfflineCapableSOS({
        contacts,
        location,
        photo,
        title: 'Auto SOS triggered by my safety timer. I did not confirm that I am safe.',
        imageName: 'safety_timer_evidence.jpg',
      });

      Alert.alert(
        sosResult.offline ? 'Offline Auto SOS sent' : 'Auto SOS sent',
        `${sosResult.sentCount}/${sosResult.totalCount} contacts messaged.${sosResult.firstFailure ? `\nIssue: ${sosResult.firstFailure}` : ''}${sosResult.backendIssue ? `\nBackend issue: ${sosResult.backendIssue}` : ''}\nTracking: ${sosResult.displayLink}`,
        [{ text: 'Call 112', onPress: () => Linking.openURL('tel:112') }, { text: 'OK' }],
      );
    } catch (error) {
      Alert.alert('Auto SOS failed', error.response?.data?.detail || error.message);
    } finally {
      triggeredRef.current = false;
      setSosLoading(false);
    }
  }, [contacts, profile]);

  useEffect(() => {
    if (!timerActive) return undefined;
    if (remainingSeconds <= 0) {
      triggerAutoSOS();
      return undefined;
    }

    const id = setInterval(() => {
      setRemainingSeconds(current => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds, timerActive, triggerAutoSOS]);

  const selectTimer = seconds => {
    if (timerActive || sosLoading) return;
    setSelectedSeconds(seconds);
    setRemainingSeconds(seconds);
  };

  const startTimer = async () => {
    if (!contacts.length) {
      Alert.alert('Add contacts first', 'Safety Timer needs at least one trusted contact.');
      return;
    }
    triggeredRef.current = false;
    setRemainingSeconds(selectedSeconds);
    setTimerActive(true);
  };

  const markSafe = () => {
    triggeredRef.current = false;
    setTimerActive(false);
    setRemainingSeconds(selectedSeconds);
    Alert.alert('Timer stopped', 'Your safety timer was cancelled.');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <PageHeader
            eyebrow="Auto SOS"
            title="Safety Timer"
            subtitle="Start a countdown when you are travelling alone. If you do not confirm you are safe, SOS sends automatically."
            right={<GhostButton title="Reload" onPress={load} />}
          />
        </FadeInView>

        <FadeInView delay={80} style={styles.timerPanel}>
          <GlowOrb
            color={timerActive ? colors.danger : colors.primary}
            size={320}
            intensity={timerActive ? 0.4 : 0.3}
            style={styles.heroGlow}
          />
          <StatusBadge
            label={sosLoading ? 'Sending SOS' : timerActive ? 'Active' : 'Ready'}
            tone={sosLoading ? 'danger' : timerActive ? 'warning' : 'primary'}
            style={styles.heroBadge}
          />
          <Text style={[styles.timerText, timerActive && styles.timerTextActive]}>{formatTime(remainingSeconds)}</Text>
          <Text style={styles.statusText}>
            {sosLoading ? 'Sending Auto SOS...' : timerActive ? 'Timer active' : 'Ready'}
          </Text>
          {(loading || sosLoading) && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
        </FadeInView>

        <FadeInView delay={140} style={styles.options}>
          {TIMER_OPTIONS.map(option => {
            const active = selectedSeconds === option.seconds;
            return (
              <View key={option.seconds} style={styles.optionWrap}>
                <AnimatedPressable
                  disabled={timerActive || sosLoading}
                  style={[
                    styles.option,
                    active && styles.optionActive,
                    (timerActive || sosLoading) && styles.optionDisabled,
                  ]}
                  pressedStyle={styles.optionPressed}
                  onPress={() => selectTimer(option.seconds)}>
                  <Text numberOfLines={1} style={[styles.optionNum, active && styles.optionTextActive]}>
                    {Math.round(option.seconds / 60)}
                  </Text>
                  <Text numberOfLines={1} style={[styles.optionUnit, active && styles.optionUnitActive]}>
                    MIN
                  </Text>
                </AnimatedPressable>
              </View>
            );
          })}
        </FadeInView>

        <FadeInView delay={200} style={styles.actions}>
          {timerActive ? (
            <PrimaryButton title="I'm Safe" tone="success" onPress={markSafe} disabled={sosLoading} />
          ) : (
            <PrimaryButton title="Start Safety Timer" onPress={startTimer} loading={sosLoading} disabled={loading} />
          )}
          <GhostButton title="Send SOS Now" tone="danger" onPress={triggerAutoSOS} style={styles.manualButton} />
        </FadeInView>

        <FadeInView delay={260}>
          <PremiumCard style={styles.card}>
            <Text style={styles.sectionTitle}>What will happen</Text>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Contacts</Text>
              <Text style={styles.rowText}>{contacts.length} trusted contact(s) will receive SMS.</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Location</Text>
              <Text style={styles.rowText}>The app sends your live tracking link or last available map location.</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Evidence</Text>
              <Text style={styles.rowText}>The app tries to capture an automatic evidence photo before sending.</Text>
            </View>
          </PremiumCard>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingTop: layout.screenTop, paddingBottom: 38 },
  timerPanel: {
    minHeight: 236,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    overflow: 'hidden',
    ...shadow,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
  },
  heroBadge: { marginBottom: spacing.md },
  timerText: {
    color: colors.ink,
    fontSize: 60,
    fontFamily: font.black,
    letterSpacing: tracking.tight,
  },
  timerTextActive: { color: colors.danger },
  statusText: {
    color: colors.muted,
    fontSize: type.body,
    fontFamily: font.regular,
    marginTop: spacing.sm,
  },
  spinner: { marginTop: spacing.md },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  optionWrap: {
    width: '48.5%',
    marginBottom: spacing.md,
  },
  option: {
    width: '100%',
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...glow(colors.primary, 0.35),
  },
  optionPressed: { opacity: 0.9 },
  optionDisabled: { opacity: 0.62 },
  optionNum: {
    color: colors.ink,
    fontFamily: font.black,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: tracking.tight,
  },
  optionUnit: {
    color: colors.muted,
    fontFamily: font.black,
    fontSize: type.micro,
    letterSpacing: tracking.widest,
    marginTop: 3,
  },
  optionTextActive: { color: '#fff' },
  optionUnitActive: { color: 'rgba(255,255,255,0.85)' },
  actions: { marginTop: spacing.lg },
  manualButton: { marginTop: spacing.sm },
  card: { marginTop: spacing.lg },
  sectionTitle: { color: colors.ink, fontSize: type.subhead, fontFamily: font.black, letterSpacing: tracking.snug, marginBottom: spacing.sm },
  row: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug },
  rowText: { color: colors.muted, fontFamily: font.regular, lineHeight: 20, marginTop: 4 },
});
