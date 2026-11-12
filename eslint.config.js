// Expo SDK 57: official flat ESLint configuration.
// Install dependencies with: npx expo install eslint eslint-config-expo --dev
// The package-lock.json must be updated and committed alongside package.json.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores([
    'dist/**',
    '.expo/**',
    'node_modules/**',
    'ios/**',
    'android/**',
    'now-spotify/ios/**',
    'now-shazam/ios/**',
  ]),
  expoConfig,
]);
