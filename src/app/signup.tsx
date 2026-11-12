import {useAppearance} from '../appearance';
import {themedStyleSheet} from '../theme-style';
import {useMemo} from 'react';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../supabase';

export default function SignupScreen() {
  const {scheme}=useAppearance();
  const styles=useMemo(()=>themedStyleSheet(baseStyles,scheme),[scheme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const createAccount = async () => {
    // This client check requires a matching Supabase server-side signup hook.
    const y = Number(birthYear);
    const m = Number(birthMonth);
    const d = Number(birthDay);
    const birth = new Date(Date.UTC(y, m - 1, d));
    const valid = /^\d{4}$/.test(birthYear)
      && /^\d{1,2}$/.test(birthMonth)
      && /^\d{1,2}$/.test(birthDay)
      && y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31
      && birth.getUTCFullYear() === y
      && birth.getUTCMonth() === m - 1
      && birth.getUTCDate() === d;
    if (!valid) {
      Alert.alert('Birth date needed', 'Enter a valid birth month, day, and year.');
      return;
    }
    const now = new Date();
    const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
    if (birth > cutoff) {
      Alert.alert('Unable to register', 'OVRLEE is currently testing with adults only.');
      return;
    }
    const birthDate = [birthYear, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
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
      options: { data: { beta_birth_date: birthDate, beta_age_policy: '18plus-2026-11' } },
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.logo}>OVRLEE</Text>

            <Text style={styles.heading}>
              Find your people through music.
            </Text>

            <Text style={styles.subheading}>
              Create your account to start discovering who's listening.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>DATE OF BIRTH</Text>
              <Text style={styles.ageDescription}>Enter your birth date to check eligibility for the closed beta.</Text>
              <View style={styles.birthRow}>
                <TextInput style={[styles.input, styles.birthField]} placeholder="MM" placeholderTextColor="#746459"
                  value={birthMonth} onChangeText={setBirthMonth} keyboardType="number-pad" maxLength={2} accessibilityLabel="Birth month" />
                <TextInput style={[styles.input, styles.birthField]} placeholder="DD" placeholderTextColor="#746459"
                  value={birthDay} onChangeText={setBirthDay} keyboardType="number-pad" maxLength={2} accessibilityLabel="Birth day" />
                <TextInput style={[styles.input, styles.birthYear]} placeholder="YYYY" placeholderTextColor="#746459"
                  value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" maxLength={4} accessibilityLabel="Birth year" />
              </View>
              <Text style={styles.ageDescription}>OVRLEE's initial closed beta is limited to adults 18 and older.</Text>
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
            For the overly obsessed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles=StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090909',
  },

  content: {
    flex: 1,
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 30,
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
    marginTop: 30,
    maxWidth: 330,
  },

  subheading: {
    color: '#777777',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 330,
  },

  form: { marginTop: 22 },
  birthRow: { flexDirection: 'row', gap: 10 },
  birthField: { flex: 1, minWidth: 0 },
  birthYear: { flex: 1.5, minWidth: 0 },
  ageDescription: { color: '#B8A697', fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 8 },

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
    marginTop: 22,
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