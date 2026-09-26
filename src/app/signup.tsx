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

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const createAccount = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Enter an email and password.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Password too short',
        'Your password needs to be at least 6 characters.'
      );
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not create account', error.message);
      return;
    }

    if (data.session) {
      router.replace('/setup-profile');
      return;
    }

    Alert.alert(
      'Check your email',
      'Your account was created, but your email still needs to be confirmed.'
    );
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

            <Text style={styles.heading}>
              Find your people through music.
            </Text>

            <Text style={styles.subheading}>
              Create your account to start discovering who's listening.
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
                placeholder="At least 6 characters"
                placeholderTextColor="#555555"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Pressable
                onPress={createAccount}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.buttonText}>
                  {loading
                    ? 'Creating account...'
                    : 'Create account'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace('/login')}
                style={styles.loginButton}
              >
                <Text style={styles.loginText}>
                  Already have an account?{' '}
                  <Text style={styles.loginBold}>
                    Sign in
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
    maxWidth: 330,
  },

  subheading: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 330,
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

  loginButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },

  loginText: {
    color: '#777777',
    fontSize: 14,
  },

  loginBold: {
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