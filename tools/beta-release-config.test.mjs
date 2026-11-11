import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const app=JSON.parse(readFileSync('app.json','utf8')).expo;
const eas=JSON.parse(readFileSync('eas.json','utf8'));

assert.equal(app.name,'OVRLEE','Release branding should be OVRLEE');
assert.ok(Array.isArray(app.scheme)&&app.scheme.includes('ovrlee'),'App deep-link scheme missing');
assert.equal(app.ios.bundleIdentifier,'com.brewskiii.musicsocial');
assert.ok(!app.ios.infoPlist.UIBackgroundModes?.includes('audio'),
  'Background audio must not be enabled while previews intentionally stop on background');
assert.equal(eas.build.preview.distribution,'internal','Internal beta preview profile missing');
assert.equal(eas.build.beta.distribution,'store','TestFlight profile must build store-signed iOS');
assert.equal(eas.build.beta.ios.buildConfiguration,'Release');
assert.ok(eas.submit.beta,'Separate TestFlight submission profile missing');

const packageJson=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(packageJson.main,'expo-router/entry');
assert.ok(packageJson.dependencies['expo-share-intent'],'Native share handling must remain installed');

console.log('OVRLEE release configuration assertions passed.');
