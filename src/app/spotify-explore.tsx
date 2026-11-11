/** Member-selected public playlist preview. No Spotify account or track scraping. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { parseSpotifyShowcaseLink } from '../spotify-showcase';

const GREEN='#39E75F';
type Preview={title?:string;thumbnail_url?:string};
export default function SpotifyPlaylistView(){
  const {url}=useLocalSearchParams<{url?:string}>();
  const playlist=useMemo(()=>{
    const parsed=parseSpotifyShowcaseLink(typeof url==='string'?url:'');
    return parsed?.kind==='playlist'?parsed:null;
  },[url]);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!playlist){setPreview(null);return;}
    let active=true;
    const controller=new AbortController();
    setLoading(true);
    // Official Spotify oEmbed metadata: artwork and title, never playlist songs.
    fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(playlist.url),
      {signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then((result:Preview|null)=>{if(active)setPreview(result);})
      .catch(()=>{if(active)setPreview(null);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[playlist?.url]);
  const open=async()=>{
    if(!playlist)return;
    try{await Linking.openURL(playlist.url);}
    catch{Alert.alert('Could not open Spotify','Check your connection and try again.');}
  };
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" onPress={()=>router.back()}>
        <Text style={s.back}>‹</Text>
      </Pressable>
      <Text style={s.headerTitle}>SHARED PLAYLIST</Text>
      <View style={{width:32}}/>
    </View>
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.kicker}>DISCOVER THROUGH MUSIC</Text>
      <Text style={s.title}>A playlist worth sharing.</Text>
      <Text style={s.description}>Someone chose to share this Spotify playlist on OVRLEE.</Text>
      {playlist ? <>
        <View style={s.preview}>
          {preview?.thumbnail_url
            ? <Image source={{uri:preview.thumbnail_url}} style={s.art}/>
            : <View style={s.art}><Text style={{fontSize:36,color:GREEN}}>♫</Text></View>}
          <Text style={s.playlistTitle}>{preview?.title||'Spotify playlist'}</Text>
          <Text style={s.description}>Explore the playlist directly in Spotify.</Text>
          {loading&&<ActivityIndicator color={GREEN} style={{marginTop:12}}/>}
        </View>
        <Pressable accessibilityRole="button" style={s.cta} onPress={()=>void open()}>
          <Text style={s.ctaText}>OPEN IN SPOTIFY ↗</Text>
        </Pressable>
        <Text style={s.foot}>Spotify hosts the music. OVRLEE does not read this playlist's tracks or monitor its activity.</Text>
      </> : <View style={s.preview}>
        <Text style={s.description}>This playlist link is unavailable. Ask the person who shared it for a new link.</Text>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#060606'},
  header:{height:62,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#222',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  back:{color:'#fff',fontSize:30},headerTitle:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:1.2},
  body:{padding:24,paddingTop:40,paddingBottom:90},
  kicker:{color:GREEN,fontSize:11,fontWeight:'900',letterSpacing:1.5},
  title:{color:'#fff',fontSize:30,lineHeight:37,fontWeight:'900',marginTop:15},
  description:{color:'#aaa',fontSize:14,lineHeight:21,marginTop:9,textAlign:'center'},
  preview:{backgroundColor:'#141414',borderWidth:1,borderColor:'#2c382e',borderRadius:18,marginTop:26,padding:22,alignItems:'center'},
  art:{width:218,height:218,borderRadius:12,backgroundColor:'#243026',alignItems:'center',justifyContent:'center'},
  playlistTitle:{color:'#fff',fontSize:20,fontWeight:'800',textAlign:'center',marginTop:20},
  cta:{backgroundColor:GREEN,borderRadius:13,alignItems:'center',padding:18,marginTop:20},
  ctaText:{color:'#080808',fontWeight:'900',letterSpacing:.7},
  foot:{fontSize:11,color:'#777',textAlign:'center',lineHeight:18,marginTop:20}
});
