/**
 * FCMService.js
 * Handles Firebase Cloud Messaging token retrieval, permission requests,
 * and incoming notification listeners for the Sakthi Safety App.
 */
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { api } from './ApiService';

/**
 * Request notification permission (required on Android 13+ and all iOS).
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // For iOS / older Android, ask via Firebase
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Retrieves the FCM device token.
 * Returns the token string, or null on failure.
 */
export async function getFCMToken() {
  try {
    // Ensure we have a valid APNs token on iOS first
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    console.log('[FCM] Device token:', token);
    return token;
  } catch (error) {
    console.error('[FCM] Failed to get token:', error);
    return null;
  }
}

/**
 * Registers the FCM token with the Django backend so the server
 * can target this device for push notifications.
 *
 * @param {string} fcmToken - The FCM device token
 * @param {string} jwtToken - The user's JWT Bearer token
 */
export async function registerTokenWithBackend(fcmToken, jwtToken) {
  try {
    await api.registerFCM(fcmToken, jwtToken);
    console.log('[FCM] Token registered with backend successfully.');
  } catch (error) {
    console.error(
      '[FCM] Failed to register token with backend:',
      error.response?.data || error.message,
    );
  }
}

/**
 * Sets up all FCM notification listeners.
 * - onMessage: app in foreground → shows an Alert
 * - onNotificationOpenedApp: user taps notification when app is in background
 * - getInitialNotification: app was killed, opened via notification tap
 *
 * Call this once inside a useEffect in your root component (App.js).
 * Returns an unsubscribe function to clean up on unmount.
 */
export function setupFCMListeners(onSOSReceived) {
  // 1. Foreground messages
  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('[FCM] Foreground message received:', remoteMessage);
    const { title, body } = remoteMessage.notification || {};
    const data = remoteMessage.data || {};

    // Notify the caller (e.g. HomeScreen) with the raw message
    if (onSOSReceived) {
      onSOSReceived({ title, body, data });
    }

    // Show an alert if the SOS notification arrived while app is open
    Alert.alert(title || '🚨 SOS Alert', body || 'Someone needs help!', [
      { text: 'OK' },
    ]);
  });

  // 2. Background tap: user tapped notification while app was in background
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log(
      '[FCM] Notification opened from background:',
      remoteMessage.notification,
    );
    if (onSOSReceived) {
      onSOSReceived({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data,
      });
    }
  });

  // 3. Killed state tap: app was closed, opened via notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log(
          '[FCM] App opened from killed state via notification:',
          remoteMessage.notification,
        );
        if (onSOSReceived) {
          onSOSReceived({
            title: remoteMessage.notification?.title,
            body: remoteMessage.notification?.body,
            data: remoteMessage.data,
          });
        }
      }
    });

  // Return cleanup function (only foreground unsub is needed here)
  return unsubscribeForeground;
}

/**
 * Background message handler — MUST be called outside of any component,
 * typically at the top of index.js.
 */
export function setBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[FCM] Background message handled:', remoteMessage);
    // Background messages are auto-displayed by the OS as a notification.
    // Add any background data processing logic here if needed.
  });
}
