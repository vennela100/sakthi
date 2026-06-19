const fs = require('fs');
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
const realProjectRoot = fs.realpathSync(projectRoot);

const config = {
  watchFolders:
    realProjectRoot === projectRoot ? [projectRoot] : [projectRoot, realProjectRoot],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
