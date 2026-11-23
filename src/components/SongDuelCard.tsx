import { useAppearance } from '../appearance';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { countDuelVotes, duelContenders, duelLeader, loadDuelVotes, loadMyDuelVote, voteInDuel, type DuelReply, type DuelVote } from '../song-duel';

/*
  Song Duel card — "Which one hit?" Two Song Replies, one vote each.
  Both songs stay visible and both vote counts are shown. The leader is
  "hitting hardest right now", never a winner over a loser. Only renders
  when a post has at least two Song Replies.
*/
export default function SongDuelCard({ postId, replies }: { postId: string; replies: DuelReply[] }) {
  const { colors } = useAppearance();
  const [votes, setVotes] = useState<DuelVote[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contenders = duelContenders(replies);
  const counts = countDuelVotes(votes);
  const leader = duelLeader(contenders, votes);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadDuelVotes(postId), loadMyDuelVote(postId)]).then(([all, mine]) => {
      if (!alive) return;
      setVotes(all);
      setMyVote(mine);
    });
    return () => { alive = false; };
  }, [postId]);

  if (contenders.length < 2) return null;

  const vote = async (replyId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await voteInDuel(postId, replyId);
      setMyVote(replyId);
      setVotes(await loadDuelVotes(postId));
    } catch (error) {
      console.log('Song Duel vote:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>SONG DUEL · WHICH ONE HIT?</Text>
      {contenders.map((reply) => {
        const count = counts[reply.id] || 0;
        const isLeader = leader?.id === reply.id;
        const isMine = myVote === reply.id;
        return (
          <Pressable
            key={reply.id}
            style={[styles.row, isMine && { borderColor: colors.accent, borderWidth: 1 }]}
            onPress={() => void vote(reply.id)}
            disabled={busy}
          >
            {reply.songArtworkUrl ? (
              <Image source={{ uri: reply.songArtworkUrl }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback, { backgroundColor: colors.surface }]}>
                <Text style={[styles.artFallbackText, { color: colors.secondary }]}>♫</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={[styles.song, { color: colors.text }]} numberOfLines={1}>{reply.songTitle}</Text>
              <Text style={[styles.artist, { color: colors.secondary }]} numberOfLines={1}>{reply.songArtist} · via {reply.displayName}</Text>
              <Text style={[styles.votes, { color: isLeader ? colors.accent : colors.secondary }]}>
                {count === 0 ? 'No votes yet' : `${count} ${count === 1 ? 'vote' : 'votes'}${isLeader ? ' · hitting hardest right now' : ''}${isMine ? ' · your pick' : ''}`}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.note, { color: colors.secondary }]}>Tap a song to vote. You can change your mind — one vote per person.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 8 },
  art: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  artFallback: { justifyContent: 'center', alignItems: 'center' },
  artFallbackText: { fontSize: 18 },
  rowText: { flex: 1 },
  song: { fontSize: 15, fontWeight: '700' },
  artist: { fontSize: 13, marginTop: 2 },
  votes: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
