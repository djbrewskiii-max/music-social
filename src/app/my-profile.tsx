import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { supabase } from '../supabase';

type Profile = {
  display_name: string | null;
  username: string | null;
  city: string | null;
};

export default function MyProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('User error:', userError?.message);
      setLoading(false);
      router.replace('/login');
      return;
    }

    console.log('Signed-in user:', user.id);

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, username, city, user_id')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      console.log('Profile error:', error.message);
      setLoading(false);
      return;
    }

    console.log('Profile rows found:', data);

    if (data && data.length > 0) {
      setProfile(data[0]);
    } else {
      setProfile(null);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View>
          <View style={styles.header}>
            <Text style={styles.logo}>NOW</Text>

            <Pressable onPress={() => router.back()}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.eyebrow}>YOUR PROFILE</Text>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>

          <Text style={styles.name}>
            {profile?.display_name || 'No name'}
          </Text>

          <Text style={styles.username}>
            @{profile?.username || 'username'}
          </Text>

          <Text style={styles.city}>
            {profile?.city || 'No city'}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>YOUR MUSIC DNA</Text>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Your music belongs here.
            </Text>

            <Text style={styles.emptyText}>
              Connect Apple Music to start building your Music DNA.
            </Text>

            <Pressable
              onPress={() => router.push('/connect-music')}
              style={({ pressed }) => [
                styles.connectButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.connectButtonText}>
                Connect Apple Music
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>
          Your music. Your people. Right now.
        </Text>
      </View>
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
    paddingTop: 24,
    paddingBottom: 22,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },

  close: {
    color: '#777777',
    fontSize: 32,
    fontWeight: '300',
  },

  eyebrow: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 55,
    marginBottom: 25,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#292929',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    marginTop: 22,
  },

  username: {
    color: '#888888',
    fontSize: 16,
    marginTop: 5,
  },

  city: {
    color: '#555555',
    fontSize: 14,
    marginTop: 8,
  },

  divider: {
    height: 1,
    backgroundColor: '#222222',
    marginVertical: 32,
  },

  sectionLabel: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 14,
  },

  emptyCard: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 18,
    padding: 22,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },

  emptyText: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  connectButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },

  connectButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  footer: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
});