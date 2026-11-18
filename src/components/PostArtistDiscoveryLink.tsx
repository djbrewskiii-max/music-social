import {router} from 'expo-router';
import {Alert, Pressable, Text} from 'react-native';
import {useAppearance} from '../appearance';
import {postArtistDiscovery} from '../post-artist-discovery';

/** One action for both the feed and opened-post view.
 * Never present a credited artist collective as one fictional artist.
 */
export default function PostArtistDiscoveryLink({
  credit,primaryArtist,song,sourcePostId,
}:{
  credit:string;
  primaryArtist?:string|null;
  song:string;
  sourcePostId:string;
}) {
  const {scheme}=useAppearance();
  const discovery=postArtistDiscovery(credit,primaryArtist);
  if(!discovery)return null;
  const go=(artist:string)=>router.push({
    pathname:'/music-discovery',
    params:{artist,song,sourcePostId},
  });
  const open=()=>{
    if(discovery.target){go(discovery.target);return;}
    Alert.alert('Choose an artist',undefined,[
      ...discovery.candidates.slice(0,8).map(artist=>({
        text:artist,onPress:()=>go(artist),
      })),
      {text:'Cancel',style:'cancel' as const},
    ]);
  };
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={discovery.target
        ? `Explore music conversations for ${discovery.target}`
        : 'Choose a credited artist to explore'}
      onPress={open}
      style={{
        alignSelf:'flex-start',maxWidth:'100%',marginTop:10,marginBottom:12,
        borderRadius:20,paddingVertical:9,paddingHorizontal:13,
        backgroundColor:scheme==='light'?'#F2E6E0':'#112315',
        borderWidth:1,borderColor:scheme==='light'?'#E2CFC3':'#284B30',
      }}>
      <Text numberOfLines={2} style={{
        color:scheme==='light'?'#3B2218':'#39E75F',
        fontSize:11,fontWeight:'900',letterSpacing:0.2,
      }}>{discovery.label}  →</Text>
    </Pressable>
  );
}
