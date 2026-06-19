import React, { useState } from 'react';
import { Alert, Linking, NativeModules, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { FadeInView, Field, GlowOrb, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { colors, font, glow, layout, radius, riskScale, shadow, spacing, tracking } from '../theme';

const { SafetySpeech } = NativeModules;

async function currentLocation() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Location permission denied');
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export default function SafeRouteScreen() {
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const resolveDestination = async text => {
    const trimmed = text.trim();
    const coordinateMatch = trimmed.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
    if (coordinateMatch) {
      return {
        latitude: Number(coordinateMatch[1]),
        longitude: Number(coordinateMatch[3]),
        label: trimmed,
      };
    }

    const res = await api.geocodePlace(trimmed);
    return {
      latitude: Number(res.data.latitude),
      longitude: Number(res.data.longitude),
      label: res.data.label || trimmed,
    };
  };

  const analyze = async () => {
    if (!destination.trim()) {
      Alert.alert('Destination required', 'Enter a destination place name.');
      return;
    }

    setLoading(true);
    try {
      const start = await currentLocation();
      const end = await resolveDestination(destination);
      const res = await api.analyzeRoute({
        start_lat: start.latitude,
        start_lng: start.longitude,
        end_lat: end.latitude,
        end_lng: end.longitude,
        time: 'now',
      });
      setResult({ ...res.data, destinationLabel: end.label });
    } catch (error) {
      Alert.alert('Analysis failed', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  };

  const routePoints = result?.route?.points || [];
  const routeOptions = result?.route_options || [];
  const routeWarnings = result?.route_warnings || [];
  const nearbyReports = result?.community_reports_near_route || [];
  const nearbyDangerZones = result?.danger_zones_near_route || [];
  const riskScore = Number(result?.risk_score ?? 50);
  const routeScale = riskScale(riskScore);
  const routeColor = routeScale.color;
  const safetyLabel = routeScale.zone;
  // A "high"/"medium" severity string stands in for a numeric score so reports
  // that carry only a severity word still land on the right zone via riskScale.
  const reportScore = report => {
    const severity = String(report.severity || '').toLowerCase();
    if (severity.includes('high')) return 80;
    if (severity.includes('medium')) return 50;
    return Number(report.risk_score || 0);
  };
  const reportColor = report => riskScale(reportScore(report)).color;
  const reportZoneLabel = report => riskScale(reportScore(report)).zone;
  const mapRegion = routePoints.length
    ? {
        latitude: (routePoints[0].latitude + routePoints[routePoints.length - 1].latitude) / 2,
        longitude: (routePoints[0].longitude + routePoints[routePoints.length - 1].longitude) / 2,
        latitudeDelta: Math.max(Math.abs(routePoints[0].latitude - routePoints[routePoints.length - 1].latitude) * 1.8, 0.02),
        longitudeDelta: Math.max(Math.abs(routePoints[0].longitude - routePoints[routePoints.length - 1].longitude) * 1.8, 0.02),
      }
    : { latitude: 17.385, longitude: 78.4867, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  const buildRouteSpeech = () => {
    const destinationLabel = result?.destinationLabel || 'your destination';
    const base = [
      `Safest route selected to ${destinationLabel}.`,
      `Safety level is ${safetyLabel}.`,
      `Risk score is ${riskScore} out of 100.`,
    ];

    if (routeWarnings.length) {
      base.push(routeWarnings.slice(0, 3).join(' '));
    } else if (riskScore >= 40) {
      base.push('Use caution on this route. Keep live tracking active and avoid isolated shortcuts.');
    } else {
      base.push('No red zone warning on the recommended route. Stay alert while travelling.');
    }

    base.push('Opening map navigation now.');
    return base.join(' ');
  };

  const startVoiceNavigation = async () => {
    const destinationPoint = result?.destination || routePoints[routePoints.length - 1];
    if (!destinationPoint) {
      Alert.alert('Navigation unavailable', 'Analyze a destination first.');
      return;
    }
    const url = `google.navigation:q=${destinationPoint.latitude},${destinationPoint.longitude}&mode=w`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationPoint.latitude},${destinationPoint.longitude}&travelmode=walking`;
    try {
      await SafetySpeech?.speak(buildRouteSpeech());
    } catch (error) {
      Alert.alert('Voice unavailable', error.message || 'Unable to speak route guidance. Opening maps.');
    }
    setTimeout(() => {
      Linking.openURL(url).catch(() => Linking.openURL(webUrl));
    }, 2600);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView>
          <PageHeader
            eyebrow="Route Intelligence"
            title="Safe Route"
            subtitle="Enter a destination place. The app converts it to coordinates and analyzes route safety."
          />
        </FadeInView>

        <FadeInView delay={80}>
        <PremiumCard style={styles.form}>
          <Text style={styles.label}>Destination Place</Text>
          <Field
            placeholder="Example: Charminar Hyderabad"
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={analyze}
          />
          <PrimaryButton title="Analyze Route" icon="search" onPress={analyze} loading={loading} />
        </PremiumCard>
        </FadeInView>

        {result && (
          <FadeInView delay={160} style={styles.resultWrap}>
            <GlowOrb color={routeColor} size={300} intensity={0.34} style={styles.resultGlow} />
            <PremiumCard style={styles.result}>
            <View style={styles.mapWrap}>
              <MapView style={styles.map} region={mapRegion}>
                {routePoints.length > 0 && <Marker coordinate={routePoints[0]} title="Start" />}
                {routePoints.length > 1 && <Marker coordinate={routePoints[routePoints.length - 1]} title={result.destinationLabel || 'Destination'} />}
                {nearbyReports.map(report => (
                  <React.Fragment key={`report-zone-${report.id}`}>
                    <Circle
                      center={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
                      radius={Math.max(120, Math.min(Number(report.distance_meters || 250), 450))}
                      strokeColor={reportColor(report)}
                      fillColor={`${reportColor(report)}33`}
                      strokeWidth={2}
                    />
                    <Marker
                      coordinate={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
                      title={`${reportZoneLabel(report)} - ${report.type}`}
                      description={`${report.location} (${report.distance_meters}m from route)`}
                    >
                      <View style={[styles.reportMarker, { backgroundColor: reportColor(report) }]}>
                        <Text style={styles.reportMarkerText}>!</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                ))}
                {nearbyDangerZones.map(zone => (
                  <React.Fragment key={`danger-zone-${zone.id}`}>
                    <Circle
                      center={{ latitude: Number(zone.latitude), longitude: Number(zone.longitude) }}
                      radius={Math.max(120, Number(zone.radius_meters || 250))}
                      strokeColor={colors.danger}
                      fillColor={`${colors.danger}33`}
                      strokeWidth={2}
                    />
                    <Marker
                      coordinate={{ latitude: Number(zone.latitude), longitude: Number(zone.longitude) }}
                      title={`Red Zone - ${zone.name}`}
                      description={`${zone.distance_meters}m from route`}
                    >
                      <View style={[styles.reportMarker, { backgroundColor: colors.danger }]}>
                        <Text style={styles.reportMarkerText}>R</Text>
                      </View>
                    </Marker>
                  </React.Fragment>
                ))}
                {routeOptions
                  .filter(option => option.id !== result.route?.id && option.points?.length > 1)
                  .map(option => (
                    <Polyline
                      key={option.id}
                      coordinates={option.points}
                      strokeColor={colors.muted}
                      strokeWidth={3}
                      lineDashPattern={[8, 8]}
                    />
                  ))}
                {routePoints.length > 1 && <Polyline coordinates={routePoints} strokeColor={routeColor} strokeWidth={6} />}
              </MapView>
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Safe</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.warning }]} /><Text style={styles.legendText}>Caution</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.danger }]} /><Text style={styles.legendText}>Risk</Text></View>
              </View>
            </View>
            <FadeInView delay={220}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: routeColor }, glow(routeColor, 0.4)]}>
                  <Text style={styles.badgeText}>Safest Route - {safetyLabel}</Text>
                </View>
                <StatusBadge label={`${riskScore}/100`} tone={routeScale.tone} />
              </View>
              <Text style={styles.score}>{result.safety_level || 'Moderate'} Safety</Text>
              {!!routeOptions.length && (
                <Text style={styles.destination}>
                  Compared {routeOptions.length} route option(s). Recommended path has the lowest route risk.
                </Text>
              )}
              {!!result.destinationLabel && <Text style={styles.destination}>{result.destinationLabel}</Text>}
              {!!result.route?.distance && <Text style={styles.destination}>{result.route.distance} - {result.route.duration || 'Duration unavailable'}</Text>}
              <Text style={styles.risk}>Risk score: {result.risk_score ?? 'N/A'}/100</Text>
              <Text style={styles.community}>
                Community report score: {result.community_report_score ?? 0}/100
              </Text>
              <Text style={styles.community}>
                Danger zone score: {result.danger_zone_score ?? 0}/100
              </Text>
            </FadeInView>
            <FadeInView delay={300}>
            {routeWarnings.map(warning => (
              <View key={warning} style={styles.warningBox}>
                <Text style={styles.warningTitle}>Route Warning</Text>
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
            {!!result.community_report_summary && <Text style={styles.body}>{result.community_report_summary}</Text>}
            {!!result.danger_zone_summary && <Text style={styles.body}>{result.danger_zone_summary}</Text>}
            <Text style={styles.body}>{result.explanation || 'No explanation returned.'}</Text>
            {routeOptions.length > 1 && (
              <View style={styles.optionsPanel}>
                <Text style={styles.optionsTitle}>Route comparison</Text>
                {routeOptions.map(option => {
                  const optionColor = riskScale(option.risk_score).color;
                  return (
                    <View key={`option-${option.id}`} style={styles.optionRow}>
                      <View style={[styles.optionDot, { backgroundColor: optionColor }]} />
                      <View style={styles.optionBody}>
                        <Text style={styles.optionTitle}>
                          {option.recommendation_label}: {option.summary || option.id}
                        </Text>
                        <Text style={styles.optionText}>
                          Risk {option.risk_score}/100{option.distance ? ` - ${option.distance}` : ''}{option.duration ? ` - ${option.duration}` : ''} - {option.source === 'generated' ? 'AI generated candidate' : 'Google route'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {nearbyReports.map(report => (
              <View key={`nearby-${report.id}`} style={styles.reportRow}>
                <View style={styles.reportTitleRow}>
                  <View style={[styles.reportTitleDot, { backgroundColor: reportColor(report) }]} />
                  <Text style={styles.reportTitle}>{reportZoneLabel(report)} - {report.type}</Text>
                </View>
                <Text style={styles.reportText}>{report.location} - {report.distance_meters}m from route</Text>
              </View>
            ))}
            {nearbyDangerZones.map(zone => (
              <View key={`nearby-zone-${zone.id}`} style={styles.reportRow}>
                <View style={styles.reportTitleRow}>
                  <View style={[styles.reportTitleDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.reportTitle}>Red Zone - {zone.name}</Text>
                </View>
                <Text style={styles.reportText}>{zone.distance_meters}m from route - score {zone.risk_score}/100</Text>
              </View>
            ))}
            {(result.suggestions || []).map((item, index) => (
              <Text key={`${item}-${index}`} style={styles.suggestion}>- {item}</Text>
            ))}
            <PrimaryButton title="Start Voice Navigation" icon="navigate" onPress={startVoiceNavigation} style={styles.navButton} />
            </FadeInView>
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
  form: { gap: spacing.sm },
  label: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug, marginBottom: spacing.xs },
  resultWrap: { marginTop: spacing.lg },
  resultGlow: { position: 'absolute', top: -70, alignSelf: 'center' },
  result: { ...shadow },
  mapWrap: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  map: { flex: 1 },
  mapLegend: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 9 },
  legendText: { color: colors.ink, fontFamily: font.bold, fontSize: 11, letterSpacing: tracking.snug },
  reportMarker: {
    width: 28,
    height: 28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  reportMarkerText: { color: '#fff', fontFamily: font.bold, fontSize: 15 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  badgeText: { color: '#fff', fontFamily: font.bold, fontSize: 13, letterSpacing: tracking.snug },
  score: { color: colors.ink, fontFamily: font.bold, fontSize: 20, letterSpacing: tracking.snug },
  destination: { color: colors.muted, fontFamily: font.regular, marginTop: 6, lineHeight: 20 },
  risk: { color: colors.primary, fontFamily: font.bold, marginTop: 8 },
  community: { color: colors.danger, fontFamily: font.bold, marginTop: 6 },
  warningBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(255,45,85,0.22)',
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 12,
    padding: spacing.md,
  },
  warningTitle: { color: colors.danger, fontFamily: font.bold, letterSpacing: tracking.snug },
  warningText: { color: colors.ink, fontFamily: font.regular, lineHeight: 21, marginTop: 4 },
  body: { color: colors.text, fontFamily: font.regular, lineHeight: 21, marginTop: 12 },
  optionsPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  optionsTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug, marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  optionDot: { width: 11, height: 11, borderRadius: 11, marginTop: 4 },
  optionBody: { flex: 1 },
  optionTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug },
  optionText: { color: colors.muted, fontFamily: font.regular, lineHeight: 19, marginTop: 2 },
  reportRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 },
  reportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportTitleDot: { width: 10, height: 10, borderRadius: 10 },
  reportTitle: { color: colors.ink, fontFamily: font.bold, letterSpacing: tracking.snug, flex: 1 },
  reportText: { color: colors.muted, fontFamily: font.regular, marginTop: 3, lineHeight: 19 },
  suggestion: { color: colors.ink, fontFamily: font.regular, marginTop: 8, lineHeight: 20 },
  navButton: { marginTop: spacing.lg },
});
