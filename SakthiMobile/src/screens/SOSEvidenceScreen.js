import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AnimatedPressable, EmptyState, FadeInView, GhostButton, IconMark, PageHeader, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { API_BASE_URL } from '../config/api';
import { colors, font, glow, layout, radius, spacing, tracking, type } from '../theme';

function asList(data) {
  return data?.results || data || [];
}

function formatDate(value) {
  if (!value) {
    return 'Unknown time';
  }
  return new Date(value).toLocaleString();
}

function mediaUrl(value) {
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const apiRoot = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${apiRoot}${value.startsWith('/') ? value : `/${value}`}`;
}

export default function SOSEvidenceScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.sosAlerts();
      setAlerts(asList(response.data));
    } catch (error) {
      Alert.alert('SOS evidence error', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = alert => {
    Alert.alert(
      'Delete SOS evidence?',
      'This removes the saved photo/audio from the backend. The SOS alert record stays in history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEvidence(alert.id),
        },
      ],
    );
  };

  const deleteEvidence = async id => {
    setDeletingId(id);
    try {
      await api.deleteSosEvidence(id);
      setAlerts(current => current.map(item => (
        item.id === id ? { ...item, image: null, audio: null } : item
      )));
    } catch (error) {
      Alert.alert('Delete failed', error.response?.data?.detail || error.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <FadeInView>
          <PageHeader
            eyebrow="Manual cleanup"
            title="SOS Evidence"
            subtitle="Review saved SOS records and delete evidence only when you choose."
          />
        </FadeInView>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Saved alerts</Text>
          {alerts.length ? <StatusBadge label={`${alerts.length} Saved`} tone="primary" dot={false} /> : null}
        </View>

        {!alerts.length && !loading ? (
          <EmptyState icon="camera" title="No SOS evidence" text="SOS photos and audio will appear here after alerts are sent." />
        ) : null}

        {alerts.map((alert, index) => {
          const hasMedia = Boolean(alert.image || alert.audio);
          const imageUrl = mediaUrl(alert.image);
          return (
            <FadeInView key={alert.id} delay={80 + index * 35}>
              <AnimatedPressable style={[styles.item, glow(colors.danger, 0.12)]} pressedStyle={styles.itemPressed}>
                <View style={styles.itemHead}>
                  <IconMark name="camera" tone="danger" size={44} />
                  <View style={styles.itemHeadText}>
                    <Text style={styles.itemTitle}>SOS #{alert.id}</Text>
                    <Text style={styles.itemText}>{formatDate(alert.timestamp)}</Text>
                  </View>
                  <StatusBadge label={alert.status || 'saved'} tone={alert.is_active ? 'danger' : 'primary'} dot={alert.is_active} />
                </View>

                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" />
                ) : null}

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{hasMedia ? 'Evidence file saved' : 'No media attached'}</Text>
                  {alert.latitude != null && alert.longitude != null ? (
                    <Text style={styles.metaText}>{Number(alert.latitude).toFixed(5)}, {Number(alert.longitude).toFixed(5)}</Text>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  {imageUrl ? (
                    <GhostButton title="Open Photo" icon="camera" onPress={() => Linking.openURL(imageUrl)} style={styles.actionButton} />
                  ) : null}
                  <GhostButton
                    title={hasMedia ? (deletingId === alert.id ? 'Deleting' : 'Delete Evidence') : 'No Evidence'}
                    icon="trash"
                    tone="danger"
                    onPress={() => confirmDelete(alert)}
                    disabled={!hasMedia || deletingId === alert.id}
                    style={styles.actionButton}
                  />
                </View>
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  section: { color: colors.ink, fontSize: type.heading, fontFamily: font.bold, letterSpacing: tracking.snug },
  item: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.md },
  itemPressed: { opacity: 0.94 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemHeadText: { flex: 1 },
  itemTitle: { color: colors.ink, fontFamily: font.bold, fontSize: type.subhead, letterSpacing: tracking.snug },
  itemText: { color: colors.muted, fontFamily: font.regular, marginTop: 3 },
  preview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.surfaceSoft, marginTop: spacing.md },
  metaRow: { gap: 4, marginTop: spacing.md },
  metaText: { color: colors.muted, fontFamily: font.regular, fontSize: type.caption, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flexGrow: 1 },
});
