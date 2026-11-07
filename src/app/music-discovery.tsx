import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../supabase';
import { activityMusicSeeds, mergeMusicSeeds, musicSuggestionSeeds, selectSuggestedPosts } from '../music-suggestion-signals';

type Post = {
  id: string;
  user_id: string;
  body: string | null;
  song_title: string;
  artist_name: string;
  artwork_url: string | null;
  created_at: string;
  collection: { title?: string } | null;
};
type Person = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };

const green = '#39E75F';

export default function MusicDiscoveryScreen() {
  const params = useLocalSearchParams<{ artist?: string; song?: string }>();
  const artist = typeof params.artist === 'string' ? params.artist.trim().slice(0, 120) : '';
  const song = typeof params.song === 'string' ? params.song.trim().slice(0, 120) : '';
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [artistIdeas,setArtistIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // An unnamed discovery screen is a private, optional recommendation
      // experience; do not export seed artists or write to music_dna.
      if(!artist){
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError||!user){router.replace('/login');return;}
        const [selected,tracks,dna,publicPosts,taste,appActivity]=await Promise.all([
          supabase.from('music_import_artists').select('artist')
            .eq('user_id',user.id).order('created_at',{ascending:false}).limit(200),
          supabase.from('music_import_tracks').select('artist')
            .eq('user_id',user.id).order('created_at',{ascending:false}).limit(300),
          supabase.from('music_dna').select('top_artists')
            .eq('user_id',user.id).maybeSingle(),
          supabase.from('posts').select('id,user_id,body,song_title,artist_name,artwork_url,created_at,collection,music_items')
            .order('created_at',{ascending:false}).limit(300),
          supabase.from('music_taste_artists').select('artist_name,source,song_count').eq('user_id',user.id).limit(400),
          supabase.from('music_activity_artists').select('artist_name,posted_count,liked_count')
            .eq('user_id',user.id).order('last_activity_at',{ascending:false}).limit(300),
        ]);
        if(publicPosts.error)throw publicPosts.error;
        const known=((dna.data?.top_artists||[]) as {name:string}[]).map(t=>t.name);
        const favorites=(taste.data||[]).filter(x=>x.source==='favorite').map(x=>x.artist_name);
        const playlists=(taste.data||[]).filter(x=>x.source==='playlist'&&x.song_count>=1);
        const high=playlists.filter(x=>x.song_count>=4).map(x=>x.artist_name);
        const medium=playlists.filter(x=>x.song_count>=2&&x.song_count<4).map(x=>x.artist_name);
        const low=playlists.filter(x=>x.song_count<2).map(x=>({artist:x.artist_name}));
        const seeds=musicSuggestionSeeds(
          [...medium,...(selected.data||[]).map(t=>t.artist)],
          [...low,...(tracks.data||[]).map(t=>({artist:t.artist}))],
          [...favorites,...high,...known],20,
        );
        const combinedSeeds=mergeMusicSeeds(seeds,activityMusicSeeds(appActivity.data||[])).slice(0,50);
        setArtistIdeas(combinedSeeds.slice(0,20).map(s=>s.name));
        const suggested=selectSuggestedPosts((publicPosts.data||[]) as (Post&{music_items?:{artist?:string;song?:string}[]|null})[],combinedSeeds,15);
        const recommended=suggested.map(s=>s.post);
        setPosts(recommended);
        const authors=[...new Set(recommended.map(post=>post.user_id))].slice(0,40);
        if(!authors.length){setPeople([]);return;}
        const profiles=await supabase.from('profiles')
          .select('user_id,display_name,username,avatar_url').in('user_id',authors);
        if(profiles.error)throw profiles.error;
        setPeople((profiles.data||[]) as Person[]);
        return;
      }
      // Only posts visible under RLS can appear here. No private listening
      // history is exposed to other users.
      const safeArtist = artist.replace(/[%,()]/g, '').trim();
      if (!safeArtist) { setPosts([]); setPeople([]); return; }
      const fields = 'id,user_id,body,song_title,artist_name,artwork_url,created_at,collection';
      const [leadResult, includedResult] = await Promise.all([
        supabase.from('posts').select(fields)
          .ilike('artist_name', safeArtist)
          .order('created_at', { ascending: false }).limit(60),
        // Include songs inside multi-track collections, not just the lead artist.
        supabase.from('posts').select(fields)
          .contains('music_items', [{ artist: safeArtist }])
          .order('created_at', { ascending: false }).limit(60),
      ]);
      if (leadResult.error) throw leadResult.error;
      if (includedResult.error) console.log('Artist collection discovery:', includedResult.error.message);
      const merged = new Map<string, Post>();
      for (const item of [
        ...((leadResult.data || []) as Post[]),
        ...((includedResult.data || []) as Post[]),
      ]) merged.set(item.id, item);
      const visible = [...merged.values()]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPosts(visible);
      const authors = [...new Set(visible.map(post => post.user_id))].slice(0, 40);
      if (!authors.length) { setPeople([]); return; }
      const profilesResult = await supabase.from('profiles')
        .select('user_id,display_name,username,avatar_url').in('user_id', authors);
      if (profilesResult.error) throw profilesResult.error;
      setPeople((profilesResult.data || []) as Person[]);
    } catch (e) {
      console.log('Artist discovery:', e);
      setError('Could not load music conversations. Pull down or reopen this page to retry.');
    } finally { setBusy(false); }
  }, [artist]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>EXPLORE MUSIC</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>MUSIC CONNECTS US</Text>
        <Text style={styles.artist}>{artist || 'For your ears.'}</Text>
        {!!song && <Text style={styles.song}>{song}</Text>}
        <Text style={styles.description}>{artist
          ? "People who've posted music by this artist. Find a collection, discover a listener, or join the conversation."
          : "Artists and conversations to explore, based on music you've chosen or connected. These suggestions don't claim what you've listened to."}</Text>

        {busy && <ActivityIndicator color={green} style={{ marginTop: 40 }} />}
        {!!error && <Pressable onPress={() => void load()} style={styles.notice}>
          <Text style={styles.noticeText}>{error} Tap to retry.</Text>
        </Pressable>}

        {!busy && !error && (
          <>
            {!artist&&artistIdeas.length>0&&<>
              <Text style={styles.section}>ARTISTS YOU MIGHT EXPLORE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{gap:9,paddingBottom:8}}>
                {artistIdeas.map(name=><Pressable key={name}
                  accessibilityRole="button" accessibilityLabel={'Explore '+name}
                  style={styles.artistChip}
                  onPress={()=>router.push({pathname:'/music-discovery',params:{artist:name}})}>
                  <Text style={styles.chipText}>{name} ›</Text>
                </Pressable>)}
              </ScrollView>
            </>}
            <Text style={styles.section}>{artist?'LISTENERS':'PEOPLE POSTING THESE ARTISTS'} · {people.length}</Text>
            {people.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
                {people.map(person => (
                  <Pressable key={person.user_id}
                    accessibilityLabel={`Open ${person.display_name || person.username || 'listener'} profile`}
                    onPress={() => router.push({ pathname: '/profile', params: { userId: person.user_id } })}
                    style={styles.person}>
                    {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> :
                      <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.initial}>{(person.display_name || person.username || '?').slice(0, 1).toUpperCase()}</Text></View>}
                    <Text style={styles.personName} numberOfLines={1}>{person.display_name || 'Listener'}</Text>
                    <Text style={styles.handle} numberOfLines={1}>@{person.username || 'ovrlee'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : <Text style={styles.empty}>{artist?'No listeners have posted this artist yet.':'As people post music you explore, relevant listeners can appear here.'}</Text>}

            <Text style={styles.section}>{artist?'POSTS & COLLECTIONS':'CONVERSATIONS FOR YOU'} · {posts.length}</Text>
            {posts.map(post => {
              const person = people.find(p => p.user_id === post.user_id);
              return <Pressable key={post.id} style={styles.post} onPress={() => router.push({ pathname: '/post', params: { postId: post.id } })}>
                {post.artwork_url ? <Image source={{ uri: post.artwork_url }} style={styles.art} /> :
                  <View style={[styles.art, styles.artEmpty]}><Text style={{ color: green, fontSize: 24 }}>♫</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.postTitle} numberOfLines={2}>{post.collection?.title || post.song_title}</Text>
                  <Text style={styles.postDetail} numberOfLines={1}>@{person?.username || 'listener'} · {post.collection ? 'Collection' : 'Post'}</Text>
                  {!!post.body && <Text style={styles.postCaption} numberOfLines={2}>{post.body}</Text>}
                </View>
                <Text style={{ color: green, fontWeight: '900' }}>›</Text>
              </Pressable>;
            })}
            {!posts.length && <Text style={styles.empty}>{artist?'Be the first to post this artist to OVRLEE.':'Explore an artist above to find more conversations. Suggestions improve as the community shares music.'}</Text>}
            <Pressable onPress={() => router.push('/create-post')} style={styles.cta}>
              <Text style={styles.ctaText}>POST MUSIC +</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808' },
  header: { height: 62, borderBottomWidth: 1, borderBottomColor: '#222', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 34 },
  headerTitle: { color: '#fff', fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  content: { padding: 20, paddingBottom: 100 },
  overline: { color: green, fontSize: 10, letterSpacing: 2, fontWeight: '900', marginTop: 14 },
  artist: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 10 },
  song: { color: '#d7d7d7', fontSize: 16, marginTop: 5 },
  description: { color: '#999', fontSize: 13, lineHeight: 20, marginTop: 15, marginBottom: 18 },
  section: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginTop: 27, marginBottom: 12 },
  people: { gap: 14, paddingBottom: 5 },
  person: { width: 95, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEmpty: { backgroundColor: '#183820', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontSize: 24, fontWeight: '900' },
  personName: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 6 },
  handle: { color: '#888', fontSize: 11, marginTop: 2 },
  post: { borderWidth: 1, borderColor: '#242424', borderRadius: 13, backgroundColor: '#111', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  art: { width: 62, height: 62, borderRadius: 8 },
  artEmpty: { backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  postTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  postDetail: { color: '#9B9B9B', fontSize: 11, marginTop: 3 },
  postCaption: { color: '#bbb', fontSize: 12, marginTop: 6 },
  empty: { color: '#888', fontSize: 13, lineHeight: 19, paddingVertical: 9 },
  notice: { borderRadius: 12, backgroundColor: '#2B1414', padding: 15, marginTop: 16 },
  noticeText: { color: '#FFB5B5', fontSize: 13 },
  cta: { backgroundColor: green, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 27 },
  ctaText: { color: '#070707', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  artistChip:{backgroundColor:'#142318',borderColor:'#315a38',borderWidth:1,borderRadius:18,paddingVertical:12,paddingHorizontal:15,maxWidth:200},
  chipText:{color:green,fontSize:12,fontWeight:'900'},
});
