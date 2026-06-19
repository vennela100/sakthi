/**
 * @format
 *
 * IMPORTANT: The FCM background handler must be registered here — at the very
 * top level, before any React component mounts — so Android can wake the app
 * and handle push notifications when it is killed or in the background.
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setBackgroundMessageHandler } from './src/services/FCMService';

// Register FCM background/killed-state message handler
setBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);

