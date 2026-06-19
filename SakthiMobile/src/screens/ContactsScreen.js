import React, { useCallback, useState } from 'react';
import { Alert, Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AnimatedPressable, EmptyState, FadeInView, Field, GhostButton, PageHeader, PremiumCard, PrimaryButton, StatusBadge } from '../components/Premium';
import { api } from '../services/ApiService';
import { colors, font, glow, layout, radius, spacing, tracking, type } from '../theme';

export default function ContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.contacts();
      setContacts(res.data.results || res.data);
    } catch (error) {
      Alert.alert('Contacts error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing details', 'Enter contact name and phone number.');
      return;
    }
    await api.createContact({ contact_name: name.trim(), phone_number: phone.trim(), relationship: '' });
    setName('');
    setPhone('');
    load();
  };

  const removeContact = id => {
    Alert.alert('Remove contact?', 'This matches the web app delete action.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.deleteContact(id); load(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <FadeInView>
          <PageHeader
            eyebrow="Emergency Network"
            title="Trusted Contacts"
            subtitle="These contacts are used when SOS opens the emergency message flow."
          />
        </FadeInView>

        <FadeInView delay={80}>
          <PremiumCard style={styles.form}>
            <Field placeholder="Full name" value={name} onChangeText={setName} />
            <Field placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <PrimaryButton title="Add Contact" icon="plus" onPress={addContact} />
          </PremiumCard>
        </FadeInView>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Your Network</Text>
          <StatusBadge label={`${contacts.length} Saved`} tone="primary" dot={false} />
        </View>

        {!contacts.length && !loading ? <EmptyState icon="contacts" title="No contacts yet" text="Add at least one trusted contact before using SOS." /> : null}
        {contacts.map((contact, index) => (
          <FadeInView key={contact.id} delay={120 + index * 50}>
            <AnimatedPressable style={[styles.item, glow(colors.primary, 0.16)]} pressedStyle={styles.itemPressed}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(contact.contact_name || '?').trim().charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{contact.contact_name}</Text>
                <Text style={styles.itemText}>{contact.phone_number}</Text>
              </View>
              <GhostButton title="Call" tone="success" icon="phone" onPress={() => Linking.openURL(`tel:${contact.phone_number}`)} />
              <GhostButton title="" tone="danger" icon="close" onPress={() => removeContact(contact.id)} />
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
  form: { gap: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.lg },
  section: { color: colors.ink, fontSize: type.heading, fontFamily: font.bold, letterSpacing: tracking.snug },
  item: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  itemPressed: { opacity: 0.94 },
  itemInfo: { flex: 1 },
  itemTitle: { color: colors.ink, fontFamily: font.bold, fontSize: type.subhead, letterSpacing: tracking.snug },
  itemText: { color: colors.muted, fontFamily: font.regular, marginTop: 3 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...glow(colors.primary, 0.4),
  },
  avatarText: { color: '#fff', fontFamily: font.black, fontSize: type.subhead, letterSpacing: tracking.snug },
});
