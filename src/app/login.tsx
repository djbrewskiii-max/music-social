import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not sign in', error.message);
      return;
    }

    router.replace('/now');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.logo}>NOW</Text>

            <Text style={styles.heading}>Welcome back.</Text>

            <Text style={styles.subheading}>
              Sign in and see who's listening.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>

              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#555555"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={styles.label}>PASSWORD</Text>

              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor="#555555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Pressable
                onPress={signIn}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace('/signup')}
                style={styles.signupButton}
              >
                <Text style={styles.signupText}>
                  New here?{' '}
                  <Text style={styles.signupBold}>
                    Create an account
                  </Text>
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footer}>
            Your music. Your people. Right now.
          </Text>
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
    marginTop: 30,
  },

  buttonPressed: {
    backgroundColor: '#BBBBBB',
    transform: [{ scale: 0.98 }],
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  signupButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },

  signupText: {
    color: '#777777',
    fontSize: 14,
  },

  signupBold: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
});