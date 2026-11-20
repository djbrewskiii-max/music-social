
import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {router} from 'expo-router';
import {useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Image,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {supabase} from '../supabase';
import {setOnboardingStage} from '../onboarding-progress';
import {searchSongs,type CollectionItem} from '../collection';

const GREEN='#39E75F';
const key=(song:string,artist:string)=>song.trim().toLowerCase()+'::'+artist.trim().toLowerCase();

type Pin={song:string;artist:string;position:number};

export default function RotationSetupScreen(){
  const {scheme,colors}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [existing,setExisting]=useState<Pin[]>([]);
  const [chosen,setChosen]=useState<CollectionItem[]>([]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<CollectionItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [searching,setSearching]=useState(false);
  const [searchError,setSearchError]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.replace('/login');return;}
      const [fav,pins]=await Promise.all([
        supabase.from('music_taste_artists').select('artist_name')
          .eq('user_id',user.id).eq('source','favorite').limit(20),
        supabase.from('profile_rotation_pins').select('song,artist,position')
          .eq('user_id',user.id).order('position'),
      ]);
      if(!active)return;
      if(pins.error)throw pins.error;
      const artists=(fav.data||[]).map(row=>row.artist_name);
      setFavorites(artists);
      setExisting((pins.data||[]) as Pin[]);
      if(artists.length)setQuery(artists[0]);
    })().catch(error=>{if(active)Alert.alert('Could not load rotation',String(error?.message||error));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(query.trim().length<2){setResults([]);setSearching(false);setSearchError('');return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setSearching(true);setSearchError('');
      searchSongs(query.trim(),controller.signal)
        .then(songs=>{if(!controller.signal.aborted)setResults(songs.filter(song=>song.song&&song.artist));})
        .catch(error=>{if(!controller.signal.aborted)setSearchError(error?.message||'Search unavailable.');})
        .finally(()=>{if(!controller.signal.aborted)setSearching(false);});
    },300);
    return()=>{controller.abort();clearTimeout(timer);};
  },[query]);

  const used=new Set([...existing.map(p=>key(p.song,p.artist)),...chosen.map(t=>key(t.song,t.artist))]);
  const remaining=Math.max(0,5-existing.length-chosen.length);

  const toggle=(track:CollectionItem)=>{
    const id=key(track.song,track.artist);
    if(existing.some(p=>key(p.song,p.artist)===id))return;
    if(chosen.some(p=>key(p.song,p.artist)===id)){
      setChosen(current=>current.filter(p=>key(p.song,p.artist)!==id));
      return;
    }
    if(remaining<=0)return;
    setChosen(current=>[...current,track]);
  };

  const finish=async()=>{
    if(saving||chosen.length===0)return;
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in to save your songs.');
      const {data:pins,error:readError}=await supabase.from('profile_rotation_pins')
        .select('song,artist,position').eq('user_id',user.id);
      if(readError)throw readError;
      const latest=(pins||[]) as Pin[];
      const present=new Set(latest.map(p=>key(p.song,p.artist)));
      const newTracks=chosen.filter(song=>!present.has(key(song.song,song.artist)));
      if(latest.length+newTracks.length>5)throw new Error('Your rotation is already full.');
      const start=latest.reduce((max,p)=>Math.max(max,p.position),-1)+1;
      if(newTracks.length){
        const rows=newTracks.map((track,i)=>({
          user_id:user.id,song:track.song,artist:track.artist,
          artwork_url:track.artworkUrl||null,position:start+i,
        }));
        const {error}=await supabase.from('profile_rotation_pins').insert(rows);
        if(error)throw error;
      }
      await setOnboardingStage(user.id,'connect-music');
      router.replace('/connect-music');
    }catch(error){
      Alert.alert('Could not save rotation',error instanceof Error?error.message:'Please try again.');
    }finally{setSaving(false);}
  };

  return <SafeAreaView style={[styles.root,{backgroundColor:colors.background}]}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.eyebrow,{color:colors.accent}]}>YOUR MUSIC · 3 OF 4</Text>
        <Text style={[styles.heading,{color:colors.text}]}>In Rotation.</Text>
        <Text style={[styles.subtitle,{color:colors.secondary}]}>Pick up to five songs you're into lately.</Text>
        <Text style={[styles.count,{color:colors.accent}]}>{existing.length+chosen.length} OF 5 SONGS</Text>
        {!!existing.length&&<View style={styles.chips}>
          {existing.map(track=><Text key={key(track.song,track.artist)}
            style={[styles.chip,{color:colors.text,borderColor:colors.border}]}>{track.song} · {track.artist}</Text>)}
        </View>}
        {!!chosen.length&&<View style={styles.chips}>
          {chosen.map(track=><Pressable key={key(track.song,track.artist)}
            accessibilityRole="button" accessibilityLabel={'Remove '+track.song}
            onPress={()=>toggle(track)} style={[styles.chip,{borderColor:colors.accent}]}>
            <Text style={{color:colors.text,fontWeight:'800'}}>{track.song} ×</Text>
          </Pressable>)}
        </View>}
        {!!favorites.length&&<ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap:9,paddingVertical:17}}>
          {favorites.slice(0,10).map(artist=><Pressable key={artist} onPress={()=>setQuery(artist)}
            accessibilityRole="button" style={[styles.artistChip,{backgroundColor:colors.surface,borderColor:colors.border}]}>
            <Text style={{color:colors.text,fontWeight:'700'}}>{artist}</Text>
          </Pressable>)}
        </ScrollView>}
        <TextInput style={[styles.input,{backgroundColor:colors.surface,borderColor:colors.border,color:colors.text}]}
          placeholder="Search songs or artists" placeholderTextColor={colors.secondary}
          value={query} onChangeText={setQuery} autoCorrect={false}
          accessibilityLabel="Search songs for In Rotation"/>
        {loading||searching?<ActivityIndicator color={colors.accent} style={{marginTop:18}}/>:null}
        {!!searchError&&<Text style={{color:colors.secondary,marginTop:14}}>{searchError}</Text>}
        {!searching&&results.map(track=>{
          const selected=chosen.some(t=>key(t.song,t.artist)===key(track.song,track.artist));
          const already=existing.some(t=>key(t.song,t.artist)===key(track.song,track.artist));
          return <Pressable key={track.id||key(track.song,track.artist)}
            onPress={()=>toggle(track)} disabled={already||(!selected&&remaining<=0)}
            accessibilityRole="button" accessibilityLabel={'Add '+track.song}
            style={[styles.result,{borderColor:colors.border}]}>
            {track.artworkUrl?<Image source={{uri:track.artworkUrl}} style={styles.art}/>:
              <View style={[styles.art,{backgroundColor:colors.raised}]} />}
            <View style={{flex:1}}>
              <Text style={{color:colors.text,fontWeight:'800'}} numberOfLines={1}>{track.song}</Text>
              <Text style={{color:colors.secondary,marginTop:4}} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Text style={{color:colors.accent,fontSize:22}}>{selected||already?'✓':'+'}</Text>
          </Pressable>;
        })}
      </ScrollView>
      <View style={[styles.footer,{borderColor:colors.border,backgroundColor:colors.background}]}>
        <Pressable accessibilityRole="button" disabled={saving||chosen.length===0}
          onPress={()=>void finish()} style={[styles.button,{backgroundColor:colors.accent},(saving||!chosen.length)&&{opacity:.4}]}>
          <Text style={[styles.buttonText,{color:scheme==='light'?'#FFF':'#080808'}]}>{saving?'SAVING…':'NEXT: MUSIC SERVICE →'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving}
          onPress={()=>void (async()=>{
            try{
              const {data:{user},error}=await supabase.auth.getUser();
              if(error||!user)throw new Error('Sign in to continue.');
              await setOnboardingStage(user.id,'connect-music');
              router.replace('/connect-music');
            }catch(error){
              Alert.alert('Could not continue',
                error instanceof Error?error.message:'Check your connection and retry.');
            }
          })()} style={{padding:14,alignItems:'center'}}>
          <Text style={{color:colors.secondary,fontWeight:'700'}}>Add songs later</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const baseStyles=StyleSheet.create({
  root:{flex:1},content:{paddingHorizontal:24,paddingTop:36,paddingBottom:45},
  eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5},
  heading:{fontSize:39,fontWeight:'900',marginTop:18},
  subtitle:{fontSize:15,marginTop:12,lineHeight:22},
  count:{fontSize:12,fontWeight:'900',marginTop:28,letterSpacing:1},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14},
  chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:18,borderWidth:1,fontSize:12},
  artistChip:{paddingVertical:10,paddingHorizontal:13,borderRadius:18,borderWidth:1},
  input:{borderRadius:14,borderWidth:1,padding:16,fontSize:16,marginTop:8},
  result:{flexDirection:'row',gap:12,alignItems:'center',borderBottomWidth:1,paddingVertical:12},
  art:{width:52,height:52,borderRadius:8},
  note:{fontSize:12,lineHeight:18,marginTop:26},
  footer:{borderTopWidth:1,paddingHorizontal:24,paddingTop:12,paddingBottom:12},
  button:{borderRadius:16,alignItems:'center',padding:17},
  buttonText:{fontWeight:'900',fontSize:13}
});
