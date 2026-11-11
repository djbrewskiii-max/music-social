/** Launch moderation intake: the public client can submit, not review, reports. */
import {Alert} from 'react-native';
import {supabase} from './supabase';

type Reason='spam'|'harassment'|'hate_or_abuse'|'other';

async function submitPostReport(postId:string,authorId:string,reason:Reason) {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){
    Alert.alert('Sign in required','Sign in to report a post.');
    return;
  }
  if(user.id===authorId){
    Alert.alert('This is your post','You can manage your own content on your profile.');
    return;
  }
  const {error}=await supabase.from('post_reports').insert({
    reporter_id:user.id,post_id:postId,reported_user_id:authorId,reason
  });
  if(error?.code==='23505'){
    Alert.alert('Already reported','Your report for this post has already been received.');
  }else if(error){
    Alert.alert('Could not send report','Please try again later.');
    console.log('Post report failed:',error.message);
  }else{
    Alert.alert('Report received','Thanks. Your report has been submitted for review.');
  }
}

export function openPostReportDialog(postId:string,authorId:string){
  Alert.alert('Report post','Why are you reporting this post?',[
    {text:'Spam or misleading',onPress:()=>void submitPostReport(postId,authorId,'spam')},
    {text:'Harassment or bullying',onPress:()=>void submitPostReport(postId,authorId,'harassment')},
    {text:'Hateful or abusive content',onPress:()=>void submitPostReport(postId,authorId,'hate_or_abuse')},
    {text:'Something else',onPress:()=>void submitPostReport(postId,authorId,'other')},
    {text:'Cancel',style:'cancel'}
  ]);
}
