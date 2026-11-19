import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261119235500_group_message_push_and_mute.sql');
const details=read('src/app/group-info.tsx');

assert.match(migration,/notifications_muted boolean not null default false/);
assert.match(migration,/function public\.set_group_muted\(/);
assert.match(migration,/cm\.user_id=v_uid/,
  'Only a member may toggle their own mute choice');
assert.match(migration,/c\.is_group/,
  'Mute must never alter a one-to-one direct conversation');
assert.match(migration,/revoke all on function public\.set_group_muted\(uuid,boolean\) from public,anon/);
assert.match(migration,/grant execute on function public\.set_group_muted\(uuid,boolean\) to authenticated/);

assert.match(migration,/if c\.is_group then/);
assert.match(migration,/from public\.conversation_members cm/,
  'Send group notifications to members, not the missing direct recipient columns');
assert.match(migration,/not cm\.notifications_muted/);
assert.match(migration,/cm\.user_id<>new\.sender_id/);
assert.match(migration,/private\.should_notify\(member\.user_id,new\.sender_id,member\.setting\)/,
  'Group pushes must continue to honor block, mute-account, and global notification preferences');
assert.match(migration,/conversationId',c\.id::text/);
assert.match(migration,/\/chat\?id=/,
  'Group push must open the group chat, not a direct message with the sender');
assert.match(migration,/recipient:=case when c\.user_one=new\.sender_id/,
  'Existing direct-message delivery must remain intact');
assert.match(details,/select\('user_id,role,joined_at,notifications_muted'\)/,
  'Mute setting must persist across reopens');
assert.match(details,/rpc\('set_group_muted'/);
assert.match(details,/accessibilityLabel="Mute group notifications"/);
assert.match(details,/accessibilityState=\{\{checked:muted,disabled:muteBusy\}\}/);
assert.match(details,/color:muted\?accent:sub/,
  'Group mute control must respect theme semantics');
console.log('Group push and per-member mute contract checks passed');
