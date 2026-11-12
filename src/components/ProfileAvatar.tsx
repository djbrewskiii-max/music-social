import {useState} from 'react';
import {Image,Text,View} from 'react-native';
import {useAppearance} from '../appearance';

type Props={
  uri?:string|null;
  name?:string|null;
  size?:number;
  group?:boolean;
};

/** An image owns its own failure state, and remounts if the URL changes. */
function AvatarImage({uri,name,size,surface}:{uri:string;name?:string|null;size:number;surface:string}){
  const [failed,setFailed]=useState(false);
  if(failed)return null;
  return <Image source={{uri}} onError={()=>setFailed(true)}
    accessibilityLabel={name?`${name} profile photo`:'Profile photo'}
    style={{width:size,height:size,borderRadius:size/2,backgroundColor:surface}}/>;
}

/** Shared Messages / chat avatar. Falls back cleanly if URL is missing or broken. */
export default function ProfileAvatar({uri,name,size=46,group=false}:Props){
  const {scheme}=useAppearance();
  const valid=typeof uri==='string'&&/^https?:\/\//i.test(uri.trim());
  const first=group?'👥':(name?.trim().charAt(0).toUpperCase()||'?');
  const surface=scheme==='light'?'#EFE6E0':'#252525';
  const textColor=scheme==='light'?'#3B2218':'#FFFFFF';
  const circle={width:size,height:size,borderRadius:size/2};
  if(valid&&!group){
    // Keep fallback behind the photo to avoid a blank avatar on load error.
    return <View style={[circle,{overflow:'hidden',backgroundColor:surface,alignItems:'center',justifyContent:'center'}]}>
      <Text style={{position:'absolute',fontSize:size*.37,fontWeight:'800',color:textColor}}>{first}</Text>
      <AvatarImage key={uri!.trim()} uri={uri!.trim()} name={name} size={size} surface={surface}/>
    </View>;
  }
  return <View style={[circle,{backgroundColor:surface,alignItems:'center',justifyContent:'center'}]}>
    <Text style={{fontSize:group?size*.4:size*.37,fontWeight:'800',color:textColor}}>{first}</Text>
  </View>;
}
