import {Alert, Share} from 'react-native';

/** Stable in-app URI. Works in an installed iOS OVRLEE build.
 * A public https:// universal link requires a verified domain and web fallback.
 * Never substitute an Expo Metro host URL for a public share link.
 */
export function postDeepLink(postId:string):string {
  return `ovrlee://post?postId=${encodeURIComponent(postId)}`;
}

/** Clickable web fallback backed by OVRLEE's public, data-free landing function. */
export function postShareUrl(postId:string):string{
  const projectUrl=process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
  return projectUrl
    ? `${projectUrl}/functions/v1/ovrlee-post-link?postId=${encodeURIComponent(postId)}`
    : postDeepLink(postId);
}

export type SharePostDetails={
  id:string;
  songTitle?:string|null;
  artistName?:string|null;
  displayName?:string|null;
  caption?:string|null;
};

export async function shareOVRLEEPost(post:SharePostDetails):Promise<void>{
  if(!post.id)return;
  const song=post.songTitle?.trim()||'';
  const artist=post.artistName?.trim()||'';
  const user=post.displayName?.trim()||'Someone';
  const description=song&&artist ? `“${song}” by ${artist}` : 'a music conversation';
  const title=`See ${user}'s post on OVRLEE`;
  const message=`${title}\n${description}\n${postShareUrl(post.id)}`;
  try{
    await Share.share({message,title},{dialogTitle:'Share an OVRLEE post'});
  }catch(error){
    const reason=error instanceof Error?error.message:'Try again.';
    Alert.alert('Couldn’t share this post',reason);
  }
}
