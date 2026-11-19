import {useMemo} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {useAppearance} from '../appearance';
import PostArtistDiscoveryLink from './PostArtistDiscoveryLink';

type MusicItem={artist?:string|null;song?:string|null};

/**
 * One discovery entry per distinct credited artist in a collection.
 * Combined credits retain the existing artist chooser rather than inventing
 * a canonical act (e.g. "Simon & Garfunkel" must not split automatically).
 */
export default function CollectionArtistDiscoveryLinks({
  items,sourcePostId,
}:{items:MusicItem[]|null|undefined;sourcePostId:string}){
  const {colors}=useAppearance();
  const artists=useMemo(()=>{
    const seen=new Set<string>();
    return (items||[]).flatMap(item=>{
      const credit=String(item?.artist||'').trim();
      const key=credit.normalize('NFKD').toLowerCase().replace(/\s+/g,' ');
      if(!key||seen.has(key))return [];
      seen.add(key);
      return [{credit,song:String(item.song||'')}];
    });
  },[items]);
  if(!artists.length)return null;
  return <View style={{marginTop:7}}>
    <Text style={{color:colors.secondary,fontSize:10,fontWeight:'800',
      letterSpacing:1.1,marginBottom:3}}>EXPLORE THE ARTISTS</Text>
    <ScrollView horizontal keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingRight:20}}>
      {artists.map(({credit,song})=><PostArtistDiscoveryLink
        key={credit.toLowerCase()} credit={credit} song={song} sourcePostId={sourcePostId}/>)}
    </ScrollView>
  </View>;
}
