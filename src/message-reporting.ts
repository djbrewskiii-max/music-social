import {Alert} from 'react-native';
import {supabase} from './supabase';

type Reason='spam'|'harassment'|'hate_or_abuse'|'other';

async function submitMessageReport(messageId:string,conversationId:string,senderId:string,reason:Reason){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){
    Alert.alert('Sign in required','Sign in to report a message.');
    return;
  }
  if(user.id===senderId)return;
  const {error}=await supabase.from('message_reports').insert({
    reporter_id:user.id,message_id:messageId,
    reported_user_id:senderId,conversation_id:conversationId,reason
  });
  if(error?.code==='23505'){
    Alert.alert('Already reported','Your report for this message has already been received.');
  }else if(error){
    Alert.alert('Could not submit report','Please try again later.');
  }else{
    Alert.alert('Report received','Thank you. This message was submitted for moderation review.');
  }
}

/** Explicitly user-initiated: nothing is automatically reported or shared. */
export function openMessageReportDialog(messageId:string,conversationId:string,senderId:string){
  Alert.alert('Report message','Why are you reporting this message?',[
    {text:'Spam or misleading',onPress:()=>void submitMessageReport(messageId,conversationId,senderId,'spam')},
    {text:'Harassment or bullying',onPress:()=>void submitMessageReport(messageId,conversationId,senderId,'harassment')},
    {text:'Hateful or abusive',onPress:()=>void submitMessageReport(messageId,conversationId,senderId,'hate_or_abuse')},
    {text:'Other',onPress:()=>void submitMessageReport(messageId,conversationId,senderId,'other')},
    {text:'Cancel',style:'cancel'}
  ]);
}
