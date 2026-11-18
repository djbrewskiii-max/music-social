import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static regression guard only. Two-account hosted Supabase RLS tests remain
// required before TestFlight; this does not impersonate another user.
const sql=readFileSync(new URL('../supabase/migrations/20261118022425_harden_message_report_conversation_membership.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/message-reporting.ts',import.meta.url),'utf8');
assert.match(sql,/ALTER POLICY "Participants may report received messages"/);
assert.match(sql,/m\.id\s*=\s*message_reports\.message_id/);
assert.match(sql,/m\.sender_id\s*=\s*message_reports\.reported_user_id/);
assert.match(sql,/m\.conversation_id\s*=\s*message_reports\.conversation_id/,
  'Report conversation_id must refer to the user-supplied report row, not to the messages table twice');
assert.match(sql,/reporter_id\s*=\s*\(select auth\.uid\(\)\)/);
assert.match(sql,/NOT c\.is_group/);
assert.match(sql,/public\.ovrlee_is_group_member\(c\.id\)/);
assert.doesNotMatch(sql,/m\.conversation_id\s*=\s*conversation_id\b/,
  'Ambiguous column names silently cause self-equality in SQL policies');
assert.match(app,/from\('message_reports'\)\.insert/);
assert.match(app,/reporter_id:user\.id/);
assert.match(app,/conversation_id:conversationId/);
console.log('Message-report policy regression checks passed (static; hosted two-account QA still required)');
