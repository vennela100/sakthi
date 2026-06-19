import React, { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import { AnimatedPressable, EmptyState, FadeInView, Field, GhostButton, IconMark, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { colors, font, glow, layout, radius, spacing, tracking, type } from '../theme';

const severityTone = sev =>
  String(sev || '').toLowerCase().includes('high')
    ? 'danger'
    : String(sev || '').toLowerCase().includes('low')
      ? 'success'
      : 'warning';

const types = [
  ['harassment', 'Harassment'],
  ['suspicious_activity', 'Suspicious Activity'],
  ['dark_area', 'Dark Area'],
];
const severities = ['low', 'medium', 'high'];

async function getGPS() {
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

export default function ReportsScreen() {
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState('suspicious_activity');
  const [severity, setSeverity] = useState('medium');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reports();
      setReports(res.data.results || res.data);
    } catch (error) {
      Alert.alert('Reports error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const useLocation = async () => {
    const gps = await getGPS();
    if (!gps) {
      Alert.alert('Location unavailable', 'Enter the location manually.');
      return;
    }
    setCoords(gps);
    setLocation(`${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`);
  };

  const submit = async () => {
    if (!location.trim()) {
      Alert.alert('Location required', 'Add a location or use GPS.');
      return;
    }
    await api.createReport({
      report_type: reportType,
      severity,
      location: location.trim(),
      description,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    });
    setDescription('');
    setLocation('');
    setCoords(null);
    load();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <FadeInView>
          <PageHeader
            eyebrow="Community Safety"
            title="Reports"
            subtitle="Submit and review neighborhood alerts from the same web app data."
          />
        </FadeInView>

        <FadeInView delay={80}>
        <PremiumCard style={styles.form}>
          <Text style={styles.label}>Issue Type</Text>
          <View style={styles.segment}>
            {types.map(([value, label]) => {
              const selected = reportType === value;
              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.85}
                  style={[styles.segmentBtn, selected && styles.active, selected && glow(colors.primary, 0.3)]}
                  onPress={() => setReportType(value)}>
                  <Text style={[styles.segmentText, selected && styles.activeText]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.segment}>
            {severities.map(value => {
              const selected = severity === value;
              const isHigh = value === 'high';
              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.85}
                  style={[
                    styles.segmentBtn,
                    selected && (isHigh ? styles.activeDanger : styles.active),
                    selected && glow(isHigh ? colors.danger : colors.primary, 0.3),
                  ]}
                  onPress={() => setSeverity(value)}>
                  <Text style={[styles.segmentText, selected && styles.activeText]}>{value.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Field placeholder="Location" value={location} onChangeText={setLocation} />
          <GhostButton title="Use My Location" icon="pin" onPress={useLocation} />
          <Field placeholder="Description" value={description} onChangeText={setDescription} multiline />
          <PrimaryButton title="Submit Report" icon="send" onPress={submit} />
        </PremiumCard>
        </FadeInView>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Community Alerts</Text>
          {reports.length ? <StatusBadge label={`${reports.length} Reports`} tone="primary" dot={false} /> : null}
        </View>

        {!reports.length && !loading ? <EmptyState icon="report" title="No reports yet" text="When community reports are created, they will show here." /> : null}
        {reports.map((report, index) => {
          const tone = severityTone(report.severity);
          return (
            <FadeInView key={report.id} delay={120 + index * 45}>
              <AnimatedPressable style={[styles.item, glow(colors[tone] || colors.primary, 0.14)]} pressedStyle={styles.itemPressed}>
                <View style={styles.itemHead}>
                  <IconMark name="report" tone={tone} size={44} />
                  <View style={styles.itemHeadText}>
                    <Text style={styles.itemTitle}>{report.report_type_display || report.report_type}</Text>
                    <Text style={styles.itemText}>{report.location}</Text>
                  </View>
                  <StatusBadge label={report.severity_display || report.severity} tone={tone} dot={false} />
                </View>
                {!!report.description && <Text style={styles.desc}>{report.description}</Text>}
              </AnimatedPressable>
            </FadeInView>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.screenX, paddingTop: layout.screenTop, paddingBottom: layout.screenBottom },
  form: { gap: spacing.sm, marginBottom: spacing.lg },
  label: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug, marginTop: spacing.xs },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  segmentBtn: { paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  activeDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  segmentText: { color: colors.text, fontFamily: font.bold, fontSize: type.caption, letterSpacing: tracking.snug },
  activeText: { color: '#fff' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  section: { color: colors.ink, fontSize: type.heading, fontFamily: font.bold, letterSpacing: tracking.snug },
  item: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.sm },
  itemPressed: { opacity: 0.94 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemHeadText: { flex: 1 },
  itemTitle: { color: colors.ink, fontFamily: font.bold, fontSize: type.subhead, letterSpacing: tracking.snug },
  itemText: { color: colors.muted, fontFamily: font.regular, marginTop: 3 },
  desc: { color: colors.text, fontFamily: font.regular, marginTop: 10, lineHeight: 20 },
});
