import {router} from 'expo-router';
import {useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {useAppearance} from '../appearance';
import {supabase} from '../supabase';

export default function DeleteAccountScreen(){
  const {colors,scheme}=useAppearance();
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const enabled=confirmation.trim()==='DELETE'&&!busy;
  const finish=async()=>{
    if(!enabled)return;
    setBusy(true);
    try{
      const {data,error}=await supabase.functions.invoke('ovrlee-delete-account',{
        body:{confirmation:'DELETE'}
      });
      if(error||!data?.deleted)throw new Error(
        typeof data?.error==='string'?data.error:'Could not complete deletion. Please try again.'
      );
      await supabase.auth.signOut();
      router.replace('/signup');
    }catch(error){
      Alert.alert('Deletion was not completed',
        error instanceof Error?error.message:'Please try again or contact support.');
    }finally{setBusy(false);}
  };
  const ask=()=>{
    if(!enabled)return;
    Alert.alert('Permanently delete your OVRLEE account?',
      'Your profile, posts, messages, collections and saved music data will be removed. This cannot be undone.',[
      {text:'Keep my account',style:'cancel'},
      {text:'Delete permanently',style:'destructive',onPress:()=>void finish()}
    ]);
  };
  return <SafeAreaView style={[s.root,{backgroundColor:colors.background}]}>
    <View style={[s.header,{borderBottomColor:colors.border}]}>
      <Pressable onPress={()=>router.back()} disabled={busy} hitSlop={12}
        accessibilityRole="button" accessibilityLabel="Back to settings">
        <Text style={[s.back,{color:colors.text}]}>‹</Text>
      </Pressable>
      <Text style={[s.headerTitle,{color:colors.text}]}>DELETE ACCOUNT</Text>
      <View style={{width:28}}/>
    </View>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={[s.title,{color:colors.text}]}>Leave OVRLEE?</Text>
        <Text style={[s.description,{color:colors.secondary}]}>
          This permanently deletes your account and its content. You will lose
          your profile, music identity, posts, comments, chats, saved music data
          and account access. There is no undo.
        </Text>
        <Text style={[s.description,{color:colors.secondary}]}>
          If you only need a break, you can sign out instead. You can also
          change notifications and music preferences without deleting your account.
        </Text>
        <Text style={[s.label,{color:colors.text}]}>Type DELETE to confirm</Text>
        <TextInput
          value={confirmation} onChangeText={setConfirmation}
          placeholder="DELETE" placeholderTextColor={colors.secondary}
          editable={!busy} autoCapitalize="characters" autoCorrect={false}
          accessibilityLabel="Type DELETE to confirm account deletion"
          style={[s.input,{backgroundColor:colors.surface,borderColor:colors.border,color:colors.text}]}
        />
        <Pressable disabled={!enabled} accessibilityRole="button"
          accessibilityState={{disabled:!enabled}}
          onPress={ask} style={[s.deleteButton,{opacity:enabled?1:0.45}]}>
          {busy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.deleteLabel}>DELETE MY ACCOUNT</Text>}
        </Pressable>
        <Pressable disabled={busy} onPress={()=>router.back()} style={s.cancel} accessibilityRole="button">
          <Text style={{color:colors.text,fontWeight:'800'}}>KEEP MY ACCOUNT</Text>
        </Pressable>
        <Text style={[s.note,{color:colors.secondary}]}>
          Your deletion request is processed by OVRLEE’s authenticated account service.
          If it cannot be completed, your account is not reported as deleted.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  root:{flex:1},
  header:{height:60,borderBottomWidth:1,paddingHorizontal:20,alignItems:'center',justifyContent:'space-between',flexDirection:'row'},
  back:{fontSize:31,fontWeight:'500'},
  headerTitle:{fontWeight:'900',fontSize:12,letterSpacing:1.2},
  content:{padding:24,paddingTop:42,paddingBottom:90},
  title:{fontWeight:'900',fontSize:32},
  description:{fontSize:14,lineHeight:23,marginTop:16},
  label:{fontSize:12,fontWeight:'900',marginTop:34,marginBottom:10},
  input:{borderWidth:1,borderRadius:12,paddingHorizontal:16,paddingVertical:15,fontSize:17,letterSpacing:1.5},
  deleteButton:{marginTop:23,backgroundColor:'#B9434E',borderRadius:13,paddingVertical:18,alignItems:'center'},
  deleteLabel:{fontSize:12,color:'#FFFFFF',fontWeight:'900',letterSpacing:1},
  cancel:{marginTop:22,alignItems:'center',paddingVertical:14},
  note:{marginTop:26,fontSize:11,lineHeight:19,textAlign:'center'}
});