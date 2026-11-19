import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';

interface MutualUser {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name?: string | null;
}

export default function NewGroupScreen() {
  const {scheme,colors}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [mutuals, setMutuals] = useState<MutualUser[]>([]);
  const [directoryMatches,setDirectoryMatches]=useState<MutualUser[]>([]);
  const [searchBusy,setSearchBusy]=useState(false);
  const [searchError,setSearchError]=useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMutuals();
  }, []);

  async function fetchMutuals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setError('Please sign in to start a group.'); return; }

    // A mutual is someone you follow who follows you back.
    // Never use profiles.id here: OVRLEE profiles are keyed by user_id.
    try {
      const [followingResult, followersResult] = await Promise.all([
        supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
        supabase.from('user_follows').select('follower_id').eq('following_id', user.id),
      ]);
      if (followingResult.error || followersResult.error) {
        throw followingResult.error || followersResult.error;
      }
      const following = new Set((followingResult.data || []).map((row) => row.following_id));
      const mutualIds = (followersResult.data || [])
        .map((row) => row.follower_id)
        .filter((id) => id !== user.id && following.has(id));
      if (!mutualIds.length) {
        setMutuals([]);
        return;
      }
      const [profilesResult, blockedResult, blockedByResult] = await Promise.all([
        supabase.from('profiles').select('user_id, username, display_name, avatar_url').in('user_id', mutualIds).eq('onboarding_complete',true),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('user_blocks').select('blocker_id').eq('blocked_id', user.id),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      const hidden = new Set([
        ...(blockedResult.data || []).map((row) => row.blocked_id),
        ...(blockedByResult.data || []).map((row) => row.blocker_id),
      ]);
      setMutuals((profilesResult.data || [])
        .filter((person) => !hidden.has(person.user_id))
        .map((person) => ({
          id: person.user_id,
          username: person.username || '',
          display_name: person.display_name,
          avatar_url: person.avatar_url,
        })));
    } catch (error) {
      console.error('Unable to load mutual followers for group creation:', error);
      setMutuals([]);
      setError('Could not load mutual followers. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Typing @username searches the *entire* finished member directory,
  // not just mutuals. Non-mutuals are discoverable but cannot be added to
  // a private group without a two-way follow relationship.
  const needle=search.trim().replace(/^@/,'').replace(/[%_,()\\]/g,'')
    .slice(0,40).toLocaleLowerCase();
  const mutualIds=useMemo(()=>new Set(mutuals.map(person=>person.id)),[mutuals]);
  useEffect(()=>{
    if(needle.length<2){setDirectoryMatches([]);setSearchBusy(false);setSearchError('');return;}
    let active=true;
    const timer=setTimeout(async()=>{
      setSearchBusy(true);
      setSearchError('');
      try{
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)throw new Error('Sign in to search people.');
        const [handles,names,blockedMine,blockedTheirs]=await Promise.all([
          supabase.from('profiles')
            .select('user_id,username,display_name,avatar_url')
            .eq('onboarding_complete',true)
            .ilike('username',needle+'%').limit(25),
          supabase.from('profiles')
            .select('user_id,username,display_name,avatar_url')
            .eq('onboarding_complete',true)
            .ilike('display_name','%'+needle+'%').limit(25),
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id',user.id),
          supabase.from('user_blocks').select('blocker_id').eq('blocked_id',user.id),
        ]);
        for(const result of [handles,names,blockedMine,blockedTheirs])
          if(result.error)throw result.error;
        const hidden=new Set([user.id,
          ...(blockedMine.data||[]).map(row=>row.blocked_id),
          ...(blockedTheirs.data||[]).map(row=>row.blocker_id)]);
        const unique=new Map<string,MutualUser>();
        for(const member of [...(handles.data||[]),...(names.data||[])])
          if(member.user_id && member.username && !hidden.has(member.user_id))
            unique.set(member.user_id,{
              id:member.user_id,username:member.username,
              display_name:member.display_name,avatar_url:member.avatar_url,
            });
        if(active)setDirectoryMatches([...unique.values()]);
      }catch{
        if(active){setDirectoryMatches([]);setSearchError('Could not search people. Try again.');}
      }finally{if(active)setSearchBusy(false);}
    },300);
    return()=>{active=false;clearTimeout(timer);};
  },[needle]);
  const matchedMutuals=needle
    ? mutuals.filter(person=>person.username.toLocaleLowerCase().includes(needle)
        || (person.display_name||'').toLocaleLowerCase().includes(needle))
    : mutuals;
  const candidates=needle.length>=2
    ? [...new Map([...matchedMutuals,...directoryMatches]
        .map(person=>[person.id,person])).values()]
        .sort((a,b)=>Number(mutualIds.has(b.id))-Number(mutualIds.has(a.id))
          || a.username.localeCompare(b.username))
    : matchedMutuals;

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCreateGroup() {
    if (selectedIds.length === 0 || creating) return;
    setCreating(true);
    setError('');

    const { data: convId, error } = await supabase.rpc('create_group_chat', {
      p_title: title.trim() || null,
      p_member_ids: selectedIds,
    });

    setCreating(false);
    if (!error && convId) {
      router.replace({ pathname: '/chat', params: { id: convId } });
    } else {
      setError(error?.message || 'Could not create the group. Please try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea,{backgroundColor:colors.background}]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            onPress={handleCreateGroup}
            disabled={selectedIds.length === 0 || creating}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#00E575" />
            ) : (
              <Text style={[styles.createText, selectedIds.length === 0 && styles.disabledText]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {!!error && <Text style={{ color: '#ff9494', marginBottom: 12 }}>{error}</Text>}
        <TextInput
          style={styles.nameInput}
          placeholder="Search people by @username"
          placeholderTextColor={colors.secondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people to add to group"
        />
        <TextInput
          style={styles.nameInput}
          placeholder="Group name (optional)"
          placeholderTextColor={colors.secondary}
          value={title}
          onChangeText={setTitle}
          autoCorrect={false}
          maxLength={60}
          accessibilityLabel="Group name"
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{needle?'PEOPLE':'ADD MUTUALS'}</Text>
          <Text style={styles.selectedCount}>{selectedIds.length} selected</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={candidates}
            ListHeaderComponent={searchBusy||!!searchError
              ? <View style={{paddingVertical:8}}>
                  {searchBusy?<ActivityIndicator color={colors.accent} size="small"/>:null}
                  {!!searchError&&<Text style={{color:colors.secondary,fontSize:12}}>{searchError}</Text>}
                </View>:null}
            ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:24,paddingHorizontal:14}}>
              <Text style={[styles.emptyText,{color:colors.secondary}]}>
                {searchBusy?'Searching…':needle.length===1?'Type another letter to search everyone.'
                  :needle?'No matching people.':'Follow each other to start a group.'}
              </Text>
              <TouchableOpacity onPress={()=>router.push({pathname:'/listeners',params:needle?{search:needle}:{}})}
                accessibilityRole="button" accessibilityLabel="Find members in Discover">
                <Text style={[styles.findPeople,{color:colors.accent}]}>FIND PEOPLE →</Text>
              </TouchableOpacity>
            </View>}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              const canAdd=mutualIds.has(item.id);
              return (
                <TouchableOpacity
                  style={[styles.userRow,{borderBottomColor:colors.border}]}
                  accessibilityRole="button"
                  accessibilityLabel={canAdd?
                    (isSelected?'Remove ':'Add ')+item.username+' from group':
                    'View '+item.username+' — mutual follow required to invite'}
                  onPress={() => canAdd
                    ? toggleSelect(item.id)
                    : router.push({pathname:'/profile',params:{userId:item.id}})}
                  activeOpacity={0.7}
                >
                  {item.avatar_url ? (
                    <Image source={{uri:item.avatar_url}} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar,styles.avatarEmpty]} accessibilityLabel={`${item.username} has no profile image`}>
                      <Text style={styles.avatarInitial}>{(item.username || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{flex:1}}>
                    <Text style={[styles.username,{color:colors.text}]}>{item.display_name||'@'+item.username}</Text>
                    <Text style={{fontSize:12,color:colors.secondary,marginTop:3}}>
                      @{item.username}{canAdd?'':' · Follow each other to add'}
                    </Text>
                  </View>
                  {canAdd
                    ? <View style={[styles.checkbox,
                        {borderColor:colors.border},
                        isSelected&&{backgroundColor:colors.accent,borderColor:colors.accent}]}>
                        {isSelected&&<Text style={[styles.checkmark,{color:colors.accentText}]}>✓</Text>}
                      </View>
                    : <Text style={{color:colors.accent,fontSize:12,fontWeight:'800'}}>VIEW →</Text>}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F1F1F',
    marginBottom: 16,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#888888', fontSize: 16 },
  createText: { color: '#00E575', fontSize: 16, fontWeight: '700' },
  disabledText: { opacity: 0.3 },
  nameInput: {
    backgroundColor: '#141414',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#242424',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: '#666666', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  selectedCount: { color: '#00E575', fontSize: 12, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#222' },
  avatarEmpty:{alignItems:'center',justifyContent:'center',backgroundColor:'#E9DCD2'},
  avatarInitial:{color:'#3B2218',fontSize:18,fontWeight:'900'},
  username: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#00E575', borderColor: '#00E575' },
  checkmark: { color: '#000000', fontSize: 13, fontWeight: '900' },
  emptyText:{fontSize:14,textAlign:'center'},
  findPeople:{fontSize:12,fontWeight:'900',marginTop:18,letterSpacing:0.8},
});
