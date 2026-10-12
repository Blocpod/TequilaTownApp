// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `/shared` (content + API contract) lives beside the app so the Netlify backend uses the same source.
// Imports resolve through the `@shared` path alias in tsconfig.json.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

module.exports = config;
