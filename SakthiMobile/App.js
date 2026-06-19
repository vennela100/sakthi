import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import PowerButtonSOSHandler from './src/components/PowerButtonSOSHandler';
import { GOOGLE_WEB_CLIENT_ID } from './src/config/api';
import { colors } from './src/theme';

export default function App() {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <PowerButtonSOSHandler />
      <AppNavigator />
    </AuthProvider>
  );
}
