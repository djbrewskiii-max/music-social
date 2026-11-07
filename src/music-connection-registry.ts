/**
 * One-time migration of an existing local, self-declared public profile link
 * into the member's private server-side connection registry.
 *
 * This never contacts Spotify, and does not refresh public content.
 * It never overwrites an existing server connection or its sharing settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { normalizePublicProfile } from './spotify-public-reader';

export async function reconcileExistingMusicConnection(userId:string):Promise<void>{
  const {data:already,error:readError}=await supabase
    .from('member_music_connections')
    .select('user_id').eq('user_id',userId).maybeSingle();
  if(readError||already)return;

  const raw=await AsyncStorage.getItem('ovrlee.spotifyPublicProfile.'+userId);
  if(!raw)return;

  let parsed:{url?:string;mine?:boolean;confirmed?:boolean};
  try{parsed=JSON.parse(raw) as typeof parsed;}catch{return;}
  if(parsed.mine!==true||parsed.confirmed!==true||!parsed.url)return;

  let profile:{userId:string;url:string};
  try{profile=normalizePublicProfile(parsed.url);}catch{return;}

  // A conservative insert: privacy opt-in is not presumed from a stale
  // local preference. The owner can manage sharing in Music Settings.
  const {error}=await supabase.from('member_music_connections').insert({
    user_id:userId,
    provider:'spotify',
    provider_user_id:profile.userId,
    public_profile_url:profile.url,
    self_declared_owner:true,
    used_for_private_suggestions:true,
    share_playlist_artists:false,
  });
  if(error&&error.code!=='23505')console.log('Music connection registry:',error.message);
}
