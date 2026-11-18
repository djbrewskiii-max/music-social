import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// CI guard for a defect class discovered during the November 2026 visual sweep:
// self-contained screens with dark-only StyleSheets that never read the
// system/user appearance setting. A redirect-only route has no screen styles.
const appDir = new URL('../src/app/', import.meta.url);
const routes = readdirSync(appDir).filter(n=>n.endsWith('.tsx'));
const missing=[];
const opaqueOnLight=[];
for(const name of routes){
  const s=readFileSync(new URL(name,appDir),'utf8');
  const screen=/StyleSheet\.create\s*\(/.test(s);
  if(screen && !/useAppearance\s*\(/.test(s)) missing.push(name);
  // Explicitly forbid the known selected-city invisible-on-white regression.
  if(/color\s*:\s*city\s*\?\s*['"]#(?:fff|ffffff)['"]/.test(s)) opaqueOnLight.push(name);
}
assert.deepEqual(missing,[],'Every styled app screen must use OVRLEE appearance (dark/light/system)');
assert.deepEqual(opaqueOnLight,[],'Selected city must never be forced to white');

const picker=readFileSync(new URL('../src/components/WorldCityPicker.tsx',import.meta.url),'utf8');
assert.ok(picker.includes('useAppearance()'),'Worldwide city picker must support appearance');
assert.ok(picker.includes('canSearchLiveCities()'),'Picker must distinguish live search from offline fallback');
const bell=readFileSync(new URL('../src/components/ActivityBell.tsx',import.meta.url),'utf8');
assert.ok(bell.includes('color:colors.text'),'Home activity bell must be visible in light mode');
const intro=readFileSync(new URL('../src/components/OverlyIntro.tsx',import.meta.url),'utf8');
assert.ok(intro.includes('shouldShowOverlyIntro()'),'Animated intro must respect daily frequency and opt-out');
// Specific release screenshots: enforce the meaningful brand/contrast decisions.
const radar=readFileSync(new URL('../src/app/concerts.tsx',import.meta.url),'utf8');
assert.match(radar,/styles\.searchWrap,scheme==='light'&&\{backgroundColor:'#F2EBE6',borderColor:/,
  'Radar artist search needs an explicit, visible cream/brown field in light mode');
const others=readFileSync(new URL('../src/app/profile.tsx',import.meta.url),'utf8');
assert.match(others,/alignSelf:'center',textAlign:'center',width:'100%'/,
  'Viewed member OVERLY identity should be centered across the profile width');
const own=readFileSync(new URL('../src/app/my-profile.tsx',import.meta.url),'utf8');
assert.match(own,/alignSelf:'flex-start',textAlign:'left'/,
  'Own profile keeps its deliberately left-aligned identity presentation');

console.log(`Appearance coverage: ${routes.length} routes checked, 0 unthemed styled screens`);
