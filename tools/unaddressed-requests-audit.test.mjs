import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const feed=read('src/app/now.tsx');
const thread=read('src/app/post.tsx');
const myProfile=read('src/app/my-profile.tsx');
const memberProfile=read('src/app/profile.tsx');
const activity=read('src/app/post-collections.tsx');
const chat=read('src/app/chat.tsx');
const groupInfo=read('src/app/group-info.tsx');
const newGroup=read('src/app/new-group.tsx');
const musicSettings=read('src/app/music-settings.tsx');
const promptMigration=read('supabase/migrations/20261119235000_ovrlee_aux_official_prompts.sql');

assert.match(musicSettings,/provider==='spotify'&&<Pressable/,
 'Apple Music members must not see the Spotify playlist showcase');
assert.match(musicSettings,/provider==='spotify'&&<Text/,
 'Spotify-specific limitations must not clutter an Apple Music account');

assert.match(feed,/const activeMusicPeople\s*=\s*listeningPeople\.filter/,
 'Home should derive the genuine listening cohort, not show every online member');
assert.match(feed,/tier === 'verified_live' \|\| tier === 'shared_just_now'/,
 'In the moment only includes verified live or recently shared tracks, not weekly lists');
assert.match(feed,/!!song\?\.trim\(\) && !!artist\?\.trim\(\)/,
 'Never display a missing-track listening card');
assert.match(feed,/activeMusicPeople\.length\s*>\s*0\s*&&\s*\(/,
 'Do not show a sparse Who\'s Here section when no music is actually playing');
assert.match(feed,/activeMusicPeople.map/,
 'Only verified listening candidates should be rendered in the presence row');

assert.match(chat,/const \[searchOpen,setSearchOpen\]/,'Chat search control required');
assert.match(chat,/visibleMessages=needle/,'Chat search must filter loaded history');
assert.match(chat,/visibleMessages\.map/,'Chat search filter must affect results');
assert.match(groupInfo,/Search messages →/,'Group details should expose chat search');
assert.match(groupInfo,/search:'1'/,'Group search opens the chat search state');
assert.match(newGroup,/select\('user_id,username,display_name,avatar_url'\)/,
 'New Group @search must query full member directory, not only mutuals');
assert.match(newGroup,/eq\('onboarding_complete',true\)/,
 'Do not display half-created member accounts');
assert.match(newGroup,/!hidden\.has\(member\.user_id\)/,
 'Group search must exclude blocked relationships');
assert.match(newGroup,/const canAdd=mutualIds\.has\(item\.id\)/,
 'Selecting someone to add is restricted to mutual followers');
assert.match(newGroup,/Follow each other to add/,
 'Non-mutual people can be found but must not be invited silently');
assert.match(newGroup,/colors\.text/,
 'New Group search results must explicitly respect the current theme');

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
assert.match(myProfile,/post\.post_kind!=='aux_prompt'/,
 'Own profile must not show empty music art on Aux prompts');
assert.match(memberProfile,/post\.post_kind==='aux_prompt' \|\| post\.post_kind==='daily_drop'/,
 'Viewed member profile must suppress the fake music card for both question post kinds');
assert.match(activity,/post_kind==='aux_prompt' \|\| item\.post\.post_kind==='daily_drop'/,
 'Saved and liked question posts should show the actual question, not a fake song');

assert.match(feed,/REPLY WITH A SONG/,
 'Official questions must lead to existing Song Reply conversations');
for (const [file,source] of [['Home',feed],['thread',thread],['own profile',myProfile],['member profile',memberProfile],['saved activity',activity]]){
 assert.doesNotMatch(source,/\bTHE AUX\b/i,file+' must not advertise a second feature name');
}

console.log('Previously requested features regression contract passed');
