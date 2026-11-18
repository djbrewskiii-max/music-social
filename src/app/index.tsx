import { Redirect } from 'expo-router';
import { useAppearance } from '../appearance';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';

import { supabase } from '../supabase';

export default function HomeScreen() {
  const {colors}=useAppearance();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSignedIn(!!session);
      setLoading(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingScreen,{backgroundColor:colors.background}]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (signedIn) {
    return <Redirect href="/now" />;
  }

  return <Redirect href="/signup" />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#090909',
    justifyContent: 'center',
    alignItems: 'center',
  },
});