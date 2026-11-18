import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dirs=[new URL('../src/app/',import.meta.url),new URL('../src/components/',import.meta.url)];
const brokenAvatars=[];
const inertTaps=[];
let files=0;
for(const dir of dirs){
  for(const name of readdirSync(dir).filter(x=>x.endsWith('.tsx'))){
    files++;
    const content=readFileSync(new URL(name,dir),'utf8');
    if(/https?:\/\/(?:via\.placeholder\.com|placehold\.co)(?:\b|\/)/i.test(content))
      brokenAvatars.push(name);
    if(/onPress\s*=\s*\{\s*\(\s*\)\s*=>\s*(?:\{\s*\}|undefined|null|void\s+0)\s*\}/.test(content))
      inertTaps.push(name);
  }
}
assert.deepEqual(brokenAvatars,[],'Do not depend on remote dummy image services for real user avatars');
assert.deepEqual(inertTaps,[],'Every button that advertises a tap needs a real action, not an empty handler');
console.log(`Prelaunch interaction guard: ${files} app/component TSX files checked`);
