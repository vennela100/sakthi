import { useContext, useEffect, useRef } from 'react';
import {
  Alert,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/ApiService';
import { getCachedEmergencyContacts, sendOfflineCapableSOS } from '../services/OfflineSOSService';

const { PowerButtonTrigger } = NativeModules;
const powerEvents = PowerButtonTrigger ? new NativeEventEmitter(PowerButtonTrigger) : null;

function requestPermission(permission) {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return PermissionsAndroid.request(permission).then(result => result === PermissionsAndroid.RESULTS.GRANTED);
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

async function getFastLocation(profile) {
  const cached = await getLocationOrNull({ enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 });
  if (cached) return cached;

  const fresh = await getLocationOrNull({ enableHighAccuracy: true, timeout: 6500, maximumAge: 30000 });
  if (fresh) return fresh;

  if (profile?.last_latitude && profile?.last_longitude) {
    return {
      latitude: Number(profile.last_latitude),
      longitude: Number(profile.last_longitude),
    };
  }
  return null;
}

export default function PowerButtonSOSHandler() {
  const { userToken } = useContext(AuthContext);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!userToken || !PowerButtonTrigger || !powerEvents) {
      return undefined;
    }

    PowerButtonTrigger.startMonitoring().catch(error => {
      console.warn('[Power SOS] monitor failed:', error.message);
    });

    const subscription = powerEvents.addListener('PowerButtonTriplePress', async () => {
      if (sendingRef.current) return;
      sendingRef.current = true;

      try {
        const [locationOk, smsOk] = await Promise.all([
          requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
          requestPermission(PermissionsAndroid.PERMISSIONS.SEND_SMS),
        ]);

        let profile = null;
        let contacts = [];
        try {
          const [profileRes, contactsRes] = await Promise.all([
            api.profile(),
            api.contacts(),
          ]);
          profile = profileRes.data;
          contacts = contactsRes.data.results || contactsRes.data;
        } catch (_) {
          contacts = await getCachedEmergencyContacts();
        }
        const phoneList = contacts.map(contact => contact.phone_number).filter(Boolean);

        if (!phoneList.length) {
          Alert.alert('Power SOS blocked', 'No trusted contacts are saved.');
          return;
        }
        if (!smsOk) {
          Alert.alert('Power SOS blocked', 'SMS permission is required.');
          return;
        }

        const location = locationOk ? await getFastLocation(profile) : null;
        const sosResult = await sendOfflineCapableSOS({
          contacts,
          location,
          title: 'SOS triggered by 3 power button presses.',
        });

        Alert.alert(
          sosResult.offline ? 'Offline Power SOS sent' : 'Power SOS sent',
          `${sosResult.sentCount}/${sosResult.totalCount} contacts messaged.${sosResult.firstFailure ? `\nIssue: ${sosResult.firstFailure}` : ''}${sosResult.backendIssue ? `\nBackend issue: ${sosResult.backendIssue}` : ''}\nTracking: ${sosResult.displayLink}`,
        );
      } catch (error) {
        Alert.alert('Power SOS failed', error.response?.data?.detail || error.message);
      } finally {
        setTimeout(() => {
          sendingRef.current = false;
        }, 2500);
      }
    });

    return () => {
      subscription.remove();
      PowerButtonTrigger.stopMonitoring().catch(() => {});
    };
  }, [userToken]);

  return null;
}
