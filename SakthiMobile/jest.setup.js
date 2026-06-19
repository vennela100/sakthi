/* eslint-env jest */

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ data: { idToken: 'test-id-token' } })),
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => ({
    requestPermission: jest.fn(() => Promise.resolve(1)),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
  }));

  messaging.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };

  return messaging;
});

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMap = props => React.createElement(View, props, props.children);
  MockMap.Marker = props => React.createElement(View, props, props.children);
  MockMap.Polyline = props => React.createElement(View, props, props.children);
  MockMap.Circle = props => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MockMap,
    Marker: MockMap.Marker,
    Polyline: MockMap.Polyline,
    Circle: MockMap.Circle,
  };
});
