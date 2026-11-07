import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../supabase';
import { isInNearbyArea, resolveCity } from '../city-locations';
import { distanceMiles } from '../world-cities';
import { sharedTasteNames, type TasteEvidence } from '../music-taste-evidence';
import { musicSuggestionSeeds, selectSuggestedPosts, type SuggestedPost } from '../music-suggestion-signals';

type Profile = { user_id: string | null; display_name: string | null; username: string | null; avatar_url: string | null; city: string | null; city_lat: number | null; city_lon: number | null; nearby_visible: boolean };
type Post = { id: string; user_id: string; artist_name: string; song_title: string; artwork_url: string | null; created_at: string; collection: { title?: string } | null; music_items: { song?: string; artist?: string }[] | null };
type Trend = { artist: string; count: number; listeners: number };
type SongTrend = { song: string; artist: string; count: number; listeners: number };
type Person = Profile & { sharedArtists: string[]; sharedScore: number; isFollowing: boolean; recentArtist: string | null };

const green = '#39E75F';
const norm = (s: string) => s.trim().toLocaleLowerCase();

export default function NearbyScreen() {
  const [city, setCity] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [songTrends, setSongTrends] = useState<SongTrend[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [forYouPosts,setForYouPosts] = useState<SuggestedPost<Post>[]>([]);
  const [tab, setTab] = useState<'nearby' | 'following'>('nearby');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/login'); return; }
      setMyId(user.id);
      const [mine, profilesResult, followResult, blockResult, blockedByResult, myDnaResult, selectedArtistResult, selectedTrackResult, myTasteResult] = await Promise.all([
        supabase.from('profiles').select('city,city_lat,city_lon').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('user_id,display_name,username,avatar_url,city,city_lat,city_lon,nearby_visible').eq('nearby_visible',true).limit(500),
        supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('user_blocks').select('blocker_id').eq('blocked_id', user.id),
        supabase.from('music_dna').select('top_artists').eq('user_id', user.id).maybeSingle(),
        supabase.from('music_import_artists').select('artist').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200),
        supabase.from('music_import_tracks').select('artist').eq('user_id',user.id).order('created_at',{ascending:false}).limit(300),
        supabase.from('music_taste_artists').select('artist_key,artist_name,source,song_count,playlist_count,share_for_matching').eq('user_id',user.id).limit(400),
      ]);
      if (mine.error) throw mine.error;
      if (profilesResult.error) throw profilesResult.error;
      const myCity = (mine.data?.city || '').trim();
      setCity(myCity);
      const followingIds = (followResult.data || []).map(row => row.following_id).filter(id => !new Set([
        ...(blockResult.data || []).map(row => row.blocked_id),
        ...(blockedByResult.data || []).map(row => row.blocker_id),
      ]).has(id));
      if (followingIds.length) {
        const followedResult = await supabase.from('posts')
          .select('id,user_id,artist_name,song_title,artwork_url,created_at,collection,music_items')
          .in('user_id', followingIds.slice(0, 100))
          .order('created_at', { ascending: false }).limit(40);
        if (followedResult.error) console.log('Following music posts:', followedResult.error.message);
        setFollowingPosts((followedResult.data || []) as Post[]);
      } else setFollowingPosts([]);
      if (!myCity) { setPeople([]); setTrends([]); setSongTrends([]); setRecentPosts([]); setForYouPosts([]); return; }
      const excluded = new Set<string>([
        user.id,
        ...(blockResult.data || []).map(row => row.blocked_id),
        ...(blockedByResult.data || []).map(row => row.blocker_id),
      ]);
      const userCity = mine.data?.city_lat != null && mine.data?.city_lon != null
        ? { lat: mine.data.city_lat, lon: mine.data.city_lon }
        : resolveCity(myCity);
      const localProfiles = ((profilesResult.data || []) as Profile[])
        .filter(p => {
          if (!p.user_id || !p.nearby_visible || excluded.has(p.user_id)) return false;
          const otherCity = p.city_lat != null && p.city_lon != null
            ? { lat: p.city_lat, lon: p.city_lon }
            : resolveCity(p.city || '');
          if (userCity && otherCity) return distanceMiles(userCity, otherCity) <= 35;
          return isInNearbyArea(p.city || '', myCity, 35);
        });
      const ids = localProfiles.map(p => p.user_id!) as string[];
      if (!ids.length) { setPeople([]); setTrends([]); setSongTrends([]); setRecentPosts([]); setForYouPosts([]); return; }

      // Only public posts exposed under the existing posts RLS policy are used.
      // This is posted music, not inferred real-time playback.
      const [postsResult, dnaResult, sharedTasteResult] = await Promise.all([
        supabase.from('posts')
          .select('id,user_id,artist_name,song_title,artwork_url,created_at,collection,music_items')
          .in('user_id', ids).order('created_at', { ascending: false }).limit(200),
        supabase.from('music_dna').select('user_id,top_artists').in('user_id', ids),
        supabase.from('music_taste_artists').select('user_id,artist_key,artist_name,source,song_count,playlist_count,share_for_matching').in('user_id',ids).eq('share_for_matching',true).limit(3000),
      ]);
      if (postsResult.error) throw postsResult.error;
      const posts = (postsResult.data || []) as Post[];
      // Private reviewed picks can recommend public conversations without
      // claiming the user has listened to those artists. Never publish these
      // seeds or add them to public shared-artist compatibility.
      const chosenArtists=(selectedArtistResult.data||[]).map(row=>row.artist);
      const chosenTracks=(selectedTrackResult.data||[]).map(row=>({artist:row.artist}));
      const ownDnaArtists=((myDnaResult.data?.top_artists||[]) as {name:string}[]).map(row=>row.name);
      const favoriteSeeds=(myTasteResult.data||[]).filter(row=>row.source==='favorite').map(row=>row.artist_name);
      const strongPlaylistSeeds=(myTasteResult.data||[]).filter(row=>row.source==='playlist'&&row.song_count>=4).map(row=>row.artist_name);
      const moderatePlaylistSeeds=(myTasteResult.data||[]).filter(row=>row.source==='playlist'&&row.song_count>=2&&row.song_count<4).map(row=>row.artist_name);
      const weakPlaylistSeeds=(myTasteResult.data||[]).filter(row=>row.source==='playlist'&&row.song_count<2).map(row=>({artist:row.artist_name}));
      const seeds=musicSuggestionSeeds([...moderatePlaylistSeeds,...chosenArtists],[...weakPlaylistSeeds,...chosenTracks],[...favoriteSeeds,...strongPlaylistSeeds,...ownDnaArtists]);
      setForYouPosts(selectSuggestedPosts(posts,seeds,6));
      const following = new Set((followResult.data || []).map(row => row.following_id));
      const myArtists = new Set(((myDnaResult.data?.top_artists || []) as { name: string }[]).map(a => norm(a.name)));
      const ownTaste=(myTasteResult.data||[]) as TasteEvidence[];
      const tasteByUser=new Map<string,TasteEvidence[]>();
      for(const row of sharedTasteResult.data||[]){
        const list=tasteByUser.get(row.user_id)||[];
        list.push(row as TasteEvidence);
        tasteByUser.set(row.user_id,list);
      }
      const dnaById = new Map<string, { top_artists: { name: string }[] }>(
        (dnaResult.data || []).map(row => [row.user_id, { top_artists: (row.top_artists || []) as { name: string }[] }])
      );
      setPeople(localProfiles.map(p => {
        const artists = (dnaById.get(p.user_id!)?.top_artists || [])
          .map(a => a.name).filter(name => !!name && myArtists.has(norm(name))).slice(0, 3);
        const weighted=sharedTasteNames(ownTaste,tasteByUser.get(p.user_id!)||[],3);
        const combined=[...weighted.map(x=>x.name),...artists.filter(name=>
          !weighted.some(w=>norm(w.name)===norm(name)))].slice(0,3);
        return {
          ...p,
          sharedArtists: combined,
          sharedScore: weighted.reduce((sum,x)=>sum+x.score,0)+artists.length*3,
          isFollowing: following.has(p.user_id),
          recentArtist: posts.find(post => post.user_id === p.user_id)?.artist_name || null,
        };
      }).sort((a, b) => b.sharedScore - a.sharedScore || b.sharedArtists.length - a.sharedArtists.length
        || Number(b.isFollowing) - Number(a.isFollowing)
        || (a.display_name || '').localeCompare(b.display_name || '')));
      const counts = new Map<string, { name: string; posts: Set<string>; listeners: Set<string> }>();
      const songCounts = new Map<string, { song: string; artist: string; posts: Set<string>; listeners: Set<string> }>();
      for (const post of posts) {
        const artistNames = new Set([
          post.artist_name,
          ...((Array.isArray(post.music_items) ? post.music_items : []).map(item => item.artist || '')),
        ].map(s => s.trim()).filter(Boolean));
        const songs = new Map<string, { song: string; artist: string }>();
        for (const item of [{ song: post.song_title, artist: post.artist_name }, ...(Array.isArray(post.music_items) ? post.music_items : [])]) {
          const song = (item.song || '').trim();
          const artist = (item.artist || '').trim();
          if (!song || !artist) continue;
          songs.set(norm(artist) + '::' + norm(song), { song, artist });
        }
        for (const [key, item] of songs) {
          if (!songCounts.has(key)) songCounts.set(key, { ...item, posts: new Set(), listeners: new Set() });
          songCounts.get(key)!.posts.add(post.id);
          songCounts.get(key)!.listeners.add(post.user_id);
        }
        for (const name of artistNames) {
          const key = norm(name);
          if (!counts.has(key)) counts.set(key, { name, posts: new Set(), listeners: new Set() });
          counts.get(key)!.posts.add(post.id);
          counts.get(key)!.listeners.add(post.user_id);
        }
      }
      setTrends([...counts.values()].map(x => ({
        artist: x.name, count: x.posts.size, listeners: x.listeners.size,
      })).sort((a,b) => b.count - a.count || b.listeners - a.listeners).slice(0, 12));
      setSongTrends([...songCounts.values()].map(x => ({ song: x.song, artist: x.artist, count: x.posts.size, listeners: x.listeners.size }))
        .sort((a,b) => b.count-a.count || b.listeners-a.listeners).slice(0, 8));
      setRecentPosts(posts.slice(0, 12));
    } catch (e: any) {
      console.log('Nearby discovery error:', e);
      setError('Could not load nearby music. Tap to try again.');
    } finally { setBusy(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setBusy(true); void load(); }, [load]));
  const shown = tab === 'following' ? people.filter(p => p.isFollowing) : people;
  const openProfile = (p: Profile) => p.user_id && router.push({ pathname: '/profile', params: { userId: p.user_id } });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={green} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.top}>OVRLEE / NEARBY</Text>
          <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button">
            <Text style={styles.cityEdit}>EDIT CITY</Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>MUSIC IS LOCAL</Text>
        <Text style={styles.title}>Around you.</Text>
        <Text style={styles.subtitle}>{city || 'Your city'} · Discover what your community is sharing.</Text>
        <Text style={styles.notice}>Approximate 35-mile (56 km) vicinity around your selected city, including other nearby towns. Based on opt-in profile cities and posted music—not GPS or live listening.</Text>
        <View style={styles.tabs}>
          <Pressable onPress={() => router.push('/now')} style={styles.tab}><Text style={styles.tabOff}>FOR YOU</Text></Pressable>
          <Pressable onPress={() => setTab('nearby')} style={[styles.tab, tab === 'nearby' && styles.tabActive]}>
            <Text style={tab === 'nearby' ? styles.tabOn : styles.tabOff}>NEARBY</Text>
          </Pressable>
          <Pressable onPress={() => setTab('following')} style={[styles.tab, tab === 'following' && styles.tabActive]}>
            <Text style={tab === 'following' ? styles.tabOn : styles.tabOff}>FOLLOWING</Text>
          </Pressable>
        </View>
        {busy && <ActivityIndicator color={green} style={{ marginTop: 35 }} />}
        {!!error && <Pressable onPress={() => { setBusy(true); void load(); }} style={styles.empty}><Text style={styles.error}>{error}</Text></Pressable>}
        {!busy && !error && !city && tab === 'nearby' && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Choose your city.</Text>
            <Text style={styles.muted}>Add a city to your profile to discover music and people sharing from the same area.</Text>
            <Pressable onPress={() => router.push('/edit-profile')} style={styles.button}><Text style={styles.buttonText}>SET MY CITY →</Text></Pressable>
          </View>
        )}
        {!busy && !error && (!!city || tab === 'following') && <>
          {tab === 'nearby' && forYouPosts.length>0 && <>
            <Text style={styles.section}>FOR YOUR EARS</Text>
            <Text style={styles.helper}>Music conversations you might enjoy, inspired by artists you've picked or connected. These are suggestions, not listening-history claims.</Text>
            {forYouPosts.map(item=>(
              <Pressable key={item.post.id} style={styles.post} accessibilityRole="button"
                accessibilityLabel={'Explore '+item.matchingArtist+' music post'}
                onPress={()=>router.push({pathname:'/post',params:{postId:item.post.id}})}>
                {item.post.artwork_url ? <Image source={{uri:item.post.artwork_url}} style={styles.art}/> :
                  <View style={[styles.art,styles.avatarEmpty]}><Text style={{color:green,fontSize:23}}>♫</Text></View>}
                <View style={{flex:1}}>
                  <Text style={styles.trendName} numberOfLines={1}>{item.post.collection?.title || item.post.song_title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{item.matchingArtist} · shared by someone nearby</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </>}
          {tab === 'nearby' && <>
            <Text style={styles.section}>SHARED AROUND {city.toUpperCase()}</Text>
            <Text style={styles.helper}>Artists in recent posts and collections within about 35 miles.</Text>
            {trends.length ? trends.map((trend, index) => (
              <Pressable key={trend.artist} style={styles.trend} onPress={() => router.push({ pathname: '/music-discovery', params: { artist: trend.artist } })}>
                <Text style={styles.rank}>{String(index + 1).padStart(2,'0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendName}>{trend.artist}</Text>
                  <Text style={styles.muted}>{trend.count} {trend.count === 1 ? 'post' : 'posts'} · {trend.listeners} {trend.listeners === 1 ? 'listener' : 'listeners'} sharing</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No music has been posted by members in your vicinity yet.</Text>}
          </>}
          {tab === 'following' && <>
            <Text style={styles.section}>MUSIC FROM PEOPLE YOU FOLLOW</Text>
            {followingPosts.map(post => (
              <Pressable key={post.id} style={styles.post} onPress={() => router.push({ pathname: '/post', params: { postId: post.id } })}>
                {post.artwork_url ? <Image source={{ uri: post.artwork_url }} style={styles.art} /> : <View style={[styles.art, styles.avatarEmpty]}><Text style={{ color: green, fontSize: 23 }}>♫</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendName} numberOfLines={1}>{post.collection?.title || post.song_title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{post.artist_name || 'Collection'} · Following</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
            {!followingPosts.length && <Text style={styles.emptyText}>Follow listeners to see what they share.</Text>}
          </>}
          {tab === 'nearby' && <>
            <Text style={styles.section}>SONGS BEING SHARED</Text>
            <Text style={styles.helper}>Ranked by recent local posts, not inferred playback.</Text>
            {songTrends.map((item, index) => (
              <Pressable key={item.artist + item.song} style={styles.trend}
                onPress={() => router.push({ pathname: '/music-discovery', params: { artist: item.artist, song: item.song } })}>
                <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendName} numberOfLines={1}>{item.song}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{item.artist} · {item.count} {item.count === 1 ? 'post' : 'posts'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
            {!songTrends.length && <Text style={styles.emptyText}>Songs will appear as people share music in your city.</Text>}
          </>}
          <Text style={styles.section}>{tab === 'following' ? 'PEOPLE YOU FOLLOW IN YOUR CITY' : 'MUSIC PEOPLE NEAR YOU'}</Text>
          <Text style={styles.helper}>Shared artists are shown by name, never as a compatibility percentage.</Text>
          {shown.map(person => (
            <View key={person.user_id} style={styles.personCard}>
              <Pressable style={styles.personInfo} onPress={() => openProfile(person)}>
                {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> :
                  <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.initial}>{(person.display_name || person.username || '?')[0].toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{person.display_name || 'Listener'}</Text>
                  <Text style={styles.handle}>@{person.username || 'listener'}</Text>
                  {!!person.sharedArtists.length && <Text style={styles.shared}>You both like {person.sharedArtists.join(' · ')}</Text>}
                  {!person.sharedArtists.length && !!person.recentArtist && <Text style={styles.shared}>Recently posted {person.recentArtist}</Text>}
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Message ${person.display_name || person.username || 'listener'}`}
                onPress={() => router.push({ pathname: '/chat', params: { userId: person.user_id! } })}
                style={styles.messageButton}><Text style={styles.messageText}>CHAT</Text></Pressable>
            </View>
          ))}
          {!shown.length && <Text style={styles.emptyText}>{tab === 'following' ? 'You are not following anyone in this city yet.' : 'No other members are sharing from your vicinity yet.'}</Text>}
          {tab === 'nearby' && !!recentPosts.length && <>
            <Text style={styles.section}>RECENTLY SHARED HERE</Text>
            {recentPosts.map(post => (
              <Pressable key={post.id} style={styles.post} onPress={() => router.push({ pathname: '/post', params: { postId: post.id } })}>
                {post.artwork_url ? <Image source={{ uri: post.artwork_url }} style={styles.art} /> : <View style={[styles.art, styles.avatarEmpty]}><Text style={{ color: green, fontSize: 23 }}>♫</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendName} numberOfLines={1}>{post.collection?.title || post.song_title}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{post.artist_name || 'Collection'} · shared in {city}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </>}
          <Pressable onPress={() => router.push('/concerts')} style={styles.button}><Text style={styles.buttonText}>EXPLORE CONCERTS ON RADAR →</Text></Pressable>
        </>}
      </ScrollView>
      <BottomNav active="now" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 20, paddingBottom: 120 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 30 },
  top: { color:'#aaa', letterSpacing:1.5, fontSize:11, fontWeight:'900' },
  back: { color:'#fff', fontSize:34 }, cityEdit: { color:green, fontWeight:'900', fontSize:10 },
  eyebrow: { color:green, fontSize:10, fontWeight:'900', letterSpacing:2 },
  title: { color:'#fff', fontSize:34, fontWeight:'900', marginTop:9 },
  subtitle: { color:'#ddd', fontSize:14, marginTop:8 },
  notice: { color:'#777', fontSize:11, lineHeight:17, marginTop:10 },
  tabs: { flexDirection:'row', marginTop:25, borderBottomWidth:1, borderBottomColor:'#333' },
  tab: { flex:1, alignItems:'center', paddingVertical:15 },
  tabActive: { borderBottomColor:green, borderBottomWidth:2 },
  tabOff: { color:'#777', fontSize:11, fontWeight:'900' },
  tabOn: { color:'#fff', fontSize:11, fontWeight:'900' },
  section: { color:'#fff', fontWeight:'900', fontSize:15, marginTop:28, marginBottom:8, letterSpacing:0.5 },
  helper: { color:'#777', fontSize:11, marginBottom:12 },
  trend: { flexDirection:'row', alignItems:'center', paddingVertical:14, borderBottomColor:'#252525', borderBottomWidth:1, gap:16 },
  rank: { color:green, fontSize:13, fontWeight:'900', width:25 },
  trendName: { color:'#fff', fontSize:14, fontWeight:'900' },
  muted: { color:'#888', fontSize:11, marginTop:4, lineHeight:17 },
  chevron: { color:green, fontSize:23 },
  personCard: { flexDirection:'row', alignItems:'center', padding:12, marginBottom:10, backgroundColor:'#121212', borderWidth:1,borderColor:'#262626',borderRadius:15 },
  personInfo: { flex:1, flexDirection:'row', gap:12, alignItems:'center' },
  avatar: { width:50, height:50, borderRadius:25 },
  avatarEmpty: { backgroundColor:'#18351D', alignItems:'center', justifyContent:'center' },
  initial: { color:'#fff', fontWeight:'900', fontSize:18 },
  name: { color:'#fff', fontWeight:'900', fontSize:14 },
  handle: { color:'#aaa', fontSize:11, marginTop:3 },
  shared: { color:'#80DD90', fontSize:11, marginTop:6 },
  messageButton: { padding:10, borderWidth:1, borderColor:'#325838', borderRadius:10, marginLeft:9 },
  messageText: { color:green, fontSize:10, fontWeight:'900' },
  post: { flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#222', gap:12 },
  art: { width:49,height:49,borderRadius:8 },
  empty: { backgroundColor:'#151515', borderRadius:16, padding:20,marginTop:20 },
  error: { color:'#FFB9B9', fontSize:13 },
  emptyTitle: { color:'#fff', fontSize:18, fontWeight:'900', marginBottom:8 },
  emptyText: { color:'#888', fontSize:13, lineHeight:18, marginTop:10,marginBottom:10 },
  button: { backgroundColor:green, borderRadius:12,padding:15,alignItems:'center',marginTop:30 },
  buttonText: { color:'#050505', fontSize:12,fontWeight:'900' },
});
