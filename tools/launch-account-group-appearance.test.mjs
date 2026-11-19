import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261119000500_onboarding_completion_group_controls.sql',import.meta.url),'utf8');
const theme=read('theme-style.ts'),palette=read('appearance.tsx');
const city=read('components/WorldCityPicker.tsx');
const nav=read('components/BottomNav.tsx');
const feed=read('app/now.tsx');
const collection=read('components/CollectionPreview.tsx');
const collectionArtists=read('components/CollectionArtistDiscoveryLinks.tsx');
const post=read('app/post.tsx'),profile=read('app/profile.tsx');
const myProfile=read('app/my-profile.tsx');
const index=read('app/index.tsx'),login=read('app/login.tsx');
const progress=read('onboarding-progress.ts');
const group=read('app/group-info.tsx'),chat=read('app/chat.tsx');
const inbox=read('app/messages.tsx');

assert.match(theme,/branddot/,'Green header dot must be protected in both modes');
assert.match(theme,/isStatus\(name\)/,'Status semantics must drive the theme');
assert.match(theme,/if\(status\)return \(textProp&&scheme==='light'/,
 'Status green text needs accessible light mode handling');
assert.match(palette,/preference==='system'/,'System, Light, Dark modes must be supported');
assert.match(city,/useAppearance\(\)/);
assert.match(city,/makeStyles\(scheme\)/);
assert.match(city,/StatusBar style=\{scheme==='light'\?'dark':'light'\}/);
assert.match(city,/backgroundColor:colors.background/,
 'Full-screen city modal must inherit current app appearance');
assert.match(nav,/backgroundColor:'#3B2218'/,'Light message badge must be dark chocolate');
assert.match(nav,/color:'#F0E5DF'/,'Light message count must be cream');
assert.match(feed,/styles.liveDot/,'Status dot is intentional, not a decorative palette color');

assert.match(collection,/CollectionArtistDiscoveryLinks items=\{items\}/);
assert.match(post,/CollectionArtistDiscoveryLinks items=\{itemsFromPost\(post\)\}/);
assert.match(feed,/!post.collection&&<PostArtistDiscoveryLink/,'No duplicate first artist');
assert.match(collectionArtists,/seen\.has\(key\)/,'Artist chips are unique');
assert.match(collectionArtists,/PostArtistDiscoveryLink/,'Shared music discovery behavior');

assert.match(myProfile,/key=\{userId\} authUserId=\{userId\}/,
 'Own profile state must be keyed to the authenticated account');
assert.match(myProfile,/profile\.user_id!==authUserId/,'Never show another account in My Profile');
assert.match(profile,/ProfileContent key=\{typeof userId==='string'\?userId:'invalid'\}/,
 'Viewing a new profile must remount state, not flash old data');
assert.match(login,/onboarding_complete===true/);
assert.match(index,/onboarding_complete===false/);
assert.match(progress,/update\(\{onboarding_complete:true\}\)/,
 'Completing the auth account is not completing signup');
assert.match(sql,/Members see finished profiles or their own setup/);

for(const fn of ['update_group_details','invite_group_members','set_group_permissions',
  'set_group_member_role','remove_group_member','leave_group_chat']){
 assert.match(sql,new RegExp('function public\\.'+fn+'\\('),fn+' is required on the server');
 assert.match(group,new RegExp("rpc\\('"+fn+"'"),fn+' must be used by the client');
}
assert.match(sql,/members_can_edit boolean not null default true/);
assert.match(sql,/members_can_invite boolean not null default true/);
assert.match(sql,/storage\.foldername\(name\)/,'Group photo uploads must be authenticated to an account folder');
assert.match(sql,/public\.is_blocked_with\(v_person\)/,'No invites across block boundaries');
assert.match(sql,/user_one IS NULL|p_conversation/,'Group management cannot mutate direct messages');
assert.match(chat,/pathname:'\/group-info'/);
assert.match(inbox,/avatarUrl: conversation\.image_url/);
assert.match(read('components/ProfileAvatar.tsx'),/if\(valid\)\{/,
 'Uploaded group images must render just like profile photos');

console.log('Account identity, theme semantics, group controls and collection discovery checks passed');
