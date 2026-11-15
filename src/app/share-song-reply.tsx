/** Share-sheet handoff: choose an existing conversation before sending a Song Reply. */
import { router, useLocalSearchParams } from 'expo-router';
import { useAppearance } from '../appearance';
import { isMusicLink } from '../shared-music';
import { supabase } from '../supabase';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

type Thread = {
  id: string; user_id: string; song_title: string | null;
  artist_name: string | null; body: string | null; author: string;
};

export default function ChooseSongReplyThread() {
  const { colors } = useAppearance();
  const { sharedUrl } = useLocalSearchParams<{ sharedUrl?: string }>();
  const url = typeof sharedUrl === 'string' ? sharedUrl : '';
  const [threads, setThreads] = useState<Thread[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url || !isMusicLink(url)) {
      setError('A Spotify or Apple Music song link is required.');
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        // Uses only OVRLEE posts already visible to this signed-in member.
        const { data, error: postError } = await supabase.from('posts')
          .select('id,user_id,body,song_title,artist_name,created_at')
          .order('created_at', { ascending: false }).limit(40);
        if (postError) throw postError;
        const rows = data || [];
        const ids = Array.from(new Set(rows.map(row => row.user_id)));
        const names = new Map<string,string>();
        if (ids.length) {
          const { data: profiles } = await supabase.from('profiles')
            .select('user_id,display_name,username').in('user_id', ids);
          for (const p of profiles || []) names.set(p.user_id, p.display_name || p.username || 'Listener');
        }
        if (active) setThreads(rows.map(row => ({
          id: row.id, user_id: row.user_id, body: row.body,
          song_title: row.song_title, artist_name: row.artist_name,
          author: names.get(row.user_id) || 'Listener',
        })));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load conversations.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [url]);
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? threads.filter(t =>
      [t.author, t.song_title, t.artist_name, t.body].some(value => String(value || '').toLowerCase().includes(needle)))
      : threads;
  }, [threads, search]);
  const open = (id: string) => router.replace({
    pathname: '/post', params: { postId: id, songReply: '1', sharedUrl: url },
  });
  return (
    <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
      <ScrollView contentContainerStyle={{padding:22,paddingBottom:90}} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{paddingVertical:12}}>
          <Text style={{color:colors.secondary,fontSize:16}}>‹ Back</Text>
        </Pressable>
        <Text style={{color:colors.text,fontSize:28,fontWeight:'900',marginTop:14}}>Reply with a song</Text>
        <Text style={{color:colors.secondary,fontSize:14,lineHeight:21,marginTop:10,marginBottom:20}}>
          Pick a conversation. Your shared song will be attached to the reply, and you can add a note before sending.
        </Text>
        <TextInput value={search} onChangeText={setSearch} accessibilityLabel="Find a conversation"
          placeholder="Search songs or conversations…" placeholderTextColor={colors.secondary}
          style={{color:colors.text,backgroundColor:colors.surface,borderColor:colors.border,
            borderWidth:1,borderRadius:14,padding:14,fontSize:15,marginBottom:15}} />
        {loading && <ActivityIndicator color={colors.accent} style={{marginVertical:28}}/>}
        {!!error && <Text style={{color:colors.secondary,marginVertical:16}}>{error}</Text>}
        {!loading && !error && results.length===0 && <Text style={{color:colors.secondary,paddingTop:20}}>
          No conversations found. You can still make a new music post from the share sheet.
        </Text>}
        {results.map(t => (
          <Pressable key={t.id} accessibilityRole="button"
            accessibilityLabel={`Reply to ${t.author}'s post`}
            onPress={() => open(t.id)}
            style={{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
              padding:15,borderRadius:14,marginBottom:10}}>
            <Text style={{fontSize:12,color:colors.accent,fontWeight:'800'}}>{t.author}</Text>
            <Text style={{fontSize:16,color:colors.text,fontWeight:'800',marginTop:6}} numberOfLines={1}>
              {t.song_title ? `♫ ${t.song_title}${t.artist_name ? ' — ' + t.artist_name : ''}` : 'Music conversation'}
            </Text>
            {!!t.body && <Text style={{color:colors.secondary,fontSize:13,marginTop:6}} numberOfLines={2}>{t.body}</Text>}
            <Text style={{color:colors.accent,fontWeight:'800',fontSize:11,marginTop:12}}>ADD SONG REPLY →</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
