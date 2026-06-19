import axios from 'axios';
import { API_BASE_URL } from '../config/api';

axios.defaults.timeout = 15000;

export function setAuthToken(token) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

export const api = {
  login: (loginId, password) =>
    axios.post(`${API_BASE_URL}/token/`, { username: loginId, password }),
  register: payload => axios.post(`${API_BASE_URL}/register/`, payload),
  googleLogin: idToken => axios.post(`${API_BASE_URL}/auth/google/`, { id_token: idToken }),
  refreshToken: refresh => axios.post(`${API_BASE_URL}/token/refresh/`, { refresh }),
  profile: () => axios.get(`${API_BASE_URL}/profile/`),
  contacts: () => axios.get(`${API_BASE_URL}/contacts/`),
  createContact: data => axios.post(`${API_BASE_URL}/contacts/`, data),
  deleteContact: id => axios.delete(`${API_BASE_URL}/contacts/${id}/`),
  reports: () => axios.get(`${API_BASE_URL}/community-reports/`),
  createReport: data => axios.post(`${API_BASE_URL}/community-reports/`, data),
  sosAlerts: () => axios.get(`${API_BASE_URL}/sos/`),
  deleteSosAlert: id => axios.delete(`${API_BASE_URL}/sos/${id}/`),
  deleteSosEvidence: id => axios.delete(`${API_BASE_URL}/sos/${id}/evidence/`),
  dangerZones: () => axios.get(`${API_BASE_URL}/danger-zones/`),
  updateLocation: data => axios.post(`${API_BASE_URL}/update-location/`, data),
  analyzeRoute: data => axios.post(`${API_BASE_URL}/analyze-route/`, data),
  askAI: data => axios.post(`${API_BASE_URL}/ai-assistant/`, data),
  triggerSOS: data => axios.post(`${API_BASE_URL}/trigger-sos/`, data),
  triggerSOSMultipart: formData =>
    axios.post(`${API_BASE_URL}/trigger-sos/`, formData),
  registerFCM: (fcmToken, jwtToken) =>
    axios.post(
      `${API_BASE_URL}/register-fcm-token/`,
      { fcm_token: fcmToken },
      { headers: { Authorization: `Bearer ${jwtToken}` } },
    ),
  geocodePlace: place =>
    axios.get(`${API_BASE_URL}/geocode-place/`, { params: { q: place } }),
};
