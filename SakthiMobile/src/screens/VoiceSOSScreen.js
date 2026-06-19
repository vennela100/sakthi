import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  NativeEventEmitter,
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
import { FadeInView, GhostButton, GlowOrb, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import Icon from '../components/Icon';
import { api } from '../services/ApiService';
import { cacheEmergencyContacts, sendOfflineCapableSOS } from '../services/OfflineSOSService';
import { colors, font, glow, layout, radius, shadow, spacing, tracking, type } from '../theme';

const { RiskCamera, VoiceRecognition } = NativeModules;
const voiceEvents = VoiceRecognition ? new NativeEventEmitter(VoiceRecognition) : null;

const SAFE_PHRASES = ['help me', 'sakthi help', 'emergency'];

function requestPermission(permission) {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(permission).then(result => result === PermissionsAndroid.RESULTS.GRANTED);
}

async function requestVoicePermissions() {
  const audioOk = await requestPermission(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  const locationOk = await requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  const smsOk = await requestPermission(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  return { audioOk, locationOk, smsOk };
}

async function requestCameraPermission() {
  return requestPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
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

function findMatchedPhrase(text) {
  const normalized = String(text || '').toLowerCase();
  return SAFE_PHRASES.find(phrase => normalized.includes(phrase));
}

export default function VoiceSOSScreen() {
  const [contacts, setContacts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [detectedText, setDetectedText] = useState('');
  const [matchedPhrase, setMatchedPhrase] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Idle');
  const [voiceError, setVoiceError] = useState('');
  const triggeredRef = useRef(false);
  const listeningRef = useRef(false);
  const restartingRef = useRef(false);

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

  const stopListening = useCallback(async () => {
    listeningRef.current = false;
    restartingRef.current = false;
    setListening(false);
    setVoiceStatus('Stopped');
    try {
      await VoiceRecognition?.stop();
    } catch (_) {
      // Voice may already be stopped.
    }
  }, []);

  const triggerVoiceSOS = useCallback(
    async phrase => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      setMatchedPhrase(phrase);
      setSosLoading(true);
      await stopListening();

      try {
        const { locationOk, smsOk } = await requestVoicePermissions();
        const phoneList = contacts.map(c => c.phone_number).filter(Boolean);

        if (!phoneList.length) {
          Alert.alert('Voice SOS blocked', 'No trusted contacts are saved.');
          return;
        }
        if (!smsOk) {
          Alert.alert('Voice SOS blocked', 'SMS permission is required to message your contacts.');
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
          title: `Voice SOS triggered after detecting: "${phrase}".`,
          imageName: 'voice_sos_evidence.jpg',
        });

        Alert.alert(
          sosResult.offline ? 'Offline Voice SOS sent' : 'Voice SOS sent',
          `${sosResult.sentCount}/${sosResult.totalCount} contacts messaged.${sosResult.firstFailure ? `\nIssue: ${sosResult.firstFailure}` : ''}${sosResult.backendIssue ? `\nBackend issue: ${sosResult.backendIssue}` : ''}\nTracking: ${sosResult.displayLink}`,
          [{ text: 'Call 112', onPress: () => Linking.openURL('tel:112') }, { text: 'OK' }],
        );
      } catch (error) {
        Alert.alert('Voice SOS failed', error.response?.data?.detail || error.message);
      } finally {
        triggeredRef.current = false;
        setSosLoading(false);
      }
    },
    [contacts, profile, stopListening],
  );

  useEffect(() => {
    const subscriptions = [];

    // Single, debounced restart path. VoiceEnd and VoiceError can both fire for
    // one utterance; without this guard they each call start() and the
    // overlapping calls produce ERROR_CLIENT. We allow only one restart in
    // flight and give the native recognizer time to fully tear down first.
    let restartTimer = null;
    const scheduleRestart = () => {
      if (!listeningRef.current || triggeredRef.current || restartingRef.current) return;
      restartingRef.current = true;
      setVoiceStatus('Restarting listener');
      restartTimer = setTimeout(() => {
        restartingRef.current = false;
        if (!listeningRef.current || triggeredRef.current) return;
        VoiceRecognition?.start('en-US').catch(error => {
          setVoiceError(error.message || 'Speech recognition could not restart.');
          setListening(false);
        });
      }, 500);
    };

    subscriptions.push(voiceEvents?.addListener('VoiceResults', event => {
      const transcript = (event.value || []).join(' ');
      setDetectedText(transcript);
      setVoiceStatus('Heard speech');
      setVoiceError('');
      const phrase = findMatchedPhrase(transcript);
      if (phrase) {
        triggerVoiceSOS(phrase);
      }
    }));

    subscriptions.push(voiceEvents?.addListener('VoicePartialResults', event => {
      const transcript = (event.value || []).join(' ');
      setDetectedText(transcript);
      setVoiceStatus('Hearing speech');
      setVoiceError('');
      const phrase = findMatchedPhrase(transcript);
      if (phrase) {
        triggerVoiceSOS(phrase);
      }
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceEnd', () => {
      scheduleRestart();
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceError', event => {
      // ERROR_CLIENT / no-match / timeout during continuous listening are
      // expected between utterances — surface the message but just restart once.
      setVoiceError(event.message || 'Speech recognition error.');
      scheduleRestart();
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceStatus', event => {
      setVoiceStatus(event.status || 'Listening');
    }));

    return () => {
      if (restartTimer) clearTimeout(restartTimer);
      restartingRef.current = false;
      subscriptions.forEach(subscription => subscription?.remove());
      VoiceRecognition?.destroy().catch(() => {});
    };
  }, [triggerVoiceSOS]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        listeningRef.current = false;
        VoiceRecognition?.stop().catch(() => {});
      };
    }, [load]),
  );

  const startListening = async () => {
    if (!VoiceRecognition) {
      Alert.alert('Voice unavailable', 'Voice recognition is not available in this build.');
      return;
    }

    const { audioOk } = await requestVoicePermissions();
    if (!audioOk) {
      Alert.alert('Microphone required', 'Allow microphone permission to use Voice SOS.');
      return;
    }
    if (!contacts.length) {
      Alert.alert('Add contacts first', 'Voice SOS needs at least one trusted contact.');
      return;
    }

    try {
      setDetectedText('');
      setMatchedPhrase('');
      setVoiceError('');
      setVoiceStatus('Starting');
      restartingRef.current = false;
      listeningRef.current = true;
      setListening(true);
      await VoiceRecognition.start('en-US');
      setVoiceStatus('Listening');
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setVoiceError(error.message || 'Speech recognition could not start.');
      setVoiceStatus('Start failed');
      Alert.alert('Voice unavailable', error.message || 'Speech recognition could not start.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <PageHeader
            eyebrow="Hands-free SOS"
            title="Voice SOS"
            subtitle="Keep this screen open and say a trigger phrase. The app will send SOS when it detects your phrase."
            right={<GhostButton title="Reload" onPress={load} />}
          />
        </FadeInView>

        <FadeInView delay={80} style={styles.listenPanel}>
          <GlowOrb
            color={listening ? colors.danger : colors.primary}
            size={300}
            intensity={listening ? 0.55 : 0.32}
            style={styles.heroGlow}
          />
          <View style={styles.micHalo}>
            <View style={[styles.micCircle, listening && styles.micCircleActive]}>
              {sosLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Icon name="voice" size={52} color="#fff" strokeWidth={1.8} />
              )}
            </View>
          </View>
          <StatusBadge
            label={sosLoading ? 'Sending SOS' : listening ? 'Listening' : 'Standby'}
            tone={sosLoading || listening ? 'danger' : 'primary'}
            style={styles.heroBadge}
          />
          <Text style={styles.statusText}>
            {sosLoading ? 'Sending Voice SOS...' : listening ? 'Listening for trigger phrases' : 'Not listening'}
          </Text>
          <Text style={styles.debugText}>Status: {voiceStatus}</Text>
          {!!voiceError && <Text style={styles.errorText}>{voiceError}</Text>}
        </FadeInView>

        <FadeInView delay={140} style={styles.actions}>
          {listening ? (
            <PrimaryButton title="Stop Listening" tone="dark" onPress={stopListening} disabled={sosLoading} />
          ) : (
            <PrimaryButton title="Start Listening" onPress={startListening} loading={sosLoading} disabled={loading} />
          )}
          <GhostButton title="Send SOS Now" tone="danger" onPress={() => triggerVoiceSOS('manual voice sos')} style={styles.manualButton} />
        </FadeInView>

        <FadeInView delay={200}>
          <PremiumCard style={styles.card}>
            <Text style={styles.sectionTitle}>Trigger phrases</Text>
            <View style={styles.phraseGrid}>
              {SAFE_PHRASES.map(phrase => (
                <View key={phrase} style={styles.phraseChip}>
                  <Text style={styles.phraseText}>{phrase}</Text>
                </View>
              ))}
            </View>
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={260}>
          <PremiumCard style={styles.card}>
            <Text style={styles.sectionTitle}>Detected speech</Text>
            <Text style={styles.detectedText}>{detectedText || 'Nothing detected yet.'}</Text>
            {!!matchedPhrase && <Text style={styles.matchText}>Matched: {matchedPhrase}</Text>}
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={320}>
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
              <Text style={styles.rowTitle}>Limit</Text>
              <Text style={styles.rowText}>Voice detection works while this screen is open.</Text>
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
  listenPanel: {
    minHeight: 252,
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
    top: -40,
    alignSelf: 'center',
  },
  micHalo: {
    width: 156,
    height: 156,
    borderRadius: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  micCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: colors.surface,
    ...glow(colors.primary, 0.4),
  },
  micCircleActive: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerSoft,
    ...glow(colors.danger, 0.55),
  },
  heroBadge: { marginTop: spacing.lg, alignSelf: 'center' },
  statusText: {
    color: colors.muted,
    fontSize: type.body,
    fontFamily: font.regular,
    marginTop: spacing.md,
  },
  debugText: {
    color: colors.muted,
    fontSize: type.caption,
    fontFamily: font.regular,
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.caption,
    fontFamily: font.regular,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  actions: { marginTop: spacing.lg },
  manualButton: { marginTop: spacing.sm },
  card: { marginTop: spacing.lg },
  sectionTitle: { color: colors.ink, fontSize: type.subhead, fontFamily: font.black, letterSpacing: tracking.snug, marginBottom: spacing.sm },
  phraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phraseChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  phraseText: { color: colors.ink, fontFamily: font.bold, fontSize: type.caption, letterSpacing: tracking.snug },
  detectedText: {
    color: colors.text,
    fontFamily: font.regular,
    lineHeight: 22,
  },
  matchText: {
    color: colors.danger,
    fontFamily: font.bold,
    marginTop: spacing.sm,
  },
  row: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  rowTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug },
  rowText: { color: colors.muted, fontFamily: font.regular, lineHeight: 20, marginTop: 4 },
});
