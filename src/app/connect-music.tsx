import { useAppearance } from '../appearance';
import { themedStyleSheet } from '../theme-style';
import { Auth, AuthStatus } from '@wwdrew/expo-apple-music';
import { router } from 'expo-router';
import { setMusicProvider } from '../music-provider';
import {finishOnboarding} from '../onboarding-progress';
import {supabase} from '../supabase';
import { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ConnectMusicScreen() {
  const {scheme,colors}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [connecting, setConnecting] = useState(false);
  const completeSetup=async()=>{
    const {data:{user},error}=await supabase.auth.getUser();
    if(error||!user)throw new Error('Sign in to complete setup.');
    await finishOnboarding(user.id);
    router.replace('/now');
  };
  const safelyCompleteSetup=async()=>{
    try{await completeSetup();}
    catch(error){
      Alert.alert('Could not finish setup',
        error instanceof Error?error.message:'Please try again.');
    }
  };
  const connectSpotify = async () => {
    if(connecting)return;
    setConnecting(true);
    try{
      // Only a music-opening preference. Spotify authorization is NOT required
      // to open a Spotify link or participate in OVRLEE conversations.
      await setMusicProvider('spotify');
      await completeSetup();
    }catch(error){
      Alert.alert('Could not finish setup',error instanceof Error?error.message:'Try again.');
    }finally{setConnecting(false);}
  };

  const connectAppleMusic = async () => {
    try {
      setConnecting(true);

      await setMusicProvider('apple_music');
      const result = await Auth.authorize();

      console.log('Apple Music authorization:', result);

      if (result.status === AuthStatus.AUTHORIZED) {
        await safelyCompleteSetup();
        return;
      }

      Alert.alert('Apple Music access not granted',
        'You can still open songs in Apple Music without library access.',[
          {text:'Continue',onPress:()=>void safelyCompleteSetup()},
        ]);
    } catch (error) {
      console.error('Apple Music connection error:', error);

      Alert.alert('Apple Music access unavailable',
        'You can choose music manually and connect later.',[
          {text:'Continue',onPress:()=>void safelyCompleteSetup()},
        ]);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container,{backgroundColor:colors.background}]}>
      <View style={styles.content}>
        <View>
          <Text style={styles.logo}>OVRLEE</Text>

          <View style={styles.header}>
            <Text style={styles.heading}>Where do you listen?</Text>

            <Text style={styles.subheading}>
              We’ll open music in your favorite app.
            </Text>
          </View>

          <View style={styles.services}>
            <Pressable
              disabled={connecting}
              style={({ pressed }) => [
                styles.appleButton,
                scheme==='light'
                  ? {backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCC9BD'}
                  : {backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#FFFFFF'},
                (pressed || connecting) && styles.pressed,
              ]}
              onPress={connectAppleMusic}
            >
              <View>
                <Text style={styles.appleLabel}>APPLE MUSIC</Text>
                <Text style={styles.appleText}>
                  {connecting ? 'Opening...' : 'Apple Music'}
                </Text>
              </View>

              <Text style={styles.arrow}>→</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.spotifyButton,
                scheme==='light'
                  ? {backgroundColor:'#F0E2D9',borderColor:'#E1CFC4'}
                  : {backgroundColor:'#17271C',borderColor:'#39E75F'},
                (pressed || connecting) && styles.pressed,
              ]}
              disabled={connecting}
              onPress={connectSpotify}
            >
              <View>
                <Text style={[styles.spotifyLabel,scheme==='dark'&&{color:'#A8D3B2'}]}>SPOTIFY</Text>
                <Text style={[styles.spotifyText,scheme==='dark'&&{color:'#FFFFFF'}]}>
                  {connecting ? 'Opening...' : 'Spotify'}
                </Text>
              </View>
              <Text style={[styles.soon,scheme==='dark'&&{color:'#39E75F'}]}>→</Text>
            </Pressable>
          </View>
        </View>

        <View><Text style={styles.footer}>You can change this in Settings.</Text></View>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 22,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },

  header: {
    marginTop: 65,
  },

  heading: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    maxWidth: 330,
  },

  subheading: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 340,
  },

  services: {
    marginTop: 48,
    gap: 14,
  },

  appleButton: {
    minHeight: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  appleLabel: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },

  appleText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },

  arrow: {
    color: '#000000',
    fontSize: 26,
  },

  spotifyButton: {
    minHeight: 82,
    backgroundColor: '#F0E2D9',
    borderWidth: 1,
    borderColor: '#E1CFC4',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  spotifyLabel: {
    color: '#6A4B3C',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },

  spotifyText: {
    color: '#3B2218',
    fontSize: 17,
    fontWeight: '600',
  },

  soon: {color:'#3B2218',fontSize:26,fontWeight:'800'},

  automaticUpdates: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  automaticText: {
    color: '#39E75F',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  skipText: {
    color: '#777777',
    fontSize: 15,
    fontWeight: '600',
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 15,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});