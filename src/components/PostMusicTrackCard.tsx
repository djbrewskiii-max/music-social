import {Alert,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {useAppearance} from '../appearance';
import {addToRotation} from '../music-card';
import SongPreviewButton from './SongPreviewButton';

export type PostMusicTrack={
  id?:string|null;
  song:string;
  artist:string;
  artworkUrl?:string|null;
  kind?:'song'|'album';
};

/** Identical compact single-track presentation on FYP and post details. */
export default function PostMusicTrackCard({
  track,albumName,onOpen,
}:{
  track:PostMusicTrack;
  albumName?:string|null;
  onOpen:()=>void|Promise<void>;
}){
  const {scheme}=useAppearance();
  const light=scheme==='light';
  const ink=light?'#3B2218':'#FFFFFF';
  const muted=light?'#796C65':'#A1A9A2';
  const background=light?'#FFFFFF':'#0D0D0D';
  const border=light?'#E1D4CC':'#303030';
  const pin=async()=>{
    const result=await addToRotation({
      song:track.song,artist:track.artist,artworkUrl:track.artworkUrl,
    });
    Alert.alert(result==='added'?'Added to rotation':
      result==='already'?'Already in rotation':
      result==='full'?'Rotation is full':'Could not save song',
      result==='added'?'You can see this song in your profile.':
      result==='already'?'This song is already in your rotation.':
      result==='full'?'Remove a song from your rotation to add another.':
      'Please try again.');
  };
  return <View style={[styles.card,{backgroundColor:background,borderColor:border}]}>
    <Pressable accessibilityRole="button"
      accessibilityLabel={`Open ${track.song} in your music service`}
      onPress={()=>void onOpen()} style={styles.songPress}>
      {track.artworkUrl
        ? <Image source={{uri:track.artworkUrl}} style={styles.artwork}/>
        : <View style={[styles.artwork,styles.fallback,{backgroundColor:light?'#F2EBE6':'#232323'}]}>
            <Text style={{fontSize:21,color:muted}}>♪</Text>
          </View>}
      <View style={styles.description}>
        <Text style={[styles.title,{color:ink}]} numberOfLines={2}>{track.song}</Text>
        <Text style={[styles.artist,{color:muted}]} numberOfLines={2}>{track.artist}</Text>
        {!!albumName&&<Text style={[styles.album,{color:muted}]} numberOfLines={1}>{albumName}</Text>}
      </View>
    </Pressable>
    <View style={styles.actions}>
      {track.kind === 'album' ? (
        <Pressable hitSlop={8} accessibilityRole="button"
          accessibilityLabel={`Open album ${track.song} in your music service`}
          onPress={()=>void onOpen()} style={styles.rotationButton}>
          <Text style={[styles.rotation,{color:light?'#3B2218':'#39E75F'}]}>OPEN ALBUM</Text>
        </Pressable>
      ) : (
        <>
          <SongPreviewButton size="compact" id={track.id||undefined}
            song={track.song} artist={track.artist} kind="song"/>
          <Pressable hitSlop={8} accessibilityRole="button"
            accessibilityLabel={`Add ${track.song} to your rotation`}
            onPress={()=>void pin()} style={styles.rotationButton}>
            <Text style={[styles.rotation,{color:light?'#3B2218':'#39E75F'}]}>+ ROTATION</Text>
          </Pressable>
        </>
      )}
    </View>
  </View>;
}

const styles=StyleSheet.create({
  card:{borderWidth:1,borderRadius:16,padding:13,flexDirection:'row',
    alignItems:'center',gap:8,marginTop:12},
  songPress:{flex:1,flexDirection:'row',alignItems:'center',gap:11,minWidth:0},
  artwork:{width:59,height:59,borderRadius:8},
  fallback:{justifyContent:'center',alignItems:'center'},
  description:{flex:1,minWidth:0},
  title:{fontSize:14,fontWeight:'900'},
  artist:{fontSize:12,marginTop:4},
  album:{fontSize:10,marginTop:3},
  actions:{alignItems:'center',gap:5,minWidth:66},
  rotationButton:{paddingHorizontal:2,paddingVertical:4},
  rotation:{fontSize:9,fontWeight:'900',letterSpacing:0.4},
});
