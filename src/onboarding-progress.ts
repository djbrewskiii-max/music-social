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

export async function getOnboardingStage(userId:string):Promise<OnboardingStage|null>{
  if(!userId)return null;
  try{
    const stage=await AsyncStorage.getItem(key(userId));
    return stage==='setup-profile'||stage==='pick-artists'||stage==='core-four'||
      stage==='rotation-setup'||stage==='connect-music'?stage:null;
  }catch(error){console.log('Onboarding checkpoint read:',error);return null;}
}

export async function setOnboardingStage(userId:string,stage:OnboardingStage):Promise<void>{
  if(!userId)return;
  try{await AsyncStorage.setItem(key(userId),stage);}
  catch(error){console.log('Onboarding checkpoint write:',error);}
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
  // The server-side completion flag, not local storage, gates public discovery.
  const {data:completed,error}=await supabase.from('profiles')
    .update({onboarding_complete:true}).eq('user_id',userId)
    .select('user_id,onboarding_complete').single();
  if(error||!completed?.onboarding_complete)throw (error||new Error('Could not finish setup.'));
  try{await AsyncStorage.removeItem(key(userId));}
  catch(err){console.log('Onboarding checkpoint cleanup:',err);}
}
