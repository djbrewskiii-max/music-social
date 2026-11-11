import {Pressable, StyleSheet, Text} from 'react-native';
import {previewKey, useSongPreview} from '../preview-player';
import {useAppearance} from '../appearance';

type Props={
  song:string;
  artist:string;
  id?:string|null;
  kind?:'song'|'album';
  size?:'regular'|'compact';
};
export default function SongPreviewButton({song,artist,id,kind='song',size='regular'}:Props){
  const {activeKey,loadingKey,toggle}=useSongPreview();
  const {colors,scheme}=useAppearance();
  const key=previewKey({id,song,artist,kind});
  const loading=loadingKey===key,playing=activeKey===key;
  const diameter=size==='compact'?38:46;
  return <Pressable accessibilityRole="button"
    accessibilityLabel={loading?`Loading ${song} preview`:playing?`Pause ${song} preview`:`Play ${song} preview`}
    disabled={loading}
    onPress={()=>void toggle({id,song,artist,kind})}
    hitSlop={8}
    style={[styles.button,{width:diameter,height:diameter,borderRadius:diameter/2,
      borderColor:colors.accent,backgroundColor:scheme==='light'?'#EAF5ED':'#14251A'}]}>
    <Text style={{color:colors.accent,fontWeight:'900',fontSize:size==='compact'?14:17,marginLeft:playing?0:2}}>
      {loading?'…':playing?'❚❚':'▶'}
    </Text>
  </Pressable>;
}
const styles=StyleSheet.create({button:{
  borderWidth:1.4,alignItems:'center',justifyContent:'center',
}});
