import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {useEffect,useState} from 'react';
import {isOverlyIntroEnabled,setOverlyIntroEnabled} from '../overly-preferences';
import { useAppearance, type AppearancePreference } from '../appearance';
import { unregisterPushNotifications } from '../notifications';
import { supabase } from '../supabase';

type RowProps={
  icon:string;label:string;detail?:string;onPress:()=>void;first?:boolean;
};
export default function SettingsScreen(){
  const {colors,preference,setPreference}=useAppearance();
  const [introEnabled,setIntroEnabled]=useState(true);
  useEffect(()=>{let active=true;isOverlyIntroEnabled().then(next=>{if(active)setIntroEnabled(next);}).catch(()=>{});return()=>{active=false;};},[]);
  const toggleIntro=async()=>{const next=!introEnabled;try{await setOverlyIntroEnabled(next);setIntroEnabled(next);}catch{Alert.alert('Could not update preference','Please try again.');}};
  const row=({icon,label,detail,onPress,first}:RowProps)=>(
    <Pressable key={label} accessibilityRole="button" onPress={onPress}
      style={({pressed})=>[styles.row,!first&&{borderTopWidth:1,borderTopColor:colors.border},pressed&&{opacity:.65}]}>
      <View style={[styles.icon,{backgroundColor:colors.raised}]}>
        <SymbolView name={icon as any} size={19} tintColor={colors.text}
          fallback={<Text style={{color:colors.text}}>•</Text>}/>
      </View>
      <View style={{flex:1}}>
        <Text style={[styles.rowTitle,{color:colors.text}]}>{label}</Text>
        {!!detail&&<Text style={[styles.detail,{color:colors.secondary}]}>{detail}</Text>}
      </View>
      <Text style={{color:colors.secondary,fontSize:22}}>›</Text>
    </Pressable>
  );
  const group=(items:RowProps[])=>(
    <View style={[styles.group,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      {items.map(row)}
    </View>
  );
  const signOut=()=>Alert.alert('Sign out of OVRLEE?',undefined,[
    {text:'Cancel',style:'cancel'},
    {text:'Sign out',style:'destructive',onPress:async()=>{
      await unregisterPushNotifications();
      await supabase.auth.signOut();
      router.replace('/login');
    }}
  ]);
  const choices:AppearancePreference[]=['system','light','dark'];
  return <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
    <View style={[styles.header,{borderColor:colors.border}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={()=>router.back()} hitSlop={12}>
        <Text style={{fontSize:28,color:colors.text}}>‹</Text>
      </Pressable>
      <Text style={[styles.headerTitle,{color:colors.text}]}>Settings and activity</Text>
      <View style={{width:20}}/>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={{color:colors.secondary,fontSize:14}}>Make OVRLEE yours.</Text>
      <Text style={[styles.section,{color:colors.secondary}]}>YOUR ACCOUNT</Text>
      {group([
        {icon:'person.crop.circle',label:'Edit profile',detail:'Photo, bio, your Overly and city',onPress:()=>router.push('/edit-profile'),first:true},
        {icon:'location.circle',label:'Nearby privacy',detail:'Control where people can discover you',onPress:()=>router.push('/edit-profile')},
      ])}
      <Text style={[styles.section,{color:colors.secondary}]}>APPEARANCE</Text>
      <View style={[styles.group,{backgroundColor:colors.surface,borderColor:colors.border,padding:14}]}>
        <Text style={[styles.rowTitle,{color:colors.text}]}>App theme</Text>
        <Text style={[styles.detail,{color:colors.secondary,marginBottom:12}]}>
          Use your phone's appearance or choose a theme.
        </Text>
        <View style={{flexDirection:'row',gap:8}}>
          {choices.map(choice=>(
            <Pressable key={choice} accessibilityRole="radio"
              accessibilityState={{selected:preference===choice}}
              onPress={()=>void setPreference(choice)}
              style={[styles.choice,{borderColor:preference===choice?colors.accent:colors.border,
                backgroundColor:preference===choice?colors.raised:colors.surface}]}>
              <Text style={{color:preference===choice?colors.accent:colors.text,fontWeight:'800',fontSize:13}}>
                {choice==='system'?'System':choice==='light'?'Light':'Dark'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable accessibilityRole="switch" accessibilityState={{checked:introEnabled}}
        onPress={()=>void toggleIntro()}
        style={[styles.group,{backgroundColor:colors.surface,borderColor:colors.border,
          paddingHorizontal:16,paddingVertical:14,marginTop:10,
          flexDirection:'row',alignItems:'center',gap:10}]}>
        <View style={{flex:1}}>
          <Text style={[styles.rowTitle,{color:colors.text}]}>Opening animation</Text>
          <Text style={[styles.detail,{color:colors.secondary}]}>Show OVRLEE's intro when entering the app.</Text>
        </View>
        <Text style={{color:colors.accent,fontWeight:'900'}}>{introEnabled?'ON':'OFF'}</Text>
      </Pressable>
      <Text style={[styles.section,{color:colors.secondary}]}>MUSIC</Text>
      {group([
        {icon:'music.note',label:'Music service',detail:'Spotify or Apple Music playback',onPress:()=>router.push('/music-settings'),first:true},

      ])}
      <Text style={[styles.section,{color:colors.secondary}]}>ACTIVITY</Text>
      {group([
        {icon:'bell',label:'Notifications',detail:'Replies, likes, follows and messages',onPress:()=>router.push('/notification-settings'),first:true}
      ])}
      <Text style={[styles.section,{color:colors.secondary}]}>COMMUNITY</Text>
      {group([
        {icon:'hand.raised',label:'Community guidelines',detail:'Safe music conversations, reporting and blocking',onPress:()=>router.push('/community-guidelines'),first:true},
        {icon:'envelope',label:'Contact support',detail:'support@ovrlee.com',onPress:()=>void Linking.openURL('mailto:support@ovrlee.com?subject=OVRLEE%20support').catch(()=>Alert.alert('Contact support','Email support@ovrlee.com'))}
      ])}
      <Text style={[styles.section,{color:colors.secondary}]}>ACCOUNT</Text>
      {group([
        {icon:'trash',label:'Delete account',detail:'Permanently remove your OVRLEE account and data',
          onPress:()=>router.push('/delete-account'),first:true}
      ])}
      <Pressable onPress={signOut} accessibilityRole="button"
        style={[styles.signOut,{borderColor:colors.border}]}>
        <Text style={{color:'#C75D66',fontWeight:'800'}}>Sign out</Text>
      </Pressable>
      <View style={{alignItems:'center',marginTop:38}}>
        <Text style={{color:colors.text,fontWeight:'900',letterSpacing:2}}>OVRLEE <Text style={{color:colors.accent}}>✦</Text></Text>
        <Text style={[styles.detail,{color:colors.secondary}]}>Music is better when it's shared.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1},
  header:{height:60,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1},
  headerTitle:{fontSize:17,fontWeight:'900'},
  content:{padding:20,paddingBottom:90},
  section:{fontSize:11,fontWeight:'900',letterSpacing:1.4,marginTop:26,marginBottom:12,marginLeft:4},
  group:{borderWidth:1,borderRadius:16,paddingHorizontal:14},
  row:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14},
  icon:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},
  rowTitle:{fontSize:14,fontWeight:'800'},
  detail:{fontSize:11,lineHeight:17,marginTop:5},
  choice:{flex:1,paddingVertical:13,alignItems:'center',borderRadius:12,borderWidth:1},
  signOut:{marginTop:30,borderRadius:13,borderWidth:1,padding:17,alignItems:'center'}
});
