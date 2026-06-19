const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Fix: Explicit watchFolders to work around OneDrive SHA-1 watcher issues.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;

const config = {
  watchFolders: [projectRoot],
  watcher: {
    // Use polling instead of native file watchers (fixes OneDrive issues)
    watchman: {
      enabled: false,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
