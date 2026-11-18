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
  if(!userId)return;
  try{await AsyncStorage.removeItem(key(userId));}
  catch(error){console.log('Onboarding checkpoint cleanup:',error);}
}
