import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const routes=[
  'concerts','concert-detail','listeners','login','signup','core-four',
  'follows','callback','edit-profile','my-profile','profile','connect-music'
];
const legacy=[
  /\bNOW could\b/,
  /\bjoin NOW\b/,
  /\bReturn to NOW\b/,
  /\bYour corner of NOW\b/,
  /\bNOW GREEN\b/,
  /YOUR MUSIC\. YOUR PEOPLE\.\s+RIGHT NOW\./,
  />\s*NOW\s*<\/Text>/
];
for(const route of routes){
  const source=readFileSync(join('src','app',route+'.tsx'),'utf8');
  for(const pattern of legacy)
    assert.equal(pattern.test(source),false,
      `Found legacy branding in ${route}.tsx: ${pattern}`);
}
for(const name of ['system-music-test','shazam-lab','listenbrainz-connect']){
  const source=readFileSync(join('src','app',name+'.tsx'),'utf8');
  assert.match(source, /Redirect/, `Experimental ${name} must stay a redirect`);
}
console.log('OVRLEE beta branding / archived route guard passed.');
