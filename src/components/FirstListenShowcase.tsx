import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isOpen, ReleaseRoom } from '../first-listen';
import { RankedRoom } from '../release-radar';
import { FirstListenFeed } from '../use-first-listen-feed';

const GREEN = '#39E75F';

const openRoom = (roomId: string) => router.push({ pathname: '/first-listen', params: { roomId } });

const shortDate = (room: ReleaseRoom) => {
  const [y, m, d] = room.release_date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function Countdown({ opensAt, now }: { opensAt: string; now: number }) {
  const ms = Math.max(0, new Date(opensAt).getTime() - now);
  const totalMinutes = Math.floor(ms / 60000);
  const blocks = [
    { value: Math.floor(totalMinutes / 1440), label: 'DAYS' },
    { value: Math.floor((totalMinutes % 1440) / 60), label: 'HRS' },
    { value: totalMinutes % 60, label: 'MIN' },
  ];
  return (
    <View style={styles.countdown}>
      {blocks.map((block) => (
        <View key={block.label} style={styles.countBlock}>
          <Text style={styles.countValue}>{String(block.value).padStart(2, '0')}</Text>
          <Text style={styles.countLabel}>{block.label}</Text>
        </View>
      ))}
    </View>
  );
}

type Props = {
  feed: FirstListenFeed;
  showSeeAll?: boolean;
};

export default function FirstListenShowcase({ feed, showSeeAll = true }: Props) {
  const now = useNow();
  const { comingSoon, outNow, summaries, loading, scanning, setFollowing } = feed;

  // The hero is the drop this person would care about most:
  // something out today if it's theirs, otherwise their top upcoming album.
  const freshForYou = outNow.find(
    (r) => (r.reason || summaries[r.room.id]?.i_follow) && now - new Date(r.room.opens_at).getTime() < 2 * 86400000
  );
  const hero: RankedRoom | undefined = freshForYou || comingSoon[0] || outNow[0];
  const upcomingShelf = comingSoon.filter((r) => r.room.id !== hero?.room.id).slice(0, 15);
  const outShelf = outNow.filter((r) => r.room.id !== hero?.room.id).slice(0, 15);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>FIRST LISTEN</Text>
        <ActivityIndicator color={GREEN} style={{ marginVertical: 40 }} />
      </View>
    );
  }

  if (!hero) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>FIRST LISTEN</Text>
        <Text style={styles.heading}>The next drop.</Text>
        <Pressable onPress={() => router.push('/releases')} style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{scanning ? 'Checking your artists for new music…' : 'No drops on the calendar yet.'}</Text>
          <Text style={styles.emptyText}>
            Add albums to your Core Four and pin songs to your rotation, and OVRLEE will find your artists' next releases.
            You can also search any upcoming album.
          </Text>
          <Text style={styles.emptyCta}>FIND AN ALBUM →</Text>
        </Pressable>
      </View>
    );
  }

  const heroOpen = isOpen(hero.room);
  const heroSummary = summaries[hero.room.id];
  const heroFollowing = !!heroSummary?.i_follow;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>FIRST LISTEN</Text>
          <Text style={styles.heading}>{heroOpen ? 'Out now.' : 'The next drop.'}</Text>
        </View>
        {scanning && <ActivityIndicator color={GREEN} size="small" />}
      </View>

      <Pressable onPress={() => openRoom(hero.room.id)} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
        <ImageBackground
          source={hero.room.artwork_url ? { uri: hero.room.artwork_url } : undefined}
          blurRadius={40}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />
          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <View style={[styles.statusPill, heroOpen && styles.statusLive]}>
                {heroOpen && <View style={styles.liveDot} />}
                <Text style={[styles.statusText, heroOpen && styles.statusTextLive]}>
                  {heroOpen ? 'ROOM IS LIVE' : `OUT ${shortDate(hero.room)}`}
                </Text>
              </View>
              {!!heroSummary?.waiting && !heroOpen && <Text style={styles.waiting}>{heroSummary.waiting} waiting</Text>}
            </View>

            {hero.room.artwork_url ? (
              <Image source={{ uri: hero.room.artwork_url }} style={styles.heroArt} />
            ) : (
              <View style={[styles.heroArt, styles.artFallback]} />
            )}

            <Text style={styles.heroTitle} numberOfLines={2}>
              {hero.room.album_title}
            </Text>
            <Text style={styles.heroArtist} numberOfLines={1}>
              {hero.room.artist_name}
            </Text>
            {!!hero.reason && (
              <Text style={styles.reason} numberOfLines={1}>
                ✦ {hero.reason}
              </Text>
            )}

            {heroOpen ? (
              <Text style={styles.liveLine}>
                {heroSummary?.ratings
                  ? `${heroSummary.average_rating} avg · ${heroSummary.ratings} first impressions`
                  : 'Be one of the first critics.'}
              </Text>
            ) : (
              <Countdown opensAt={hero.room.opens_at} now={now} />
            )}

            <View style={styles.heroButtons}>
              {!heroOpen && (
                <Pressable
                  onPress={() => setFollowing(hero.room.id, !heroFollowing)}
                  style={[styles.secondary, heroFollowing && styles.secondaryOn]}
                >
                  <Text style={[styles.secondaryText, heroFollowing && styles.secondaryTextOn]}>
                    {heroFollowing ? '🔔 NOTIFYING' : 'NOTIFY ME'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => openRoom(hero.room.id)} style={styles.primary}>
                <Text style={styles.primaryText}>{heroOpen ? 'JOIN THE ROOM →' : 'ENTER ROOM →'}</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </Pressable>

      {upcomingShelf.length > 0 && (
        <>
          <Text style={styles.shelfTitle}>Coming soon for you</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {upcomingShelf.map(({ room, reason }) => {
              const following = !!summaries[room.id]?.i_follow;
              return (
                <Pressable key={room.id} onPress={() => openRoom(room.id)} style={styles.card}>
                  <View>
                    {room.artwork_url ? (
                      <Image source={{ uri: room.artwork_url }} style={styles.cardArt} />
                    ) : (
                      <View style={[styles.cardArt, styles.artFallback]} />
                    )}
                    <View style={styles.datePill}>
                      <Text style={styles.datePillText}>{shortDate(room)}</Text>
                    </View>
                    <Pressable
                      onPress={() => setFollowing(room.id, !following)}
                      hitSlop={8}
                      style={[styles.bellButton, following && styles.bellOn]}
                      accessibilityLabel={following ? 'Stop notifying' : 'Notify me when it drops'}
                    >
                      <Text style={styles.bellText}>{following ? '🔔' : '＋'}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {room.album_title}
                  </Text>
                  <Text style={styles.cardArtist} numberOfLines={1}>
                    {room.artist_name}
                  </Text>
                  {!!reason && (
                    <Text style={styles.cardReason} numberOfLines={2}>
                      {reason}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {outShelf.length > 0 && (
        <>
          <Text style={styles.shelfTitle}>Out this week</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
            {outShelf.map(({ room, reason }) => {
              const s = summaries[room.id];
              return (
                <Pressable key={room.id} onPress={() => openRoom(room.id)} style={styles.card}>
                  <View>
                    {room.artwork_url ? (
                      <Image source={{ uri: room.artwork_url }} style={styles.cardArt} />
                    ) : (
                      <View style={[styles.cardArt, styles.artFallback]} />
                    )}
                    <View style={[styles.datePill, styles.livePill]}>
                      <View style={styles.liveDotSmall} />
                      <Text style={[styles.datePillText, { color: '#000' }]}>LIVE</Text>
                    </View>
                    {!!s?.my_rating && (
                      <View style={styles.myScore}>
                        <Text style={styles.myScoreText}>{s.my_rating}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {room.album_title}
                  </Text>
                  <Text style={styles.cardArtist} numberOfLines={1}>
                    {room.artist_name}
                  </Text>
                  <Text style={styles.cardReason} numberOfLines={2}>
                    {s?.ratings ? `${s.average_rating} avg · ${s.ratings} ratings` : reason || 'Room is open'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {showSeeAll && (
        <Pressable onPress={() => router.push('/releases')} style={styles.seeAll}>
          <Text style={styles.seeAllText}>RELEASE CALENDAR & SEARCH  →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 30 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  heading: { color: '#ffffff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 },
  hero: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#111111' },
  heroImage: { borderRadius: 24, transform: [{ scale: 1.4 }] },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  heroInner: { padding: 20, alignItems: 'center' },
  heroTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusLive: { backgroundColor: GREEN, borderColor: GREEN },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  statusTextLive: { color: '#000000' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#000000', marginRight: 6 },
  waiting: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  heroArt: {
    width: 190,
    height: 190,
    borderRadius: 14,
    marginTop: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  artFallback: { backgroundColor: '#222222' },
  heroTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 18, letterSpacing: -0.5 },
  heroArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600', marginTop: 4 },
  reason: { color: GREEN, fontSize: 12, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  liveLine: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 16 },
  countdown: { flexDirection: 'row', gap: 10, marginTop: 18 },
  countBlock: {
    width: 74,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  countValue: { color: '#ffffff', fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  countLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 2 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  primary: { flex: 1, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  secondary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  secondaryOn: { borderColor: GREEN },
  secondaryText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  secondaryTextOn: { color: GREEN },
  shelfTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 28, marginBottom: 12 },
  shelf: { gap: 14, paddingRight: 10 },
  card: { width: 142 },
  cardArt: { width: 142, height: 142, borderRadius: 12 },
  datePill: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  livePill: { backgroundColor: GREEN },
  liveDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#000000', marginRight: 4 },
  datePillText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  bellButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellOn: { backgroundColor: 'rgba(17,34,21,0.95)', borderWidth: 1, borderColor: GREEN },
  bellText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  myScore: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myScoreText: { color: GREEN, fontSize: 12, fontWeight: '900' },
  cardTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800', marginTop: 9 },
  cardArtist: { color: '#999999', fontSize: 12, marginTop: 3 },
  cardReason: { color: '#6fbf7c', fontSize: 11, fontWeight: '700', marginTop: 5, lineHeight: 15 },
  seeAll: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#24412a',
    backgroundColor: '#0d150f',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  seeAllText: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  emptyCard: { borderWidth: 1, borderColor: '#24412a', backgroundColor: '#0d150f', borderRadius: 20, padding: 20, marginTop: 14 },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#9aa79c', fontSize: 13, lineHeight: 19, marginTop: 8 },
  emptyCta: { color: GREEN, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 14 },
});
