import React, { useContext } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { IconMark } from '../components/Premium';
import Icon from '../components/Icon';
import { colors, font, radius, shadow, softShadow, spacing, tracking, type } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SafeRouteScreen from '../screens/SafeRouteScreen';
import LiveTrackScreen from '../screens/LiveTrackScreen';
import NearbyPlacesScreen from '../screens/NearbyPlacesScreen';
import SafetyTimerScreen from '../screens/SafetyTimerScreen';
import VoiceSOSScreen from '../screens/VoiceSOSScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import SOSEvidenceScreen from '../screens/SOSEvidenceScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const moreItems = [
  { title: 'AI Assistant', subtitle: 'Ask safety questions by text or voice.', screen: 'AIAssistant', icon: 'ai', tone: 'violet' },
  { title: 'Safety Timer', subtitle: 'Start a timed check-in before travel.', screen: 'SafetyTimer', icon: 'timer', tone: 'warning' },
  { title: 'Nearby Safe Places', subtitle: 'Find police stations, hospitals, and safe spots.', screen: 'Nearby', icon: 'map', tone: 'success' },
  { title: 'Community Reports', subtitle: 'View and submit local safety reports.', screen: 'Reports', icon: 'report', tone: 'danger' },
  { title: 'SOS Evidence', subtitle: 'Delete saved SOS photos only when you choose.', screen: 'SOSEvidence', icon: 'camera', tone: 'danger' },
  { title: 'Emergency Contacts', subtitle: 'Manage trusted contacts for SOS alerts.', screen: 'Contacts', icon: 'contacts', tone: 'accent' },
];

const TAB_ICON = {
  Home: 'home',
  LiveTrack: 'navigate',
  SafeRoute: 'route',
  VoiceSOS: 'voice',
  More: 'more',
};

function TabIcon({ routeName, focused }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Icon
        name={TAB_ICON[routeName]}
        size={22}
        color={focused ? '#fff' : colors.faint}
        strokeWidth={focused ? 2.1 : 1.9}
      />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="LiveTrack" component={LiveTrackScreen} options={{ title: 'Live Track', tabBarLabel: 'Track' }} />
      <Tab.Screen name="SafeRoute" component={SafeRouteScreen} options={{ title: 'Safe Route', tabBarLabel: 'Route' }} />
      <Tab.Screen name="VoiceSOS" component={VoiceSOSScreen} options={{ title: 'Voice SOS', tabBarLabel: 'Voice' }} />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ headerShown: false, tabBarLabel: 'More' }}
        listeners={({ navigation }) => ({
          tabPress: event => {
            event.preventDefault();
            navigation.navigate('More', { screen: 'MoreHome' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

function MoreHomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.moreScreen} contentContainerStyle={styles.moreContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.moreEyebrow}>Command menu</Text>
      <Text style={styles.moreTitle}>Safety tools</Text>
      <Text style={styles.moreSubtitle}>Advanced response, assistance, reports, and contacts.</Text>
      <View style={styles.moreList}>
        {moreItems.map(item => (
          <Pressable
            key={item.screen}
            style={({ pressed }) => [styles.moreItem, pressed && styles.moreItemPressed]}
            onPress={() => navigation.navigate(item.screen)}>
            <IconMark name={item.icon} tone={item.tone} size={46} style={styles.moreGlyph} />
            <View style={styles.moreTextWrap}>
              <Text style={styles.moreItemTitle}>{item.title}</Text>
              <Text style={styles.moreItemSubtitle}>{item.subtitle}</Text>
            </View>
            <Icon name="chevron" size={18} color={colors.faint} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontFamily: font.black, letterSpacing: tracking.snug },
        headerTintColor: colors.ink,
      }}>
      <Stack.Screen name="MoreHome" component={MoreHomeScreen} options={{ title: 'More' }} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ title: 'AI Assistant' }} />
      <Stack.Screen name="SafetyTimer" component={SafetyTimerScreen} options={{ title: 'Safety Timer' }} />
      <Stack.Screen name="Nearby" component={NearbyPlacesScreen} options={{ title: 'Nearby Safe Places' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Community Reports' }} />
      <Stack.Screen name="SOSEvidence" component={SOSEvidenceScreen} options={{ title: 'SOS Evidence' }} />
      <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoading, userToken } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {userToken == null ? <LoginScreen /> : <MainTabs />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvasDark,
  },
  tabBar: {
    height: 84,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    ...shadow,
  },
  tabItem: {
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontFamily: font.bold,
    letterSpacing: tracking.wide,
    marginTop: 3,
  },
  tabIcon: {
    width: 48,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primary,
  },
  moreScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  moreContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  moreEyebrow: {
    color: colors.primary,
    fontFamily: font.black,
    fontSize: type.micro,
    letterSpacing: tracking.widest,
    textTransform: 'uppercase',
  },
  moreTitle: {
    color: colors.ink,
    fontFamily: font.black,
    fontSize: type.hero,
    letterSpacing: tracking.tighter,
    marginTop: 6,
  },
  moreSubtitle: {
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: type.body,
    lineHeight: 22,
    marginTop: 7,
    marginBottom: spacing.xl,
  },
  moreList: {
    gap: spacing.md,
  },
  moreItem: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    ...softShadow,
  },
  moreItemPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  moreGlyph: {},
  moreTextWrap: {
    flex: 1,
  },
  moreItemTitle: {
    color: colors.ink,
    fontFamily: font.black,
    fontSize: type.subhead,
    letterSpacing: tracking.snug,
  },
  moreItemSubtitle: {
    color: colors.muted,
    fontFamily: font.regular,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 4,
  },
});
