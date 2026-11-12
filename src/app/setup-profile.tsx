import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {useMemo} from 'react';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '../supabase';
import WorldCityPicker from '../components/WorldCityPicker';

export default function SetupProfileScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [cityCoords, setCityCoords] = useState<{ lat: number; lon: number; countryCode: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] =
    useState(true);

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    setCheckingProfile(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCheckingProfile(false);
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, username, city, city_lat, city_lon, city_country_code')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.log(
        'Existing profile check error:',
        error.message
      );
    }

    if (data) {
      setDisplayName(data.display_name || '');
      setUsername(data.username || '');
      setCity(data.city || '');
      if (data.city_lat != null && data.city_lon != null)
        setCityCoords({ lat: data.city_lat, lon: data.city_lon, countryCode: data.city_country_code || '' });
    }

    setCheckingProfile(false);
  };

  const saveProfile = async () => {
    if (
      !displayName.trim() ||
      !username.trim() ||
      !city.trim()
    ) {
      Alert.alert(
        'Almost there',
        'Fill out all three fields.'
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);

      Alert.alert(
        'Session error',
        'Please sign in again.'
      );

      router.replace('/login');
      return;
    }

    const cleanUsername = username
      .trim()
      .replace(/^@/, '')
      .toLowerCase();

    const { data: existingProfile, error: checkError } =
      await supabase
        .from('profiles')
        .select('id,display_name,username,city')
        .eq('user_id', user.id)
        .maybeSingle();

    if (checkError) {
      setLoading(false);

      Alert.alert(
        'Could not check profile',
        checkError.message
      );

      return;
    }

    let saveError = null;

    if (existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: cleanUsername,
          city: city.trim(),
          city_lat: cityCoords?.lat ?? null,
          city_lon: cityCoords?.lon ?? null,
          city_country_code: cityCoords?.countryCode || null,
        })
        .eq('user_id', user.id);

      saveError = error;
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          display_name: displayName.trim(),
          username: cleanUsername,
          city: city.trim(),
          city_lat: cityCoords?.lat ?? null,
          city_lon: cityCoords?.lon ?? null,
          city_country_code: cityCoords?.countryCode || null,
        });

      saveError = error;
    }

    setLoading(false);

    if (saveError) {
      Alert.alert(
        'Could not save profile',
        saveError.message
      );

      return;
    }

    const hadCompletedProfile=!!(existingProfile?.display_name && existingProfile?.username && existingProfile?.city);
    router.replace(hadCompletedProfile ? '/now' : '/pick-artists');
  };

  const canContinue =
    displayName.trim().length > 0 &&
    username.trim().length > 0 &&
    city.trim().length > 0 &&
    !loading;

  if (checkingProfile) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.logo}>OVRLEE</Text>

            <Text style={styles.heading}>
              Make it yours.
            </Text>

            <Text style={styles.subheading}>
              This is how people will know you on OVRLEE.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>
                DISPLAY NAME
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#555555"
                value={displayName}
                onChangeText={setDisplayName}
                autoCorrect={false}
              />

              <Text style={styles.label}>
                USERNAME
              </Text>

              <TextInput
                style={styles.input}
                placeholder="@username"
                placeholderTextColor="#555555"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>
                CITY
              </Text>

              <Pressable onPress={() => setCityPickerVisible(true)} accessibilityRole="button"
                accessibilityLabel="Choose city worldwide"
                style={[styles.input, { justifyContent: 'center' }]}>
                <Text style={{ color: city ? '#fff' : '#888', fontSize: 16 }}>
                  {city || 'Select your city, anywhere in the world'}
                </Text>
              </Pressable>
            </View>
          </View>

          <WorldCityPicker visible={cityPickerVisible} onClose={() => setCityPickerVisible(false)}
            onPick={selection => {
              setCity(selection.label);
              setCityCoords({ lat: selection.lat, lon: selection.lon, countryCode: selection.countryCode });
            }} />
          <View>
            <Pressable
              onPress={saveProfile}
              disabled={!canContinue}
              style={({ pressed }) => [
                styles.button,
                !canContinue &&
                  styles.buttonDisabled,
                pressed &&
                  canContinue &&
                  styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {loading
                  ? 'Saving...'
                  : 'Continue'}
              </Text>
            </Pressable>

            <Text style={styles.footer}>
              For the overly obsessed.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles=StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#090909',
    alignItems: 'center',
    justifyContent: 'center',
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

  heading: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    marginTop: 65,
  },

  subheading: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
  },

  form: {
    marginTop: 45,
  },

  label: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 9,
    marginTop: 18,
  },

  input: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.3,
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 24,
  },
});