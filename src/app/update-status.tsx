import { useAppearance } from '../appearance';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View,
} from 'react-native';

const short = (value: string | null | undefined) =>
  value ? value.slice(0, 12) : 'Not available';

export default function UpdateStatusScreen() {
  const { colors } = useAppearance();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const channel = Updates.channel || 'Unknown / development';
  const embedded = Updates.isEmbeddedLaunch;
  const enabled = Updates.isEnabled;

  const check = async () => {
    if (checking) return;
    if (__DEV__ || !enabled) {
      setMessage('Updates can only be checked from an installed update-enabled release build, not a Metro development session.');
      return;
    }
    setChecking(true);
    setMessage('Checking for a compatible update…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setMessage('No compatible update is available on this build’s channel.');
        return;
      }
      setMessage('Downloading the update…');
      await Updates.fetchUpdateAsync();
      Alert.alert('New OVRLEE update ready', 'Reload the app to apply the update?', [
        { text: 'Later', style: 'cancel', onPress: () => setMessage('Update downloaded. Close and reopen OVRLEE to apply it.') },
        { text: 'Restart OVRLEE', onPress: () => void Updates.reloadAsync().catch(error =>
          Alert.alert('Could not restart', error instanceof Error ? error.message : 'Please reopen the app.')) },
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check for updates.');
    } finally {
      setChecking(false);
    }
  };

  const detail = (name: string, value: string) => (
    <View key={name} style={{paddingVertical:14,flexDirection:'row',gap:12,justifyContent:'space-between',
      borderBottomWidth:1,borderBottomColor:colors.border}}>
      <Text style={{flex:1,color:colors.secondary,fontSize:13}}>{name}</Text>
      <Text selectable style={{flex:1,textAlign:'right',color:colors.text,fontSize:13,fontWeight:'700'}}>{value}</Text>
    </View>
  );

  return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
    <ScrollView contentContainerStyle={{padding:22,paddingBottom:80}}>
      <Pressable onPress={()=>router.back()} accessibilityRole="button" style={{paddingVertical:12}}>
        <Text style={{color:colors.secondary,fontSize:16}}>‹ Back</Text>
      </Pressable>
      <Text style={{color:colors.text,fontSize:30,fontWeight:'900',marginTop:16}}>Version & updates</Text>
      <Text style={{color:colors.secondary,fontSize:14,lineHeight:21,marginTop:12}}>
        See which OVRLEE build is running and whether it can receive updates without a Mac.
      </Text>
      <View style={{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,
        borderRadius:16,paddingHorizontal:16,marginTop:24}}>
        {detail('App version',Constants.expoConfig?.version || 'Unknown')}
        {detail('Update channel',channel)}
        {detail('Runtime version',Updates.runtimeVersion || 'Unknown')}
        {detail('Update source',embedded ? 'Bundled with install' : 'Over-the-air')}
        {detail('Update ID',short(Updates.updateId))}
        {detail('Update service',enabled ? 'Enabled' : 'Not enabled in this build')}
      </View>
      <Pressable accessibilityRole="button" disabled={checking} onPress={()=>void check()}
        style={{backgroundColor:colors.accent,padding:17,borderRadius:14,alignItems:'center',marginTop:22,opacity:checking?0.6:1}}>
        {checking?<ActivityIndicator color={colors.background}/>:
          <Text style={{color:colors.background,fontWeight:'900'}}>CHECK FOR UPDATES</Text>}
      </Pressable>
      {!!message && <Text style={{color:colors.secondary,fontSize:13,lineHeight:20,marginTop:15}}>{message}</Text>}
      <Text style={{color:colors.secondary,fontSize:12,lineHeight:19,marginTop:26}}>
        Updates must match this build’s runtime version and update channel.
        Native features and incompatible libraries require a new app installation.
        In a standalone build, an update may apply when you close and reopen OVRLEE.
      </Text>
    </ScrollView>
  </SafeAreaView>;
}
