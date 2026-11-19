import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const feed=read('src/app/now.tsx');
const thread=read('src/app/post.tsx');
const chat=read('src/app/chat.tsx');
const groupInfo=read('src/app/group-info.tsx');
const musicSettings=read('src/app/music-settings.tsx');
const promptMigration=read('supabase/migrations/20261119235000_ovrlee_aux_official_prompts.sql');

assert.match(musicSettings,/provider==='spotify'&&<Pressable/,
 'Apple Music members must not see the Spotify playlist showcase');
assert.match(musicSettings,/provider==='spotify'&&<Text/,
 'Spotify-specific limitations must not clutter an Apple Music account');

assert.match(feed,/const activeMusicPeople=listeningPeople.filter/,
 'Home should derive the genuine listening cohort, not show every online member');
assert.match(feed,/activeMusicPeople.length>0&&\(/,
 'Do not show a sparse Who\'s Here section when no music is actually playing');
assert.match(feed,/activeMusicPeople.map/,
 'Only verified listening candidates should be rendered in the presence row');

assert.match(chat,/const \[searchOpen,setSearchOpen\]/,'Chat search control required');
assert.match(chat,/visibleMessages=needle/,'Chat search must filter loaded history');
assert.match(chat,/visibleMessages\.map/,'Chat search filter must affect results');
assert.match(groupInfo,/Search messages →/,'Group details should expose chat search');
assert.match(groupInfo,/search:'1'/,'Group search opens the chat search state');

assert.match(promptMigration,/post_kind in \('music','aux_prompt'\)/);
assert.match(promptMigration,/enabled boolean not null default false/,
 'Official prompt automation must be disabled until beta acceptance');
assert.match(promptMigration,/private\.ovrlee_publish_aux_prompt/,
 'First-party prompt publisher must exist, not impersonate ordinary members');
assert.match(promptMigration,/revoke all on function private\.ovrlee_publish_aux_prompt/,
 'Members may not invoke official prompt publication');
assert.match(promptMigration,/\(28,'/,
 'Original prompt catalog should contain 28 questions for rotation');
assert.match(feed,/post\.post_kind==='aux_prompt'/,
 'Feed must distinguish an official question from a normal music post');
assert.match(thread,/post\.post_kind!=='aux_prompt'/,
 'Opening an Aux question must not show a fake/empty music card');
assert.match(feed,/REPLY WITH A SONG/,
 'Official questions must lead to existing Song Reply conversations');
console.log('Previously requested features regression contract passed');
