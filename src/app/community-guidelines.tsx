import {router} from 'expo-router';
import {Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useAppearance} from '../appearance';

const rules=[
  {title:'Respect the people behind the music',detail:'Disagreement about music is welcome. Threats, harassment, hateful slurs, bullying and targeted abuse are not.'},
  {title:'Share only what you have the right to share',detail:'Do not upload copyrighted audio recordings, other people’s private images or unauthorized personal information. Link to music through supported services.'},
  {title:'Keep music conversations safe',detail:'Do not post sexual exploitation material, promote violence, scam other members or spam posts, replies, group chats or DMs.'},
  {title:'Respect privacy and boundaries',detail:'Do not publish private messages or someone’s address without consent. Stop contacting someone who asks you to stop.'},
  {title:'Report harmful content',detail:'Use the three-dot menu on posts to report them. In Messages, long-press a received message to report it. On someone’s profile, you can mute or block them.'},
];
export default function CommunityGuidelines(){
  const {colors,scheme}=useAppearance();
  const accent=scheme==='light'?'#3B2218':'#39E75F';
  return <SafeAreaView style={[styles.root,{backgroundColor:colors.background}]}>
    <View style={[styles.header,{borderColor:colors.border}]}>
      <Pressable onPress={()=>router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to Settings">
        <Text style={{fontSize:30,color:colors.text}}>‹</Text>
      </Pressable>
      <Text style={[styles.heading,{color:colors.text}]}>COMMUNITY GUIDELINES</Text>
      <View style={{width:22}}/>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow,{color:accent}]}>THE WAY WE SHARE MUSIC</Text>
      <Text style={[styles.title,{color:colors.text}]}>Good music. Good people.</Text>
      <Text style={[styles.intro,{color:colors.secondary}]}>
        OVRLEE is built around sharing music and discovering people through honest conversation.
        These guidelines apply to posts, Song Replies, messages, and concert chats.
      </Text>
      {rules.map((rule,i)=><View key={rule.title} style={[styles.rule,{borderColor:colors.border}]}>
        <Text style={[styles.ruleNumber,{color:accent}]}>{String(i+1).padStart(2,'0')}</Text>
        <View style={{flex:1}}>
          <Text style={[styles.ruleTitle,{color:colors.text}]}>{rule.title}</Text>
          <Text style={[styles.ruleBody,{color:colors.secondary}]}>{rule.detail}</Text>
        </View>
      </View>)}
      <Text style={[styles.footer,{color:colors.secondary}]}>
        Submitted reports are stored for moderation review. Depending on severity,
        violating content and accounts may be restricted or removed.
        In an immediate emergency, contact local emergency services.
      </Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1},header:{height:60,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,paddingHorizontal:20},
  heading:{fontWeight:'900',fontSize:12,letterSpacing:1},
  content:{paddingHorizontal:24,paddingTop:36,paddingBottom:80},
  eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.3},
  title:{fontSize:29,fontWeight:'900',marginTop:13},
  intro:{fontSize:14,lineHeight:23,marginTop:14,marginBottom:20},
  rule:{flexDirection:'row',gap:15,paddingVertical:18,borderBottomWidth:1},
  ruleNumber:{fontSize:13,fontWeight:'900',marginTop:2},
  ruleTitle:{fontSize:15,fontWeight:'800'},ruleBody:{fontSize:13,lineHeight:21,marginTop:7},
  footer:{fontSize:12,lineHeight:20,marginTop:28}
});