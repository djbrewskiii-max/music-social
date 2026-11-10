import { launchSafeImports } from '../music-launch-sources';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../supabase';
import { tasteKey } from '../music-taste-evidence';

const GREEN='#39E75F';
const MIN=5;
const MAX=20;
export default function PickArtistsScreen(){
  const {edit}=useLocalSearchParams<{edit?:string}>();
  const editing=edit==='1';
  const [text,setText]=useState('');
  const [favorites,setFavorites]=useState<string[]>([]);
  const [suggestions,setSuggestions]=useState<string[]>([]);
  const [share,setShare]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.replace('/login');return;}
      const [existing,dna,selected]=await Promise.all([
        supabase.from('music_taste_artists').select('artist_name,share_for_matching')
          .eq('user_id',user.id).eq('source','favorite').limit(MAX),
        supabase.from('music_dna').select('top_artists').eq('user_id',user.id).maybeSingle(),
        supabase.from('music_import_artists').select('artist,source_label').eq('user_id',user.id).limit(25),
      ]);
      if(!active)return;
      setFavorites((existing.data||[]).map(x=>x.artist_name));
      setShare((existing.data||[]).some(x=>x.share_for_matching===true));
      const names=[
        ...((dna.data?.top_artists||[]) as {name:string}[]).map(x=>x.name),
        ...launchSafeImports(selected.data||[]).map(x=>x.artist),
      ];
      setSuggestions([...new Map(names.filter(Boolean).map(name=>[tasteKey(name),name])).values()].slice(0,20));
    })().catch(e=>console.log('Favorite artist setup:',e))
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const keys=useMemo(()=>new Set(favorites.map(tasteKey)),[favorites]);
  const add=(raw:string)=>{
    const names=raw.split(/[,\n]/).map(t=>t.trim().slice(0,120)).filter(Boolean);
    if(!names.length)return;
    setFavorites(current=>{
      const next=[...current],seen=new Set(current.map(tasteKey));
      for(const name of names){
        const key=tasteKey(name);
        if(!key||seen.has(key)||next.length>=MAX)continue;
        next.push(name);seen.add(key);
      }
      return next;
    });
    setText('');
  };
  const save=async()=>{
    if(saving||favorites.length<MIN)return;
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in to save your favorite artists.');
      const chosen=new Set(favorites.map(tasteKey));
      // Removing a favorite should also remove its public matching entry.
      const existing=await supabase.from('music_taste_artists')
        .select('artist_key').eq('user_id',user.id).eq('source','favorite');
      if(existing.error)throw existing.error;
      const oldKeys=(existing.data||[]).map(row=>row.artist_key).filter(key=>!chosen.has(key));
      for(const key of oldKeys){
        const {error}=await supabase.from('music_taste_artists').delete()
          .eq('user_id',user.id).eq('source','favorite').eq('artist_key',key);
        if(error)throw error;
      }
      const rows=favorites.map(artist_name=>({
        user_id:user.id,artist_name,artist_key:tasteKey(artist_name),
        source:'favorite',song_count:0,playlist_count:0,
        share_for_matching:share,updated_at:new Date().toISOString(),
      }));
      const {error}=await supabase.from('music_taste_artists').upsert(rows,{
        onConflict:'user_id,artist_key,source'
      });
      if(error)throw error;
      router.replace(editing?'/music-settings':'/connect-music');
    }catch(e){Alert.alert('Could not save artists',e instanceof Error?e.message:'Try again.');}
    finally{setSaving(false);}
  };
  const canContinue=favorites.length>=MIN && !loading&&!saving;
  return <SafeAreaView style={s.root}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text style={s.kicker}>OVRLEE · YOUR MUSIC</Text>
        <Text style={s.title}>{editing?'Your favorite artists.':'Make your music yours.'}</Text>
        <Text style={s.description}>Pick at least five artists you genuinely love. OVRLEE will use them to find music and people worth discovering—even before you've posted.</Text>
        <View style={s.countRow}><Text style={s.count}>{favorites.length}/{MIN} MINIMUM</Text>
          <Text style={s.hint}>Up to {MAX} artists</Text></View>
        <View style={s.entry}>
          <TextInput style={s.input} value={text} onChangeText={setText}
            placeholder="Type an artist name" placeholderTextColor="#888"
            onSubmitEditing={()=>add(text)} returnKeyType="done" autoCorrect={false}
            accessibilityLabel="Artist name"/>
          <Pressable style={s.add} onPress={()=>add(text)}
            accessibilityRole="button" accessibilityLabel="Add artist"><Text style={s.addText}>+</Text></Pressable>
        </View>
        {loading&&<ActivityIndicator color={GREEN} style={{marginTop:18}}/>}
        {favorites.length>0&&<View style={s.chips}>
          {favorites.map(name=><Pressable key={tasteKey(name)} accessibilityRole="button"
            accessibilityLabel={'Remove '+name} style={s.chip}
            onPress={()=>setFavorites(v=>v.filter(x=>tasteKey(x)!==tasteKey(name)))}>
            <Text style={s.chipText}>{name}  ×</Text>
          </Pressable>)}
        </View>}
        {!!suggestions.filter(x=>!keys.has(tasteKey(x))).length&&<>
          <Text style={s.label}>ARTISTS TO CONSIDER</Text>
          <View style={s.chips}>{suggestions.filter(x=>!keys.has(tasteKey(x))).slice(0,14)
            .map(name=><Pressable key={tasteKey(name)} accessibilityRole="button" style={s.suggestChip}
              onPress={()=>add(name)}>
              <Text style={s.suggestText}>+ {name}</Text>
            </Pressable>)}</View>
        </>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:share}}
          onPress={()=>setShare(v=>!v)} style={s.shareRow}>
          <View style={[s.check,share&&s.checkActive]}><Text style={s.checkText}>{share?'✓':''}</Text></View>
          <View style={{flex:1}}>
            <Text style={s.shareTitle}>Show artists we have in common</Text>
            <Text style={s.shareDesc}>Let other OVRLEE members see artist names you share. Your full music library and listening history remain private. You can change this later.</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!canContinue}
          onPress={()=>void save()} style={[s.button,!canContinue&&{opacity:.45}]}>
          {saving?<ActivityIndicator color="#000"/>:<Text style={s.buttonText}>
            {editing?'SAVE MY ARTISTS':'CONTINUE'} →
          </Text>}
        </Pressable>
        {favorites.length<MIN&&<Text style={s.footer}>Choose {MIN-favorites.length} more artist{MIN-favorites.length===1?'':'s'} to continue.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#080808'},content:{padding:24,paddingTop:46,paddingBottom:72},
 kicker:{color:GREEN,fontSize:11,fontWeight:'900',letterSpacing:1.7},
 title:{color:'#fff',fontSize:36,lineHeight:41,fontWeight:'900',marginTop:20},
 description:{color:'#bbb',fontSize:14,lineHeight:23,marginTop:17},
 countRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:30},
 count:{color:GREEN,fontSize:13,fontWeight:'900'},hint:{color:'#777',fontSize:12},
 entry:{flexDirection:'row',gap:10,marginTop:15},
 input:{backgroundColor:'#1a1a1a',color:'#fff',borderWidth:1,borderColor:'#333',borderRadius:13,padding:16,fontSize:15,flex:1},
 add:{backgroundColor:GREEN,borderRadius:13,width:54,alignItems:'center',justifyContent:'center'},
 addText:{fontSize:28,color:'#080808',fontWeight:'900'},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:17},
 chip:{backgroundColor:'#1d4026',borderColor:'#37904a',borderWidth:1,paddingVertical:11,paddingHorizontal:12,borderRadius:22},
 chipText:{color:'#fff',fontWeight:'800',fontSize:13},
 suggestChip:{backgroundColor:'#1e1e1e',borderColor:'#444',borderWidth:1,paddingVertical:10,paddingHorizontal:12,borderRadius:22},
 suggestText:{color:'#bcbcbc',fontWeight:'700',fontSize:12},
 label:{color:'#777',fontSize:11,fontWeight:'900',letterSpacing:1.3,marginTop:30},
 shareRow:{marginTop:34,flexDirection:'row',alignItems:'flex-start',gap:13,paddingVertical:13},
 check:{width:25,height:25,borderWidth:1,borderColor:'#666',borderRadius:6,alignItems:'center',justifyContent:'center'},
 checkActive:{backgroundColor:GREEN,borderColor:GREEN},checkText:{color:'#000',fontWeight:'900'},
 shareTitle:{color:'#fff',fontSize:14,fontWeight:'800'},
 shareDesc:{color:'#999',fontSize:12,lineHeight:19,marginTop:6},
 button:{backgroundColor:GREEN,borderRadius:14,padding:17,alignItems:'center',marginTop:28},
 buttonText:{color:'#000',fontSize:14,fontWeight:'900'},
 footer:{textAlign:'center',color:'#999',fontSize:12,marginTop:16}
});