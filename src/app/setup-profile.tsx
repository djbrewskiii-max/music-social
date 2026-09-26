import { router } from 'expo-router';
import { useState } from 'react';
import {
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

export default function SetupProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const saveProfile = async () => {
    if (!displayName.trim() || !username.trim() || !city.trim()) {
      Alert.alert('Almost there', 'Fill out all three fields.');
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      Alert.alert('Session error', 'Please sign in again.');
      router.replace('/login');
      return;
    }

    const cleanUsername = username
      .trim()
      .replace(/^@/, '')
      .toLowerCase();

    const { error } = await supabase.from('profiles').insert({
      user_id: user.id,
      display_name: displayName.trim(),
      username: cleanUsername,
      city: city.trim(),
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not save profile', error.message);
      return;
    }

    router.replace('/now');
  };

  const canContinue =
    displayName.trim().length > 0 &&
    username.trim().length > 0 &&
    city.trim().length > 0 &&
    !loading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.logo}>NOW</Text>

            <Text style={styles.heading}>Make it yours.</Text>

            <Text style={styles.subheading}>
              This is how people will know you on NOW.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>DISPLAY NAME</Text>

              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#555555"
                value={displayName}
                onChangeText={setDisplayName}
                autoCorrect={false}
              />

              <Text style={styles.label}>USERNAME</Text>

              <TextInput
                style={styles.input}
                placeholder="@username"
                placeholderTextColor="#555555"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>CITY</Text>

              <TextInput
                style={styles.input}
                placeholder="City, State"
                placeholderTextColor="#555555"
                value={city}
                onChangeText={setCity}
                autoCorrect={false}
              />
            </View>
          </View>

          <View>
            <Pressable
              onPress={saveProfile}
              disabled={!canContinue}
              style={({ pressed }) => [
                styles.button,
                !canContinue && styles.buttonDisabled,
                pressed && canContinue && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Continue'}
              </Text>
            </Pressable>

            <Text style={styles.footer}>
              Your music. Your people. Right now.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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