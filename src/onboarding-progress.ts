import {supabase} from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Local navigation checkpoint for new first-run signup journeys.
 * Not an authorization mechanism or server-enforced completion requirement.
 * Older members without a checkpoint continue to Home unchanged.
 */
export type OnboardingStage =
  | 'setup-profile'
  | 'pick-artists'
  | 'core-four'
  | 'rotation-setup'
  | 'connect-music';

const key=(userId:string)=>'ovrlee:first-run-stage:'+userId;
const isStage=(stage:unknown):stage is OnboardingStage=>
  stage==='setup-profile'||stage==='pick-artists'||stage==='core-four'||
  stage==='rotation-setup'||stage==='connect-music';

export async function getOnboardingStage(userId:string):Promise<OnboardingStage|null>{
  if(!userId)return null;
  // Prefer durable server state so a member can resume on another iPhone.
  // Only read the signed-in account's private, RLS-protected profile.
  try{
    const {data:{user}}=await supabase.auth.getUser();
    if(user?.id===userId){
      const {data:profile,error}=await supabase.from('profiles')
        .select('onboarding_stage,onboarding_complete').eq('user_id',userId).maybeSingle();
      if(error)console.log('Onboarding checkpoint lookup:',error.message);
      else if(profile?.onboarding_complete===true)return null;
      else if(isStage(profile?.onboarding_stage))return profile.onboarding_stage;
    }
  }catch(error){console.log('Onboarding checkpoint lookup:',error);}
  // A signup can exist before a profile is inserted or an email is confirmed.
  try{
    const stage=await AsyncStorage.getItem(key(userId));
    return isStage(stage)?stage:null;
  }catch(error){console.log('Onboarding checkpoint read:',error);return null;}
}

export async function setOnboardingStage(userId:string,stage:OnboardingStage):Promise<void>{
  if(!userId)return;
  try{await AsyncStorage.setItem(key(userId),stage);}
  catch(error){console.log('Onboarding checkpoint write:',error);}
  // No profile exists at the beginning of registration; it will be created by
  // setup-profile. Later stages must persist to the server or report an error.
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.id!==userId)return;
  const {data,error}=await supabase.from('profiles')
    .update({onboarding_stage:stage})
    .eq('user_id',userId).eq('onboarding_complete',false)
    .select('user_id');
  if(error)throw error;
  if(stage!=='setup-profile' && (!data||data.length===0)){
    const {data:profile}=await supabase.from('profiles')
      .select('onboarding_complete').eq('user_id',userId).maybeSingle();
    if(profile?.onboarding_complete!==true)
      throw new Error('Could not save your setup progress.');
  }
}

export async function finishOnboarding(userId:string):Promise<void>{
  if(!userId)throw new Error('Sign in to finish setting up OVRLEE.');
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.id!==userId)throw new Error('The active account changed. Sign in again.');
  const {data:profile,error:readError}=await supabase.from('profiles')
    .select('display_name,username').eq('user_id',userId).maybeSingle();
  if(readError)throw readError;
  if(!profile?.display_name?.trim()||!profile?.username?.trim())
    throw new Error('Choose a display name and username before entering OVRLEE.');
  const {count,error:artistError}=await supabase.from('music_taste_artists')
    .select('artist_key',{count:'exact',head:true})
    .eq('user_id',userId).eq('source','favorite');
  if(artistError)throw artistError;
  if((count||0)<5)
    throw new Error('Choose five favorite artists before finishing setup.');
  // The server enforces five distinct saved favorites via a database trigger,
  // even if a modified app attempts to bypass this flow.
  const {data:completed,error}=await supabase.from('profiles')
    .update({onboarding_complete:true,onboarding_stage:null}).eq('user_id',userId)
    .select('user_id,onboarding_complete').single();
  if(error||!completed?.onboarding_complete)throw (error||new Error('Could not finish setup.'));
  try{await AsyncStorage.removeItem(key(userId));}
  catch(err){console.log('Onboarding checkpoint cleanup:',err);}
}
