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
      let next:Destination='signup';
      if(userId){
        const [stage,profileResult]=await Promise.all([
          getOnboardingStage(userId),
          supabase.from('profiles').select('display_name,username,onboarding_complete')
            .eq('user_id',userId).maybeSingle(),
        ]);
        const profile=profileResult.data;
        // Auth sign-up is not a finished member identity. Do not route into
        // a public feed or generic "Listener/@nowuser" placeholder profile.
        if(profileResult.error || !profile?.display_name?.trim() || !profile?.username?.trim())
          next='setup-profile';
        else if(profile.onboarding_complete===false)
          next=stage && stage!=='setup-profile' ? stage : 'pick-artists';
        else next='now';
      }
      if(active&&request===current)setDestination(next);
    };
    void supabase.auth.getSession()
      .then(({data:{session}})=>route(session?.user?.id))
      .catch(()=>{if(active)setDestination('signup');});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      // Defer requests until Supabase releases its auth-state callback lock.
      setTimeout(()=>{if(active)void route(session?.user?.id);},0);
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
