// Private saved-posts library, public profile likes, and personal reply history.
// Privacy is enforced by Supabase RLS; hiding a tab is never an authorization boundary.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import { supabase } from '../supabase';

type Tab = 'saved' | 'likes' | 'replies';
type ActionRow = { post_id: string; created_at: string; reply_id?: string; reply_body?: string };
type PostRow = { id: string; user_id: string; body: string | null; post_kind?: 'music' | 'aux_prompt' | 'daily_drop'; song_title: string; artist_name: string; artwork_url: string | null; photo_url: string | null };
type Item = ActionRow & { post: PostRow; author: string };

const accent = '#39E75F';
function elapsed(iso: string) {
  const age = Math.max(0, Date.now() - new Date(iso).getTime());
  const d = Math.floor(age / 86400000);
  if (d >= 7) return new Date(iso).toLocaleDateString();
  if (d) return `${d}d ago`;
  const h = Math.floor(age / 3600000);
  return h ? `${h}h ago` : 'Just now';
}

export default function PostCollectionsScreen() {
  const { scheme } = useAppearance();
  const styles = useMemo(() => themedStyleSheet(baseStyles, scheme), [scheme]);
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const requestedId = typeof params.userId === 'string' ? params.userId : '';
  const initialTab = params.tab === 'likes' || params.tab === 'replies' ? params.tab : 'saved';
  const [tab, setTab] = useState<Tab>(requestedId ? 'likes' : initialTab);
  const [own, setOwn] = useState(!requestedId);
  const [ownerId, setOwnerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/login'); return; }
      const target = requestedId || user.id;
      const isOwn = target === user.id;
      setOwn(isOwn);
      setOwnerId(target);
      const active: Tab = isOwn ? tab : 'likes';
      if (!isOwn && tab !== 'likes') setTab('likes');

      const [profileResult, actionsResult] = await Promise.all([
        supabase.from('profiles').select('display_name,username').eq('user_id', target).maybeSingle(),
        active === 'saved'
          ? supabase.from('collection_saves').select('post_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
          : active === 'likes'
            ? supabase.from('post_likes').select('post_id,created_at').eq('user_id', target).order('created_at', { ascending: false }).limit(200)
            : supabase.from('post_replies').select('id,post_id,body,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
      ]);
      if (actionsResult.error) throw actionsResult.error;
      setDisplayName(profileResult.data?.display_name || profileResult.data?.username || 'Listener');
      const raw = (actionsResult.data || []) as Record<string, any>[];
      const actions: ActionRow[] = raw.map(r => ({ post_id: String(r.post_id), created_at: String(r.created_at), ...(active === 'replies' ? { reply_id: String(r.id), reply_body: String(r.body || '') } : {}) }));
      const ids = Array.from(new Set(actions.map(r => r.post_id)));
      if (!ids.length) { setItems([]); return; }
      // Post RLS automatically removes blocked/deleted posts.
      const postResult = await supabase.from('posts').select('id,user_id,body,post_kind,song_title,artist_name,artwork_url,photo_url').in('id', ids);
      if (postResult.error) throw postResult.error;
      const posts = (postResult.data || []) as PostRow[];
      const byId = new Map(posts.map(p => [p.id, p]));
      const userIds = Array.from(new Set(posts.map(p => p.user_id)));
      const authors = userIds.length
        ? await supabase.from('profiles').select('user_id,display_name,username').in('user_id',userIds)
        : { data: [] as {user_id:string;display_name:string|null;username:string|null}[] };
      const names = new Map((authors.data || []).map(p => [p.user_id, p.display_name || p.username || 'Listener']));
      setItems(actions.flatMap(row => {
        const post = byId.get(row.post_id);
        return post ? [{ ...row, post, author: names.get(post.user_id) || 'Listener' }] : [];
      }));
    } catch (e) {
      console.log('Post collections:', e);
      setError('Could not load this activity. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestedId, tab]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const removeSave = async (postId: string) => {
    if (!own || tab !== 'saved' || removingId || !ownerId) return;
    setRemovingId(postId);
    try {
      const { error: deleteError } = await supabase.from('collection_saves').delete().eq('user_id', ownerId).eq('post_id', postId);
      if (deleteError) throw deleteError;
      setItems(previous => previous.filter(item => item.post_id !== postId));
    } catch (e) {
      Alert.alert('Could not unsave post', 'Please try again.');
    } finally {
      setRemovingId(null);
    }
  };
  const tabs: { key: Tab; label: string }[] = own
    ? [{key:'saved',label:'Saved'}, {key:'likes',label:'Likes'}, {key:'replies',label:'Comments'}]
    : [{key:'likes',label:'Likes'}];

  const subtitle = tab === 'saved'
    ? 'Only you can see the posts you save.'
    : tab === 'likes'
      ? 'Likes are visible to other OVRLEE members.'
      : 'Jump back into the conversations you joined.';
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.headerLabel}>{own ? 'YOUR ACTIVITY' : 'PUBLIC ACTIVITY'}</Text>
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} tintColor={accent} onRefresh={() => { setRefreshing(true); void load(); }}/>}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>{own ? 'Your activity.' : `${displayName}'s likes.`}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.tabs}>
        {tabs.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }}
          style={[styles.tab, tab === item.key && styles.tabActive]} onPress={() => setTab(item.key)}>
          <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
        </Pressable>)}
      </View>
      {loading ? <ActivityIndicator color={accent} style={{marginTop:30}}/> :
        error ? <Text style={styles.empty}>{error}</Text> :
        !items.length ? <Text style={styles.empty}> {tab === 'saved' ? 'No saved posts yet. Bookmark music or conversations to find them here.' : tab === 'likes' ? 'No liked posts yet.' : 'No comments yet.'}</Text> :
        items.map((item, index) => <Pressable key={item.reply_id || `${item.post_id}-${index}`} accessibilityRole="button"
          onPress={() => router.push({ pathname:'/post', params: {postId:item.post_id, ...(item.reply_id ? {focusReplyId:item.reply_id} : {})} })}
          style={styles.item}>
          {item.post.artwork_url || item.post.photo_url
            ? <Image source={{uri:item.post.artwork_url || item.post.photo_url || ''}} style={styles.art}/>
            : <View style={[styles.art,styles.artFallback]}><Text style={styles.musicNote}>{(item.post.post_kind==='aux_prompt' || item.post.post_kind==='daily_drop')?'?':'♫'}</Text></View>}
          <View style={styles.itemCopy}>
            <Text style={styles.song} numberOfLines={1}>{(item.post.post_kind==='aux_prompt' || item.post.post_kind==='daily_drop')?(item.post.body||'Music question'):item.post.song_title || 'Music conversation'}</Text>
            <Text style={styles.artist} numberOfLines={1}>{item.post.artist_name || item.author}</Text>
            <Text style={styles.caption} numberOfLines={2}>{item.reply_body || ((item.post.post_kind==='aux_prompt' || item.post.post_kind==='daily_drop')?'Reply with a song':item.post.body) || `Posted by ${item.author}`}</Text>
            <Text style={styles.age}>{elapsed(item.created_at)}</Text>
          </View>
          {own && tab === 'saved'
            ? <Pressable accessibilityRole="button" accessibilityLabel="Remove private save"
                disabled={removingId === item.post_id} onPress={() => void removeSave(item.post_id)}
                style={styles.unsave}><Text style={styles.unsaveText}>REMOVE</Text></Pressable>
            : <Text style={styles.arrow}>›</Text>}
        </Pressable>)}
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#080808'},
  header:{paddingHorizontal:22,paddingTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  back:{color:'#aaaaaa',fontSize:16},
  headerLabel:{color:'#888888',fontWeight:'800',fontSize:10,letterSpacing:1.6},
  content:{paddingHorizontal:22,paddingBottom:80},
  title:{color:'#ffffff',fontWeight:'900',fontSize:31,marginTop:30},
  subtitle:{color:'#999999',fontSize:13,lineHeight:20,marginTop:8,marginBottom:22},
  tabs:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#2a2a2a',marginBottom:15},
  tab:{paddingVertical:12,marginRight:29,borderBottomWidth:2,borderBottomColor:'transparent'},
  tabActive:{borderBottomColor:accent},
  tabText:{color:'#777777',fontWeight:'800',fontSize:13},
  tabTextActive:{color:'#ffffff'},
  item:{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#222222',paddingVertical:15,gap:12},
  art:{width:62,height:62,borderRadius:9,backgroundColor:'#202020'},
  artFallback:{alignItems:'center',justifyContent:'center'},
  musicNote:{color:'#aaaaaa',fontSize:24},
  itemCopy:{flex:1,gap:3},
  song:{color:'#ffffff',fontWeight:'800',fontSize:14},
  artist:{color:'#aaaaaa',fontSize:12},
  caption:{color:'#777777',fontSize:12},
  age:{color:'#777777',fontSize:10,marginTop:2},
  unsave:{paddingVertical:12,paddingHorizontal:4},
  unsaveText:{color:accent,fontSize:10,fontWeight:'900'},
  arrow:{color:'#777777',fontSize:25},
  empty:{color:'#888888',fontSize:14,lineHeight:22,marginTop:25},
});
