#!/usr/bin/env node
/**
 * Offline comparison of two public-music snapshot reports from an authorized
 * source. Usage:
 *   node tools/weekly-playlist-compare.mjs previous.json current.json
 * No network calls. Outputs JSON change report to stdout.
 */
import { readFile } from 'node:fs/promises';
import { compareSnapshots } from './playlist-snapshot-diff.mjs';
function normalize(source) {
 const p=source||{};
 const entries=Array.isArray(p.playlists)?p.playlists:(Array.isArray(p.publicPlaylists)?p.publicPlaylists:[]);
 return {
  checkedAt:p.checkedAt||p.collectedAt,
  // The existing DOM probe might miss off-screen playlists; do not infer deletion.
  inventoryComplete:p.inventoryComplete===true,
  playlists:entries.filter(x=>typeof x?.url==='string').map(x=>({
   url:x.url,title:String(x.title||''),
   tracks:Array.isArray(x.tracks)?x.tracks:(Array.isArray(x.visibleTracks)?x.visibleTracks:[]),
   // Web/embed results can truncate track lists, even if the DOM shows no 'more'.
   completeness:x.completeness==='complete'?'complete':'partial'
  }))
 };
}
const [previousPath,currentPath]=process.argv.slice(2);
if(!previousPath||!currentPath){console.error('Usage: node tools/weekly-playlist-compare.mjs previous.json current.json');process.exit(2);}
try {
 const [a,b]=await Promise.all([previousPath,currentPath].map(async p=>JSON.parse(await readFile(p,'utf8'))));
 console.log(JSON.stringify(compareSnapshots(normalize(a),normalize(b)),null,2));
}catch(e){console.error('Could not compare snapshot reports:',e?.message||e);process.exitCode=1;}
