import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermission,
  getFCMToken,
  registerTokenWithBackend,
} from '../services/FCMService';
import { api, setAuthToken } from '../services/ApiService';

// Create Context
export const AuthContext = createContext();

function decodeBase64Url(value) {
  let input = value.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) {
    input += '=';
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '=') {
      break;
    }
    const index = chars.indexOf(char);
    if (index < 0) {
      throw new Error('Invalid JWT payload encoding.');
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  try {
    return decodeURIComponent(
      output
        .split('')
        .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return output;
  }
}

function getJwtPayload(token) {
  const payload = token?.split('.')?.[1];
  if (!payload) {
    return null;
  }
  return JSON.parse(decodeBase64Url(payload));
}

function isUsableAccessToken(token) {
  try {
    const payload = getJwtPayload(token);
    return (
      payload?.token_type === 'access' &&
      typeof payload.exp === 'number' &&
      payload.exp * 1000 > Date.now() + 30000
    );
  } catch {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userToken, setUserToken] = useState(null);

  /**
   * After login succeeds, request notification permission, get the FCM
   * device token and register it with the Django backend.
   */
  const registerFCMToken = async (jwtToken) => {
    try {
      const permitted = await requestNotificationPermission();
      if (!permitted) {
        console.warn('[FCM] Notification permission denied — FCM alerts disabled.');
        return;
      }
      const fcmToken = await getFCMToken();
      if (fcmToken) {
        await registerTokenWithBackend(fcmToken, jwtToken);
      }
    } catch (err) {
      console.error('[FCM] Token registration flow failed:', err);
    }
  };

  const login = async (loginId, password) => {
    setIsLoading(true);
    try {
      const response = await api.login(loginId, password);

      const token = response.data.access;
      const refreshToken = response.data.refresh;
      setUserToken(token);
      setAuthToken(token);
      await AsyncStorage.setItem('userToken', token);
      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }
      console.log('Login successful');
      setIsLoading(false);

      // Register FCM token with backend so we can receive SOS push alerts
      registerFCMToken(token);
      return { ok: true };
    } catch (e) {
      console.error('Login error:', e.response?.data || e.message);
      setIsLoading(false);
      return {
        ok: false,
        message: e.response?.data?.detail || 'Login failed. Check your email/username and password.',
      };
    }
  };

  /**
   * Persist a JWT pair returned by either the password or Google flow and
   * finish the standard post-login work (FCM registration).
   */
  const completeLogin = async (token, refreshToken) => {
    setUserToken(token);
    setAuthToken(token);
    await AsyncStorage.setItem('userToken', token);
    if (refreshToken) {
      await AsyncStorage.setItem('refreshToken', refreshToken);
    }
    registerFCMToken(token);
  };

  /**
   * Create a new account, then log straight in with the JWT pair the backend
   * returns (same shape as /token/), so the user lands in the app immediately.
   */
  const register = async payload => {
    setIsLoading(true);
    try {
      const response = await api.register(payload);
      await completeLogin(response.data.access, response.data.refresh);
      console.log('Registration successful');
      setIsLoading(false);
      return { ok: true };
    } catch (e) {
      console.error('Registration error:', e.response?.data || e.message);
      setIsLoading(false);
      const data = e.response?.data;
      let message = data?.detail;
      if (!message && data && typeof data === 'object') {
        const firstError = Object.values(data)[0];
        message = Array.isArray(firstError) ? firstError[0] : firstError;
      }
      return { ok: false, message: String(message || 'Could not create account. Please try again.') };
    }
  };

  const googleLogin = async idToken => {
    setIsLoading(true);
    try {
      const response = await api.googleLogin(idToken);
      await completeLogin(response.data.access, response.data.refresh);
      console.log('Google login successful');
      setIsLoading(false);
      return { ok: true };
    } catch (e) {
      console.error('Google login error:', e.response?.data || e.message);
      setIsLoading(false);
      return {
        ok: false,
        message: e.response?.data?.detail || 'Google sign-in failed. Please try again.',
      };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setUserToken(null);
    setAuthToken(null);
    try {
      await AsyncStorage.multiRemove(['userToken', 'refreshToken']);
    } catch (error) {
      console.error('Logout storage cleanup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkLogin = async () => {
      try {
        setIsLoading(true);
        let token = await AsyncStorage.getItem('userToken');
        let refreshToken = await AsyncStorage.getItem('refreshToken');

        if (refreshToken) {
          const response = await api.refreshToken(refreshToken);
          token = response.data.access;
          const rotatedRefreshToken = response.data.refresh;
          await AsyncStorage.setItem('userToken', token);
          if (rotatedRefreshToken) {
            await AsyncStorage.setItem('refreshToken', rotatedRefreshToken);
          }
        } else if (token && !isUsableAccessToken(token)) {
          await AsyncStorage.removeItem('userToken');
          token = null;
        }

        if (token) {
          setUserToken(token);
          setAuthToken(token);
          // Re-register FCM token in case it refreshed since last session
          registerFCMToken(token);
        }
        setIsLoading(false);
      } catch (e) {
        console.error('Token fetch error:', e);
        await AsyncStorage.multiRemove(['userToken', 'refreshToken']);
        setUserToken(null);
        setAuthToken(null);
        setIsLoading(false);
      }
    };
    checkLogin();
  }, []);

  return (
    <AuthContext.Provider value={{ login, register, googleLogin, logout, isLoading, userToken }}>
      {children}
    </AuthContext.Provider>
  );
};
