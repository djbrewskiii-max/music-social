import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const direct=read('app/chat.tsx');
const inbox=read('app/messages.tsx');
const show=read('app/show-chat.tsx');
const feed=read('app/now.tsx');
const detail=read('app/post.tsx');

// A query failure must not silently render an empty message thread.
assert.match(direct,/if \(messagesError\) \{[\s\S]*?setHistoryError\(/,
  'DM read failure must show an actionable error');
assert.match(direct,/Retry loading conversation/,
  'DM history needs a retry button');
assert.match(direct,/messages\.length === 0 && !historyError/,
  'DM history failure cannot say the conversation is empty');
assert.match(direct,/disabled=\{\(!message\.trim\(\) && !staged\) \|\| !conversationId \|\| sending \|\| !!historyError\}/,
  'Do not allow a send before successful history validation');

// Synchronous duplicate-send guard and draft restoration.
assert.match(direct,/sendInFlight\.current = true/);
assert.match(direct,/finally \{\s*sendInFlight\.current = false/);
assert.match(direct,/setMessage\(typed\);\s*Alert\.alert/,
  'Restore text draft if DM insertion fails');
assert.match(direct,/if \(leaveError\) \{\s*Alert\.alert/,
  'Leaving a group must not silently navigate away on failure');

// Inbox should reload on screen focus, but not duplicate the initial query.
assert.match(inbox,/useFocusEffect\(/);
assert.doesNotMatch(inbox,/const start = async \(\) => \{\s*setLoading\(true\);\s*await loadInbox\(\)/,
  'Do not fetch the inbox twice on first screen mount');
assert.match(inbox,/if \(messageResult\.error\) throw messageResult\.error;/,
  'Do not silently treat a failed inbox message query as no messages');
assert.match(inbox,/Retry loading messages/);

// Concert chat: repeated send taps are gated; draft only clears after insert.
assert.match(show,/sendInFlight\.current\|\|!myId/);
assert.match(show,/if\(e\)throw e;\s*setDraft\(''\)/);
assert.match(show,/finally\{\s*sendInFlight\.current=false;/);
assert.match(show,/Sent, but the conversation could not refresh/,
  'Avoid prompting a second send after a successful insert followed by a failed refresh');

// The feed offers one canonical thread, not a disconnected quick-reply composer.
assert.match(feed,/pathname: '\/post',[\s\S]*?postId/);
assert.doesNotMatch(feed,/sendQuickReply|startQuickReply|quickReplyOpen/,
  'Remove unconnected quick-reply logic');
assert.match(detail,/parent_reply_id:replyTo\?\.id\|\|null/,
  'Opened post must preserve nested reply context');
console.log('Conversation and reply reliability source regression checks passed');
