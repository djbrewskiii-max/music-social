import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const folder = await mkdtemp(join(tmpdir(), 'ovrlee-weekly-'));
const script = resolve('tools/weekly-spotify-report.mjs');
const url = 'https://open.spotify.com/playlist/447MHZ97CzQrtst1WCrAOU';
function snapshot(tracks) {
 return {
  userId: '7je6xz1iqqn2ru3njokrxp6l0',
  profileUrl: 'https://open.spotify.com/user/7je6xz1iqqn2ru3njokrxp6l0',
  collectedAt: '2026-11-06T18:00:00Z',
  status: 'tracks_visible_in_public_embed',
  profilePlaylistLinksFound: 1,
  publicPlaylists: [{ title:'Gym',url,status:'embedded_tracks_found',visibleTracks:tracks,completeness:'partial'}],
 };
}
const one = {song:'Carrollton',artist:'$uicideboy$'};
const two = {song:'Birds of a Feather',artist:'Billie Eilish'};
function run(prev,now) {
 const p=spawnSync(process.execPath,[script,prev,now],{cwd:folder,encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 return p;
}
try {
 await writeFile(join(folder,'now.json'),JSON.stringify(snapshot([one])));
 run('-', 'now.json');
 let out=JSON.parse(await readFile(join(folder,'spotify-weekly-report.json'),'utf8'));
 assert.equal(out.initialBaseline,true);
 assert.equal(out.changed,false);
 await writeFile(join(folder,'prev.json'),await readFile(join(folder,'spotify-weekly-snapshot.json')));
 run('prev.json','now.json');
 out=JSON.parse(await readFile(join(folder,'spotify-weekly-report.json'),'utf8'));
 assert.equal(out.changed,false);
 await writeFile(join(folder,'now.json'),JSON.stringify(snapshot([one,two])));
 run('prev.json','now.json');
 out=JSON.parse(await readFile(join(folder,'spotify-weekly-report.json'),'utf8'));
 assert.equal(out.changed,true);
 assert.equal(out.newlyObservedTracks,1);
 assert.equal(out.changes[0].tracksAdded[0].artist,'Billie Eilish');
 console.log('PASS: baseline, unchanged skip, and one newly observed song');
} finally {await rm(folder,{recursive:true,force:true});}
