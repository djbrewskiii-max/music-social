import { supabase } from './supabase';

/*
  Song Duel — a friendly "which one hit?" on a post with at least two
  Song Replies. No losers, no scoreboard shaming: both songs stay visible,
  the one with more votes is simply "hitting hardest right now", and a
  tie goes to the earliest reply. One vote per person per post; changing
  your mind replaces your vote. The duel is derived from the replies and
  the votes — no new post type, no new composer.
  See docs/song-duel-taste-twin-v1.md.
*/

export type DuelReply = {
  id: string;
  userId: string;
  displayName: string;
  songTitle: string;
  songArtist: string;
  songArtworkUrl: string | null;
  createdAt: string;
};

export type DuelVote = { reply_id: string; user_id: string };

export function duelContenders(replies: DuelReply[]): DuelReply[] {
  return replies.filter((r) => r.songTitle && r.songArtist).slice(0, 2);
}

export function countDuelVotes(votes: DuelVote[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const vote of votes) counts[vote.reply_id] = (counts[vote.reply_id] || 0) + 1;
  return counts;
}

/** The reply hitting hardest right now, or null on a tie / no votes. */
export function duelLeader(contenders: DuelReply[], votes: DuelVote[]): DuelReply | null {
  if (contenders.length < 2) return null;
  const counts = countDuelVotes(votes);
  const [a, b] = contenders;
  const aVotes = counts[a.id] || 0;
  const bVotes = counts[b.id] || 0;
  if (aVotes === bVotes) return null;
  return aVotes > bVotes ? a : b;
}

export async function loadDuelVotes(postId: string): Promise<DuelVote[]> {
  const { data, error } = await supabase
    .from('song_duel_votes')
    .select('reply_id, user_id')
    .eq('post_id', postId);
  if (error) { console.log('Song Duel votes:', error.message); return []; }
  return (data as DuelVote[]) || [];
}

export async function loadMyDuelVote(postId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('song_duel_votes')
    .select('reply_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) { console.log('Song Duel my vote:', error.message); return null; }
  return (data as { reply_id: string } | null)?.reply_id || null;
}

/** Cast or change a vote. One vote per person per post (see migration). */
export async function voteInDuel(postId: string, replyId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to vote.');
  const { error } = await supabase
    .from('song_duel_votes')
    .upsert({ post_id: postId, reply_id: replyId, user_id: user.id }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}
