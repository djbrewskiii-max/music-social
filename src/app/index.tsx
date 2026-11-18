import { Redirect } from 'expo-router';
import { useAppearance } from '../appearance';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { supabase } from '../supabase';
import {getOnboardingStage,type OnboardingStage} from '../onboarding-progress';

type Destination='signup'|'now'|OnboardingStage;

export default function HomeScreen(){
  const {colors}=useAppearance();
  const [destination,setDestination]=useState<Destination|null>(null);

  useEffect(()=>{
    let active=true;
    let request=0;
    const route=async(userId?:string)=>{
      const current=++request;
      const next:Destination=userId
        ? (await getOnboardingStage(userId))||'now'
        : 'signup';
      if(active&&request===current)setDestination(next);
    };
    void supabase.auth.getSession()
      .then(({data:{session}})=>route(session?.user?.id))
      .catch(()=>{if(active)setDestination('signup');});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      void route(session?.user?.id);
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  if(!destination)return <SafeAreaView style={[styles.loadingScreen,{backgroundColor:colors.background}]}>
    <ActivityIndicator size="small" color={colors.accent}/>
  </SafeAreaView>;
  if(destination==='setup-profile')return <Redirect href="/setup-profile"/>;
  if(destination==='pick-artists')return <Redirect href="/pick-artists"/>;
  if(destination==='core-four')return <Redirect href={{pathname:'/core-four',params:{onboarding:'1'}}}/>;
  if(destination==='rotation-setup')return <Redirect href={{pathname:'/rotation-setup',params:{onboarding:'1'}}}/>;
  if(destination==='connect-music')return <Redirect href="/connect-music"/>;
  if(destination==='now')return <Redirect href="/now"/>;
  return <Redirect href="/signup"/>;
}

const styles=StyleSheet.create({
  loadingScreen:{flex:1,backgroundColor:'#090909',justifyContent:'center',alignItems:'center'}
});
