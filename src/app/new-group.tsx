import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabase';

interface MutualUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function NewGroupScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [mutuals, setMutuals] = useState<MutualUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMutuals();
  }, []);

  async function fetchMutuals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch mutuals/profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .neq('id', user.id)
      .limit(50);

    if (!error && data) {
      setMutuals(data);
    }
    setLoading(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCreateGroup() {
    if (selectedIds.length === 0 || creating) return;
    setCreating(true);

    const { data: convId, error } = await supabase.rpc('create_group_chat', {
      p_title: title.trim() || null,
      p_member_ids: selectedIds,
    });

    setCreating(false);
    if (!error && convId) {
      router.replace({ pathname: '/chat', params: { id: convId } });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            onPress={handleCreateGroup}
            disabled={selectedIds.length === 0 || creating}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#00E575" />
            ) : (
              <Text style={[styles.createText, selectedIds.length === 0 && styles.disabledText]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.nameInput}
          placeholder="Group name (optional)"
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
          autoCorrect={false}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SELECT MUTUALS</Text>
          <Text style={styles.selectedCount}>{selectedIds.length} selected</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#00E575" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={mutuals}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => toggleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: item.avatar_url ?? 'https://via.placeholder.com/44' }}
                    style={styles.avatar}
                  />
                  <Text style={styles.username}>@{item.username}</Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F1F1F',
    marginBottom: 16,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#888888', fontSize: 16 },
  createText: { color: '#00E575', fontSize: 16, fontWeight: '700' },
  disabledText: { opacity: 0.3 },
  nameInput: {
    backgroundColor: '#141414',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#242424',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: '#666666', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  selectedCount: { color: '#00E575', fontSize: 12, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#222' },
  username: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#00E575', borderColor: '#00E575' },
  checkmark: { color: '#000000', fontSize: 13, fontWeight: '900' },
});
