import {useAppearance} from '../appearance';
import {router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import {useCallback,useMemo,useState} from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
 ActivityIndicator,Alert,Image,KeyboardAvoidingView,Platform,Pressable,
 SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View,
} from 'react-native';
import ProfileAvatar from '../components/ProfileAvatar';
import {supabase} from '../supabase';

type Member={
 user_id:string;username:string;display_name:string|null;avatar_url:string|null;
 role:'admin'|'member';
};
const CHOCOLATE='#3B2218';
const GREEN='#39E75F';
const errorText=(e:unknown)=>e instanceof Error?e.message:'Try again.';

export default function GroupInfoScreen(){
 const {id}=useLocalSearchParams<{id?:string}>();
 const groupId=typeof id==='string'?id:'';
 const {scheme,colors}=useAppearance();
 const ink=colors.text,sub=colors.secondary,accent=colors.accent;
 const s=useMemo(()=>makeStyles(scheme),[scheme]);
 const [userId,setUserId]=useState('');
 const [title,setTitle]=useState('');
 const [imageUrl,setImageUrl]=useState('');
 const [members,setMembers]=useState<Member[]>([]);
 const [canEdit,setCanEdit]=useState(true);
 const [canInvite,setCanInvite]=useState(true);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [photoBusy,setPhotoBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [mutuals,setMutuals]=useState<Member[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [addOpen,setAddOpen]=useState(false);

 const load=useCallback(async()=>{
   if(!groupId){router.back();return;}
   setLoading(true);
   try{
     const {data:{user}}=await supabase.auth.getUser();
     if(!user)throw new Error('Sign in to open this group.');
     const [conversation,memberResult,following,followers,blocks,blockedBy]=await Promise.all([
       supabase.from('conversations').select('id,is_group,title,image_url,members_can_edit,members_can_invite')
         .eq('id',groupId).maybeSingle(),
       supabase.from('conversation_members').select('user_id,role,joined_at')
         .eq('conversation_id',groupId).order('joined_at'),
       supabase.from('user_follows').select('following_id').eq('follower_id',user.id),
       supabase.from('user_follows').select('follower_id').eq('following_id',user.id),
       supabase.from('user_blocks').select('blocked_id').eq('blocker_id',user.id),
       supabase.from('user_blocks').select('blocker_id').eq('blocked_id',user.id),
     ]);
     for(const entry of [conversation,memberResult,following,followers,blocks,blockedBy])
       if(entry.error)throw entry.error;
     if(!conversation.data?.is_group || !(memberResult.data||[]).some(m=>m.user_id===user.id))
       throw new Error('This group is unavailable.');
     const memberRows=memberResult.data||[];
     const memberIds=memberRows.map(m=>m.user_id);
     const followingIds=new Set((following.data||[]).map(v=>v.following_id));
     const hidden=new Set([
       ...(blocks.data||[]).map(v=>v.blocked_id),
       ...(blockedBy.data||[]).map(v=>v.blocker_id),
     ]);
     const choices=(followers.data||[]).map(v=>v.follower_id)
       .filter(v=>v!==user.id && followingIds.has(v) && !hidden.has(v)
         && !memberIds.includes(v));
     const allIds=[...new Set([...memberIds,...choices])];
     const people=allIds.length?await supabase.from('profiles')
       .select('user_id,username,display_name,avatar_url')
       .in('user_id',allIds).eq('onboarding_complete',true)
       :{data:[],error:null};
     if(people.error)throw people.error;
     const personById=new Map((people.data||[]).map(p=>[p.user_id,p]));
     const toMember=(id:string,role:'admin'|'member'):Member=>{
       const p=personById.get(id);
       return {user_id:id,username:p?.username||'member',
         display_name:p?.display_name||null,avatar_url:p?.avatar_url||null,role};
     };
     setUserId(user.id);
     setMembers(memberRows.map(m=>toMember(m.user_id,m.role as 'admin'|'member')));
     setMutuals(choices.filter(uid=>personById.has(uid)).map(uid=>toMember(uid,'member')));
     setTitle(conversation.data.title||'');
     setImageUrl(conversation.data.image_url||'');
     setCanEdit(conversation.data.members_can_edit!==false);
     setCanInvite(conversation.data.members_can_invite!==false);
     setSelected([]);
   }catch(error){Alert.alert('Could not open group',errorText(error));}
   finally{setLoading(false);}
 },[groupId]);
 useFocusEffect(useCallback(()=>{void load();},[load]));

 const amAdmin=members.some(m=>m.user_id===userId&&m.role==='admin');
 const allowEdit=amAdmin||canEdit;
 const allowInvite=amAdmin||canInvite;
 const searchTerm=search.trim().replace(/^@/,'').toLowerCase();
 const choices=mutuals.filter(p=>
   !searchTerm || p.username.toLowerCase().includes(searchTerm)||
   (p.display_name||'').toLowerCase().includes(searchTerm));

 const saveDetails=async()=>{
   if(!allowEdit || saving || photoBusy)return;
   setSaving(true);
   try{
     const {error}=await supabase.rpc('update_group_details',{
       p_conversation:groupId,p_title:title.trim(),p_image_url:imageUrl||'',
     });
     if(error)throw error;
     Alert.alert('Group updated','Everyone in the group will see the new details.');
   }catch(error){Alert.alert('Could not update group',errorText(error));}
   finally{setSaving(false);}
 };

 const chooseImage=async()=>{
   if(!allowEdit||photoBusy)return;
   setPhotoBusy(true);
   try{
     const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
     if(!permission.granted)throw new Error('Allow photo access to choose a group image.');
     const selectedImage=await ImagePicker.launchImageLibraryAsync({
       mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.75,
     });
     if(selectedImage.canceled)return;
     const asset=selectedImage.assets?.[0];
     if(!asset?.uri)throw new Error('Choose a valid photo.');
     const {data:{user}}=await supabase.auth.getUser();
     if(!user||user.id!==userId)throw new Error('Sign in again.');
     const response=await fetch(asset.uri);
     if(!response.ok)throw new Error('Could not read your image.');
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength>5*1024*1024)throw new Error('Use an image smaller than 5 MB.');
     const mime=asset.mimeType==='image/png'?'image/png':
       asset.mimeType==='image/webp'?'image/webp':'image/jpeg';
     const extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
     const file=user.id+'/'+groupId+'-'+Date.now()+'.'+extension;
     const {error}=await supabase.storage.from('group-media').upload(file,bytes,{
       contentType:mime,upsert:false,cacheControl:'3600',
     });
     if(error)throw error;
     const {data:publicUrl}=supabase.storage.from('group-media').getPublicUrl(file);
     if(!publicUrl.publicUrl)throw new Error('Image URL missing.');
     // An image is published only after the member taps Save.
     setImageUrl(publicUrl.publicUrl);
   }catch(error){Alert.alert('Could not choose photo',errorText(error));}
   finally{setPhotoBusy(false);}
 };

 const invite=async()=>{
   if(!allowInvite||!selected.length||saving)return;
   setSaving(true);
   try{
     const {error}=await supabase.rpc('invite_group_members',{
       p_conversation:groupId,p_member_ids:selected,
     });
     if(error)throw error;
     setAddOpen(false);setSearch('');
     await load();
   }catch(error){Alert.alert('Could not add people',errorText(error));}
   finally{setSaving(false);}
 };

 const changePermissions=async(nextEdit:boolean,nextInvite:boolean)=>{
   if(!amAdmin||saving)return;
   setSaving(true);
   try{
     const {error}=await supabase.rpc('set_group_permissions',{
       p_conversation:groupId,p_members_can_edit:nextEdit,p_members_can_invite:nextInvite,
     });
     if(error)throw error;
     setCanEdit(nextEdit);setCanInvite(nextInvite);
   }catch(error){Alert.alert('Could not change permissions',errorText(error));}
   finally{setSaving(false);}
 };

 const setRole=(member:Member,makeAdmin:boolean)=>{
   if(!amAdmin)return;
   Alert.alert(makeAdmin?'Make admin?':'Remove admin role?',
     `Change @${member.username}'s group permissions?`,[
       {text:'Cancel',style:'cancel'},
       {text:'Continue',onPress:async()=>{
         const {error}=await supabase.rpc('set_group_member_role',{
           p_conversation:groupId,p_member_id:member.user_id,p_make_admin:makeAdmin,
         });
         if(error)Alert.alert('Could not change role',error.message);
         else await load();
       }},
     ]);
 };

 const removeMember=(member:Member)=>{
   if(!amAdmin||member.user_id===userId)return;
   Alert.alert('Remove from group?',`Remove @${member.username}?`,[
     {text:'Cancel',style:'cancel'},
     {text:'Remove',style:'destructive',onPress:async()=>{
       const {error}=await supabase.rpc('remove_group_member',{
         p_conversation:groupId,p_member_id:member.user_id,
       });
       if(error)Alert.alert('Could not remove member',error.message);
       else await load();
     }},
   ]);
 };

 const leave=()=>Alert.alert('Leave this group?','You will no longer receive messages here.',[
   {text:'Cancel',style:'cancel'},
   {text:'Leave Group',style:'destructive',onPress:async()=>{
     const {error}=await supabase.rpc('leave_group_chat',{p_conversation:groupId});
     if(error){Alert.alert('Could not leave group',error.message);return;}
     router.replace('/messages');
   }},
 ]);

 if(loading)return <SafeAreaView style={[s.root,{backgroundColor:colors.background,
   alignItems:'center',justifyContent:'center'}]}>
   <ActivityIndicator color={accent}/>
 </SafeAreaView>;

 return <SafeAreaView style={[s.root,{backgroundColor:colors.background}]}>
   <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
       <View style={s.top}>
         <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.topAction}>
           <Text style={{color:accent,fontWeight:'800'}}>‹ Back</Text>
         </Pressable>
         <Text style={[s.headerTitle,{color:ink}]}>Group details</Text>
         <View style={s.topAction}/>
       </View>

       <View style={s.hero}>
         <ProfileAvatar group size={96} uri={imageUrl} name={title}/>
         <Text style={[s.title,{color:ink}]}>{title||'Your group'}</Text>
         <Text style={[s.caption,{color:sub}]}>{members.length} members</Text>
       </View>

       {allowEdit&&<View style={s.section}>
         <Text style={[s.label,{color:sub}]}>NAME & IMAGE</Text>
         <Pressable onPress={()=>void chooseImage()} disabled={photoBusy||saving}
           accessibilityRole="button" style={[s.action,{borderColor:colors.border,backgroundColor:colors.surface}]}>
           {photoBusy?<ActivityIndicator color={accent}/>:<Text style={{color:accent,fontWeight:'800'}}>Change group image</Text>}
         </Pressable>
         <TextInput value={title} onChangeText={setTitle} maxLength={60}
           accessibilityLabel="Group name" placeholder="Group name"
           placeholderTextColor={sub} style={[s.field,{backgroundColor:colors.surface,
             borderColor:colors.border,color:ink}]}/>
         <Pressable onPress={()=>void saveDetails()} disabled={saving||photoBusy}
           accessibilityRole="button"
           style={[s.primary,{backgroundColor:accent,opacity:saving||photoBusy?.5:1}]}>
           <Text style={{color:colors.accentText,fontWeight:'900'}}>
             {saving?'SAVING…':'SAVE CHANGES'}
           </Text>
         </Pressable>
       </View>}

       <Pressable accessibilityRole="button" accessibilityLabel="Search messages in this group"
         onPress={()=>router.replace({pathname:'/chat',params:{id:groupId,search:'1'}})}
         style={[s.action,{borderColor:colors.border,backgroundColor:colors.surface}]}>
         <Text style={{color:accent,fontWeight:'800'}}>Search messages →</Text>
       </Pressable>

       <View style={s.section}>
         <View style={s.sectionHead}>
           <Text style={[s.label,{color:sub}]}>PEOPLE · {members.length}</Text>
           {allowInvite&&<Pressable accessibilityRole="button" onPress={()=>setAddOpen(v=>!v)}>
             <Text style={{color:accent,fontWeight:'900'}}>+ Add people</Text>
           </Pressable>}
         </View>

         {addOpen&&<View style={{paddingBottom:12}}>
           <TextInput value={search} onChangeText={setSearch}
             placeholder="Search mutuals by @username" placeholderTextColor={sub}
             autoCapitalize="none" autoCorrect={false}
             accessibilityLabel="Search people to invite"
             style={[s.field,{color:ink,backgroundColor:colors.surface,borderColor:colors.border}]}/>
           {!choices.length&&<View style={{gap:9,paddingVertical:12}}>
             <Text style={{color:sub,fontSize:13}}>No available mutuals found.</Text>
             <Pressable accessibilityRole="button" onPress={()=>router.push('/listeners')}>
               <Text style={{color:accent,fontWeight:'800'}}>Find people →</Text>
             </Pressable>
           </View>}
           {choices.map(person=><Pressable key={person.user_id} accessibilityRole="checkbox"
             accessibilityState={{checked:selected.includes(person.user_id)}}
             onPress={()=>setSelected(old=>old.includes(person.user_id)
               ?old.filter(v=>v!==person.user_id):[...old,person.user_id])}
             style={[s.person,{borderBottomColor:colors.border}]}>
             <ProfileAvatar uri={person.avatar_url} name={person.display_name||person.username} size={42}/>
             <View style={{flex:1}}>
               <Text style={{color:ink,fontWeight:'700'}}>{person.display_name||person.username}</Text>
               <Text style={{color:sub,fontSize:12}}>@{person.username}</Text>
             </View>
             <Text style={{color:accent,fontWeight:'900'}}>{selected.includes(person.user_id)?'✓':'○'}</Text>
           </Pressable>)}
           <Pressable accessibilityRole="button" onPress={()=>void invite()}
             disabled={!selected.length||saving} style={[s.primary,
               {backgroundColor:accent,opacity:selected.length&&!saving?1:0.4}]}>
             <Text style={{color:colors.accentText,fontWeight:'900'}}>ADD {selected.length||''} PEOPLE</Text>
           </Pressable>
         </View>}

         {members.map(member=><View key={member.user_id} style={[s.person,{borderBottomColor:colors.border}]}>
           <ProfileAvatar uri={member.avatar_url} name={member.display_name||member.username} size={44}/>
           <View style={{flex:1}}>
             <Text style={{color:ink,fontWeight:'700'}}>{member.display_name||member.username}</Text>
             <Text style={{color:sub,fontSize:12}}>
               @{member.username}{member.user_id===userId?' · You':''}{member.role==='admin'?' · Admin':''}
             </Text>
           </View>
           {amAdmin&&member.user_id!==userId&&<Pressable
             accessibilityRole="button" accessibilityLabel={`Manage @${member.username}`}
             onPress={()=>Alert.alert('Manage member',`@${member.username}`,[
               {text:member.role==='admin'?'Remove admin role':'Make admin',
                 onPress:()=>setRole(member,member.role!=='admin')},
               ...(member.role==='member'?[{text:'Remove from group',style:'destructive' as const,
                 onPress:()=>removeMember(member)}]:[]),
               {text:'Cancel',style:'cancel'},
             ])} style={s.memberAction}>
             <Text style={{color:accent,fontWeight:'800'}}>•••</Text>
           </Pressable>}
         </View>)}
       </View>

       {amAdmin&&<View style={s.section}>
         <Text style={[s.label,{color:sub}]}>GROUP PERMISSIONS</Text>
         <Pressable accessibilityRole="switch" accessibilityState={{checked:canEdit}}
           onPress={()=>void changePermissions(!canEdit,canInvite)} disabled={saving}
           style={[s.permission,{borderBottomColor:colors.border}]}>
           <Text style={{color:ink,fontWeight:'700'}}>Members can edit name & image</Text>
           <Text style={{color:accent,fontWeight:'900'}}>{canEdit?'ON':'OFF'}</Text>
         </Pressable>
         <Pressable accessibilityRole="switch" accessibilityState={{checked:canInvite}}
           onPress={()=>void changePermissions(canEdit,!canInvite)} disabled={saving}
           style={[s.permission,{borderBottomColor:colors.border}]}>
           <Text style={{color:ink,fontWeight:'700'}}>Members can add people</Text>
           <Text style={{color:accent,fontWeight:'900'}}>{canInvite?'ON':'OFF'}</Text>
         </Pressable>
       </View>}

       <Pressable accessibilityRole="button" onPress={leave}
         style={[s.leave,{borderColor:colors.border}]}>
         <Text style={{color:scheme==='light'?'#A23131':'#FF8F8F',fontWeight:'800'}}>Leave group</Text>
       </Pressable>
     </ScrollView>
   </KeyboardAvoidingView>
 </SafeAreaView>;
}

function makeStyles(scheme:'light'|'dark'){
 return StyleSheet.create({
   root:{flex:1},
   content:{paddingHorizontal:22,paddingTop:14,paddingBottom:80},
   top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:48},
   topAction:{minWidth:60,paddingVertical:10},
   headerTitle:{fontSize:17,fontWeight:'800'},
   hero:{alignItems:'center',paddingVertical:27},
   title:{fontSize:24,fontWeight:'900',marginTop:12},
   caption:{fontSize:13,marginTop:5},
   section:{paddingTop:24,paddingBottom:14},
   sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},
   label:{fontSize:10,fontWeight:'900',letterSpacing:1.5,marginBottom:13},
   action:{borderWidth:1,borderRadius:13,alignItems:'center',padding:14,marginBottom:12},
   field:{borderWidth:1,borderRadius:13,fontSize:15,paddingHorizontal:15,paddingVertical:14,marginBottom:12},
   primary:{borderRadius:13,alignItems:'center',paddingVertical:16,marginTop:10},
   person:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1},
   memberAction:{padding:11},
   permission:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:18,borderBottomWidth:1},
   leave:{marginTop:28,borderWidth:1,borderRadius:13,alignItems:'center',paddingVertical:16}
 });
}
