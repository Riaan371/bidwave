const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Intercept react-native-web's setValueForStyles on web builds.
// Chrome 125+ throws "Indexed property setter is not supported" when code does
// style["0"] = value. This happens when a numeric StyleSheet ID leaks through
// as a CSS property key. Our patched version skips numeric keys.
const _resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    moduleName.includes('setValueForStyles')
  ) {
    return {
      filePath: path.resolve(__dirname, 'patches/setValueForStyles.js'),
      type: 'sourceFile',
    };
  }
  return _resolveRequest
    ? _resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
