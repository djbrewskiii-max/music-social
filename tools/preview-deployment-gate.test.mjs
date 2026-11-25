import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const file = new URL('../.github/workflows/typecheck.yml', import.meta.url);
const workflow = readFileSync(file, 'utf8');

// Prevent accidental reintroduction of publishers that can run in parallel
// with, and independently of, the full quality suite.
assert.equal(existsSync(new URL('../.github/workflows/preview-ota.yml',import.meta.url)),false,
  'The old independent automatic publisher must stay retired');
assert.equal(existsSync(new URL('../.github/workflows/publish-preview.yml',import.meta.url)),false,
  'The manually triggered publisher must not bypass the full test suite');

assert.match(workflow,/^\s{2}publish-preview:\n/m,
  'Single gated publish job must live in the quality workflow');
assert.match(workflow,/needs:\s*\[typecheck, ios-js-bundle, spotify-native-swift-parse\]/,
  'Never publish without all three independent jobs completing successfully');
assert.match(workflow,/github\.ref == 'refs\/heads\/claude-build'/,
  'No preview publication from a feature branch or PR');
assert.match(workflow,/github\.event_name == 'push' \|\| inputs\.confirm_preview == true/,
  'Dispatch requires explicit owner confirmation');
assert.match(workflow,/environment: preview/,
  'Only the protected preview environment may receive automatic updates');
assert.match(workflow,/group: ovrlee-ios-preview-publish/,
  'Prevent concurrent preview publication from multiple pushes');
assert.match(workflow,/cancel-in-progress: false/,
  'Never kill an in-progress Expo update midway through publication');
assert.match(workflow,/git ls-remote origin refs\/heads\/claude-build/,
  'A superseded workflow must not publish an older commit');
assert.match(workflow,/if: steps\.latest\.outputs\.publish == 'true'/,
  'A stale commit must skip all deployment steps');
assert.match(workflow,/Reject native changes incompatible with OTA preview/,
  'Native changes must require a new binary');
assert.match(workflow,/npx eas-cli@latest channel:view preview/,
  'The workflow must check the destination channel identity');
assert.match(workflow,/--platform ios/,
  'No accidental Android, TestFlight, beta or production release');
assert.match(workflow,/--channel preview/,
  'Never target a beta or production channel');
assert.match(workflow,/--environment preview/,
  'Use the correct Expo EAS preview environment');

console.log('Gated preview deployment contract passed');
