import {useEffect,useState} from 'react';
import {Image,Text,View} from 'react-native';
import {useAppearance} from '../appearance';

type Props={
  uri?:string|null;
  name?:string|null;
  size?:number;
  group?:boolean;
};

/** Shared Messages / chat avatar. Falls back cleanly if URL is missing or broken. */
export default function ProfileAvatar({uri,name,size=46,group=false}:Props){
  const [failed,setFailed]=useState(false);
  const {scheme}=useAppearance();
  useEffect(()=>setFailed(false),[uri]);
  const valid=typeof uri==='string'&&/^https?:\/\//i.test(uri.trim());
  const first=group?'👥':(name?.trim().charAt(0).toUpperCase()||'?');
  const surface=scheme==='light'?'#EFE6E0':'#252525';
  const textColor=scheme==='light'?'#3B2218':'#FFFFFF';
  const circle={width:size,height:size,borderRadius:size/2};
  if(valid&&!failed&&!group){
    return <Image source={{uri:uri!.trim()}} onError={()=>setFailed(true)}
      accessibilityLabel={name?`${name} profile photo`:'Profile photo'}
      style={[circle,{backgroundColor:surface}]}/>;
  }
  return <View style={[circle,{backgroundColor:surface,alignItems:'center',justifyContent:'center'}]}>
    <Text style={{fontSize:group?size*.4:size*.37,fontWeight:'800',color:textColor}}>{first}</Text>
  </View>;
}
