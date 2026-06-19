import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { FadeInView, Field, GlowOrb, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import Icon from '../components/Icon';
import { api } from '../services/ApiService';
import { colors, font, layout, radius, spacing, tracking, type } from '../theme';

const { VoiceRecognition } = NativeModules;
const voiceEvents = VoiceRecognition ? new NativeEventEmitter(VoiceRecognition) : null;

function requestLocationPermission() {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(
    result => result === PermissionsAndroid.RESULTS.GRANTED,
  );
}

function requestAudioPermission() {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO).then(
    result => result === PermissionsAndroid.RESULTS.GRANTED,
  );
}

function getLocationOrNull() {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    );
  });
}

export default function AIAssistantScreen() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Tap Speak to ask by voice');
  const [voiceError, setVoiceError] = useState('');
  const [result, setResult] = useState(null);
  const listeningRef = useRef(false);

  const ask = useCallback(async promptText => {
    const text = (promptText || message).trim();
    if (!text) {
      Alert.alert('Ask something', 'Enter a safety question first.');
      return;
    }

    setLoading(true);
    try {
      const locationOk = await requestLocationPermission();
      const location = locationOk ? await getLocationOrNull() : null;
      const response = await api.askAI({
        message: text,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      });
      setResult(response.data);
      setMessage(text);
    } catch (error) {
      Alert.alert('AI unavailable', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const stopVoice = useCallback(async () => {
    listeningRef.current = false;
    setListening(false);
    setVoiceStatus('Voice stopped');
    try {
      await VoiceRecognition?.stop();
    } catch (_) {
      // Already stopped.
    }
  }, []);

  const startVoice = async () => {
    if (!VoiceRecognition) {
      Alert.alert('Voice unavailable', 'Voice recognition is not available in this build.');
      return;
    }

    const audioOk = await requestAudioPermission();
    if (!audioOk) {
      Alert.alert('Microphone required', 'Allow microphone permission to ask AI by voice.');
      return;
    }

    try {
      setVoiceError('');
      setVoiceStatus('Listening...');
      listeningRef.current = true;
      setListening(true);
      await VoiceRecognition.start('en-US');
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      setVoiceStatus('Voice start failed');
      setVoiceError(error.message || 'Speech recognition could not start.');
    }
  };

  useEffect(() => {
    const subscriptions = [];

    subscriptions.push(voiceEvents?.addListener('VoicePartialResults', event => {
      const transcript = (event.value || []).join(' ').trim();
      if (transcript) {
        setMessage(transcript);
        setVoiceStatus('Hearing your question');
      }
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceResults', event => {
      const transcript = (event.value || []).join(' ').trim();
      if (transcript) {
        setMessage(transcript);
        setVoiceStatus('Question captured');
        stopVoice();
        ask(transcript);
      }
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceError', event => {
      setVoiceError(event.message || 'Speech recognition error.');
      setVoiceStatus('Voice error');
      listeningRef.current = false;
      setListening(false);
    }));

    subscriptions.push(voiceEvents?.addListener('VoiceStatus', event => {
      setVoiceStatus(event.status || 'Listening');
    }));

    return () => {
      subscriptions.forEach(subscription => subscription?.remove());
      listeningRef.current = false;
      VoiceRecognition?.stop().catch(() => {});
    };
  }, [ask, stopVoice]);

  const riskTone =
    result?.risk_level === 'high'
      ? 'danger'
      : result?.risk_level === 'low'
        ? 'success'
        : 'warning';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <PageHeader
            eyebrow="AI Guidance"
            title="Safety Assistant"
            subtitle="Ask for practical safety advice using your current location and recent community reports."
          />
        </FadeInView>

        <FadeInView delay={80}>
          <PremiumCard style={styles.questionCard}>
            <GlowOrb color={colors.violet} size={260} intensity={0.26} style={styles.questionGlow} />
            <View style={styles.aiIdentity}>
              <View style={styles.aiMark}>
                <Icon name="ai" size={20} color={colors.violet} strokeWidth={1.9} />
              </View>
              <Text style={styles.label}>Your question</Text>
            </View>
            <Field
              value={message}
              onChangeText={setMessage}
              placeholder="Example: I am walking alone near a dark road..."
              multiline
              style={styles.question}
            />
            <View style={styles.actionRow}>
              <PrimaryButton
                title={listening ? 'Stop' : 'Speak'}
                icon="voice"
                tone={listening ? 'dark' : 'accent'}
                onPress={listening ? stopVoice : startVoice}
                disabled={loading}
                style={styles.actionBtn}
              />
              <PrimaryButton
                title="Ask AI"
                icon="send"
                onPress={() => ask()}
                loading={loading}
                style={styles.actionBtn}
              />
            </View>
            <Text style={styles.voiceStatus}>Voice: {voiceStatus}</Text>
            {!!voiceError && <Text style={styles.voiceError}>{voiceError}</Text>}
          </PremiumCard>
        </FadeInView>

        {result && (
          <FadeInView delay={120}>
            <PremiumCard style={styles.answerCard}>
              <View style={styles.answerHeader}>
                <Text style={styles.answerTitle}>AI Recommendation</Text>
                <StatusBadge label={String(result.risk_level || 'medium')} tone={riskTone} dot={false} />
              </View>
              <Text style={styles.answerText}>{result.answer}</Text>
              {result.use_sos_now && <Text style={styles.sosWarning}>Use SOS now if you feel unsafe.</Text>}
              <Text style={styles.actionsTitle}>Recommended actions</Text>
              {(result.recommended_actions || []).map(action => (
                <Text key={action} style={styles.actionItem}>- {action}</Text>
              ))}
              {!!result.context && (
                <Text style={styles.contextText}>
                  Context: {result.context.contacts_count} contact(s), {result.context.nearby_reports_count} nearby report(s)
                </Text>
              )}
            </PremiumCard>
          </FadeInView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingTop: layout.screenTop, paddingBottom: 38 },
  questionCard: { overflow: 'hidden' },
  questionGlow: { position: 'absolute', top: -90, right: -70 },
  aiIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  aiMark: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug },
  question: { minHeight: 112 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
  voiceStatus: { color: colors.muted, fontSize: type.caption, fontFamily: font.regular, marginTop: spacing.sm },
  voiceError: { color: colors.danger, fontSize: type.caption, fontFamily: font.regular, marginTop: spacing.xs },
  answerCard: { marginTop: spacing.lg },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  answerTitle: { color: colors.ink, fontSize: type.heading, fontFamily: font.black, letterSpacing: tracking.snug, flex: 1 },
  answerText: { color: colors.text, fontFamily: font.regular, lineHeight: 22, marginTop: spacing.md },
  sosWarning: { color: colors.danger, fontFamily: font.bold, marginTop: spacing.md },
  actionsTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug, marginTop: spacing.lg, marginBottom: spacing.xs },
  actionItem: { color: colors.text, fontFamily: font.regular, lineHeight: 22, marginTop: 4 },
  contextText: { color: colors.muted, fontSize: 12, fontFamily: font.regular, marginTop: spacing.lg },
});
