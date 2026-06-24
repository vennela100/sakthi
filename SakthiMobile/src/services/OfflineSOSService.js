import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './ApiService';

const { RiskCamera } = NativeModules;
const CONTACT_CACHE_KEY = 'offlineEmergencyContacts';

export async function cacheEmergencyContacts(contacts) {
  try {
    const safeContacts = (contacts || []).map(contact => ({
      contact_name: contact.contact_name,
      phone_number: contact.phone_number,
      relationship: contact.relationship,
    }));
    await AsyncStorage.setItem(CONTACT_CACHE_KEY, JSON.stringify(safeContacts));
  } catch (_) {
    // Cache is best effort only.
  }
}

export async function getCachedEmergencyContacts() {
  try {
    const raw = await AsyncStorage.getItem(CONTACT_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function sendDirectSms(phoneNumber, message) {
  const normalized = String(phoneNumber || '').replace(/[^\d+]/g, '');
  if (!normalized || !RiskCamera?.sendSms) {
    return Promise.resolve({ ok: false, error: 'SMS module unavailable' });
  }
  return RiskCamera.sendSms(normalized, message)
    .then(() => ({ ok: true }))
    .catch(error => ({ ok: false, error: error.message || 'SMS failed' }));
}

async function deleteLocalPhoto(photo) {
  const path = photo?.path || photo?.uri;
  if (!path || !RiskCamera?.deleteLocalFile) {
    return;
  }

  try {
    await RiskCamera.deleteLocalFile(path);
  } catch (error) {
    console.warn('Evidence cache cleanup failed:', error.message || error);
  }
}

export async function createSosAlert(location, photo, imageName = 'sos_evidence.jpg') {
  if (photo && RiskCamera?.readFileBase64) {
    const imageBase64 = await RiskCamera.readFileBase64(photo.path || photo.uri);
    return api.triggerSOS({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      send_twilio_sms: false,
      image_base64: imageBase64,
      image_name: photo.fileName || imageName,
    });
  }

  return api.triggerSOS({
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    send_twilio_sms: false,
  });
}

export function mapsUrlForLocation(location) {
  return location ? `https://maps.google.com/?q=${location.latitude},${location.longitude}` : null;
}

export function buildOfflineCapableMessage({
  title = 'SOS! I need help.',
  trackingUrl,
  evidenceUrl,
  mapsUrl,
  hasPhoto = false,
  offline = false,
}) {
  const parts = [
    offline ? `${title} Offline fallback activated.` : title,
    mapsUrl ? `Google Maps location: ${mapsUrl}` : 'Current location unavailable.',
    trackingUrl ? `Live tracking: ${trackingUrl}` : null,
    hasPhoto
      ? `Evidence photo: ${evidenceUrl || trackingUrl || (offline ? 'captured locally but could not upload' : 'captured locally')}`
      : null,
    'Please call me immediately.',
  ].filter(Boolean);
  return parts.join('\n');
}

export async function sendOfflineCapableSOS({
  contacts,
  location,
  photo,
  title,
  imageName,
}) {
  const phoneList = (contacts || []).map(contact => contact.phone_number).filter(Boolean);
  const mapsUrl = mapsUrlForLocation(location);
  let trackingUrl = null;
  let evidenceUrl = null;
  let backendIssue = null;
  let storageFull = false;
  let offline = false;

  try {
    const response = await createSosAlert(location, photo, imageName);
    trackingUrl = response.data.tracking_url || null;
    evidenceUrl = response.data.evidence_url || null;
    // Backend saved the alert but the evidence photo couldn't be stored because
    // the media account (Cloudinary) is out of space. SOS still went through.
    storageFull = response.data.storage_full === true
      || response.data.evidence_status === 'storage_full';
  } catch (error) {
    backendIssue = error.response?.data?.detail || error.message || 'Backend unavailable';
    offline = true;
  } finally {
    await deleteLocalPhoto(photo);
  }

  const smsBody = buildOfflineCapableMessage({
    title,
    trackingUrl,
    evidenceUrl,
    mapsUrl,
    hasPhoto: Boolean(photo),
    offline,
  });

  const results = await Promise.all(phoneList.map(phone => sendDirectSms(phone, smsBody)));
  const sentCount = results.filter(result => result.ok).length;
  const firstFailure = results.find(result => !result.ok)?.error;

  return {
    sentCount,
    totalCount: phoneList.length,
    firstFailure,
    backendIssue,
    storageFull,
    offline,
    trackingUrl,
    evidenceUrl,
    displayLink: trackingUrl || mapsUrl || 'Location unavailable',
  };
}
