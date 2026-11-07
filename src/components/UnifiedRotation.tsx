
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../supabase';

type Track = {
  id?: string;
  song: string;
  artist: string;
  artworkUrl?: string;
};

type Pin = {
  id: string;
  user_id: string;
  song: string;
  artist: string;
  artwork_url: string | null;
  position: number;
  created_at?: string;
};

type Props = {
  owner?: boolean;
  userId?: string | null;
  fallbackTracks?: Track[];
  hideHeading?: boolean;
};

type Suggestion = Track & {
  source: 'activity' | 'catalog';
};

const GREEN = '#39E75F';
const catalogArtCache = new Map<string, string>();
// Apple Music metadata is used to decorate user-reviewed imports, not to infer listening.
async function matchCatalogArtwork(track: Track): Promise<string> {
  const key = trackKey(track);
  if (catalogArtCache.has(key)) return catalogArtCache.get(key)!;
  const token = process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!token) return '';
  const normalize = (s: string) => (s || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const desiredSong = normalize(track.song);
  const desiredArtists = track.artist.split(/,|\s+(?:feat\.?|ft\.?|and|x|&)\s+/i).map(normalize).filter(Boolean);
  const terms = [track.song + ' ' + track.artist, track.song];
  try {
    for (const term of terms) {
      const url = 'https://api.music.apple.com/v1/catalog/us/search?' +
        new URLSearchParams({ term, types: 'songs', limit: '25' }).toString();
      const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) continue;
      const result = await response.json();
      const candidates: any[] = result?.results?.songs?.data || [];
      const match = candidates.find(entry => {
        const a = entry?.attributes || {};
        const title = normalize(a.name);
        if (!title || title !== desiredSong) return false;
        const artist = normalize(a.artistName);
        return desiredArtists.some(want => artist === want || artist.includes(want) || want.includes(artist));
      });
      const image = match?.attributes?.artwork?.url;
      if (typeof image === 'string' && image) {
        const art = image.replace(/\{w\}/g, '180').replace(/\{h\}/g, '180');
        catalogArtCache.set(key, art);
        return art;
      }
    }
  } catch { /* Unmatched songs keep their placeholders, never incorrect artwork. */ }
  return '';
}

const clean = (s: string) =>
  (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const trackKey = (t: Track) =>
  `${clean(t.artist)}::${clean(t.song)}`;

const artUrl = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/\{w\}/g, '180').replace(/\{h\}/g, '180')
    : '';

const rank = (t: Track, q: string) => {
  const name = clean(t.song);
  const artist = clean(t.artist);
  const term = clean(q);

  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (artist.startsWith(term)) return 2;
  if (
    `${name} ${artist}`.includes(term) ||
    `${artist} ${name}`.includes(term)
  ) return 3;

  return 99;
};

export default function UnifiedRotation({
  owner = false,
  userId,
  fallbackTracks = [],
  hideHeading = false,
}: Props) {
  const params = useLocalSearchParams<{ openRotation?: string }>();
  const [newSuggestionCount, setNewSuggestionCount] = useState(0);
  const [accountId, setAccountId] =
    useState<string | null>(userId ?? null);

  const [pins, setPins] = useState<Pin[]>([]);
  const [activityTracks, setActivityTracks] = useState<Track[]>([]);
  const [freshImportKeys, setFreshImportKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<Track | null>(null);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [provider, setProvider] =
    useState<'spotify' | 'apple'>('apple');

  const reload = useCallback(async () => {
    try {
      const id = owner
        ? (await supabase.auth.getUser()).data.user?.id ?? null
        : userId ?? null;

      setAccountId(id);

      if (!id) {
        setPins([]);
        return;
      }

      const { data, error } = await supabase
        .from('profile_rotation_pins')
        .select('id,user_id,song,artist,artwork_url,position,created_at')
        .eq('user_id', id)
        .order('position');

      if (error) throw error;

      const loaded = (data ?? []) as Pin[];
      setPins(loaded);
      // Repair already-pinned songs imported before artwork enrichment existed.
      // Only a high-confidence title/artist catalog match is applied.
      if (owner) {
        const missing = loaded.filter(p => !p.artwork_url);
        void Promise.all(missing.map(async pin => {
          const url = await matchCatalogArtwork(pin);
          if (!url) return;
          const { error: artError } = await supabase.from('profile_rotation_pins')
            .update({ artwork_url: url }).eq('id', pin.id).eq('user_id', id);
          if (!artError) setPins(prev => prev.map(p => p.id === pin.id ? {...p, artwork_url: url} : p));
        })).catch(() => {});
      }
    } catch (e) {
      console.log('Rotation pins load:', e);
    } finally {
      setLoading(false);
    }
  }, [owner, userId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  useEffect(() => {
    let active = true;

    void import('../music-provider')
      .then(({ getMusicProvider }) => getMusicProvider())
      .then(value => {
        if (active) {
          setProvider(value === 'spotify' ? 'spotify' : 'apple');
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // An unread marker is based only on newly imported private suggestions.
  useEffect(() => {
    if (!owner || !accountId) return;
    let active = true;
    (async () => {
      const [imports, remote, local] = await Promise.all([
        supabase.from('music_import_tracks').select('created_at')
          .eq('user_id', accountId).order('created_at', {ascending: false }).limit(300),
        supabase.from('music_suggestion_review_state').select('last_reviewed_at')
          .eq('user_id', accountId).maybeSingle(),
        AsyncStorage.getItem('ovrlee.rotationReviewed.' + accountId),
      ]);
      const localTime = local ? Date.parse(local) || 0 : 0;
      const remoteTime = remote.data?.last_reviewed_at
        ? Date.parse(remote.data.last_reviewed_at) || 0 : 0;
      const time = Math.max(localTime, remoteTime);
      if (active && !editing) setNewSuggestionCount((imports.data || [])
        .filter(t => Date.parse(t.created_at) > time).length);
      // Carry forward existing device-only review status on first connection.
      if (!remote.error && localTime > remoteTime) {
        await supabase.from('music_suggestion_review_state').upsert({
          user_id: accountId, last_reviewed_at: new Date(localTime).toISOString(),
        },{onConflict:'user_id'});
      }
    })().catch(() => {});
    return () => { active = false; };
  }, [owner, accountId, editing]);

  // Read existing OVRLEE activity. Never change music_dna
  // or Apple Music authorization/presence collection.
  useEffect(() => {
    if (!owner || !accountId || !editing) return;

    let active = true;

    (async () => {
      const [dna, posts, imports] = await Promise.all([
        supabase
          .from('music_dna')
          .select('top_songs,recent_tracks')
          .eq('user_id', accountId)
          .maybeSingle(),

        supabase
          .from('posts')
          .select('song_title,artist_name,artwork_url,music_items')
          .eq('user_id', accountId)
          .order('created_at', { ascending: false })
          .limit(60),

        supabase
          .from('music_import_tracks')
          .select('song,artist,created_at')
          .eq('user_id', accountId)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      const found: Track[] = [];

      const add = (
        song: unknown,
        artist: unknown,
        artwork: unknown,
        id?: unknown
      ) => {
        if (
          typeof song === 'string' &&
          song.trim() &&
          typeof artist === 'string' &&
          artist.trim()
        ) {
          found.push({
            song: song.trim(),
            artist: artist.trim(),
            artworkUrl:
              typeof artwork === 'string'
                ? artUrl(artwork)
                : undefined,
            id: typeof id === 'string' ? id : undefined,
          });
        }
      };

      for (
        const t of Array.isArray(dna.data?.top_songs)
          ? dna.data.top_songs
          : []
      ) {
        add(t.song, t.artist, t.artworkUrl, t.id);
      }

      for (
        const t of Array.isArray(dna.data?.recent_tracks)
          ? dna.data.recent_tracks
          : []
      ) {
        add(t.song, t.artist, t.artworkUrl, t.id);
      }

      for (const p of posts.data ?? []) {
        add(p.song_title, p.artist_name, p.artwork_url);

        for (
          const t of Array.isArray(p.music_items)
            ? p.music_items
            : []
        ) {
          add(t.song, t.artist, t.artworkUrl, t.id);
        }
      }

      // Show imported songs first so a newly connected Spotify library
      // actually surfaces in the first visible suggestions. Imported
      // songs remain proposals, not listening history or public pins.
      const imported: Track[] = (imports.data ?? [])
        .filter(t => !!t.song && !!t.artist)
        .map(t => ({ song: t.song, artist: t.artist }));
      // Prefer new imports, then repeatedly represented artists; do not treat
      // playlist position or imported_at as Spotify listening timestamps.
      const artistFrequency = new Map<string, number>();
      for (const t of imported) {
        const artist = clean(t.artist.split(',')[0]);
        artistFrequency.set(artist, (artistFrequency.get(artist) || 0) + 1);
      }
      const ranked = imported.map((t,index) => ({
        t,index,score: Math.max(0,300-index*3) +
          Math.min(40,(artistFrequency.get(clean(t.artist.split(',')[0])) || 1)*4),
      })).sort((a,b) => b.score-a.score).map(entry => entry.t);
      const unique = Array.from(
        new Map([...ranked, ...found].map(t => [trackKey(t), t])).values()
      );
      if (active) {
        setActivityTracks(unique);
        const recentThreshold = Date.now() - 7 * 86400000;
        setFreshImportKeys((imports.data ?? [])
          .filter(t => !!t.song && !!t.artist && Date.parse(t.created_at) > recentThreshold)
          .map(t => trackKey(t)));
      }
      // Resolve only the initially visible suggestions; bounded batches prevent
      // dozens of unnecessary catalog lookups on every editor opening.
      const first = unique.slice(0, 50).filter(t => !t.artworkUrl);
      for (let offset = 0; offset < first.length && active; offset += 4) {
        const batch = first.slice(offset, offset + 4);
        const enriched = await Promise.all(batch.map(async t => ({
          key: trackKey(t), art: await matchCatalogArtwork(t)
        })));
        if (!active) return;
        const updates = new Map(enriched.filter(x => x.art).map(x => [x.key, x.art]));
        if (updates.size) setActivityTracks(previous => previous.map(t =>
          updates.has(trackKey(t)) && !t.artworkUrl
            ? {...t, artworkUrl: updates.get(trackKey(t))} : t
        ));
      }
    })().catch(e =>
      console.log('Rotation search activity:', e)
    );

    return () => {
      active = false;
    };
  }, [owner, accountId, editing]);

  // Radar-style debounced search, returning songs.
  useEffect(() => {
    const term = query.trim();

    if (
      !editing ||
      term.length < 2 ||
      (selected && !!editingId)
    ) {
      setCatalog([]);
      setSearching(false);
      setSearchError('');
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      const token =
        process.env.EXPO_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;

      if (!token) {
        if (active) {
          setSearchError('Music search is not configured.');
        }
        return;
      }

      setSearching(true);
      setSearchError('');

      try {
        const url =
          'https://api.music.apple.com/v1/catalog/us/search?' +
          new URLSearchParams({
            term,
            types: 'songs',
            limit: '25',
          }).toString();

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Music search unavailable (${response.status})`
          );
        }

        const result = await response.json();

        const songs = (
          Array.isArray(result?.results?.songs?.data)
            ? result.results.songs.data
            : []
        )
          .map(
            (t: any): Track => ({
              id: String(t?.id || ''),
              song: String(t?.attributes?.name || ''),
              artist: String(t?.attributes?.artistName || ''),
              artworkUrl: artUrl(
                t?.attributes?.artwork?.url
              ),
            })
          )
          .filter((t: Track) => t.song && t.artist);

        if (active) setCatalog(songs);
      } catch (e: any) {
        if (active) {
          setCatalog([]);
          setSearchError(String(e?.message || 'Search failed'));
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, editing, selected]);

  const matches = useMemo(() => {
    const term = query.trim();

    if (!term) {
      return [...activityTracks, ...fallbackTracks]
        .filter(
          (t, i, all) =>
            all.findIndex(
              x => trackKey(x) === trackKey(t)
            ) === i &&
            !pins.some(
              p => trackKey(p) === trackKey(t)
            ) &&
            !queue.some(
              x => trackKey(x) === trackKey(t)
            )
        )
        .slice(0, 50)
        .map(t => ({
          ...t,
          source: 'activity' as const,
        }));
    }

    const pinned = new Set([
      ...pins
        .filter(p => p.id !== editingId)
        .map(trackKey),
      ...queue.map(trackKey),
    ]);

    const local = [...activityTracks, ...fallbackTracks]
      .filter(
        t =>
          rank(t, term) < 99 &&
          !pinned.has(trackKey(t))
      )
      .sort(
        (a, b) => rank(a, term) - rank(b, term)
      );

    const seen = new Set<string>();

    const fromActivity = local
      .filter(t => {
        const k = trackKey(t);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8)
      .map(t => ({
        ...t,
        source: 'activity' as const,
      }));

    const fromCatalog = catalog
      .filter(t => {
        const k = trackKey(t);

        if (seen.has(k) || pinned.has(k)) return false;

        seen.add(k);
        return true;
      })
      .slice(0, 12)
      .map(t => ({
        ...t,
        source: 'catalog' as const,
      }));

    return [...fromActivity, ...fromCatalog];
  }, [
    query,
    activityTracks,
    fallbackTracks,
    catalog,
    pins,
    editingId,
    queue,
  ]);

  const clearEditor = () => {
    setPendingReplacement(null);
    setEditing(false);
    setEditingId(null);
    setQuery('');
    setSelected(null);
    setQueue([]);
    setCatalog([]);
  };

  const edit = (pin?: Pin) => {
    setPendingReplacement(null);
    setEditing(true);
    if (owner && accountId && !pin) {
      setNewSuggestionCount(0);
      const reviewedAt = new Date().toISOString();
      void AsyncStorage.setItem('ovrlee.rotationReviewed.' + accountId, reviewedAt).catch(() => {});
      void supabase.from('music_suggestion_review_state').upsert({
        user_id: accountId, last_reviewed_at: reviewedAt,
      },{onConflict:'user_id'}).then(({error}) => {
        if (error) console.log('Rotation reviewed sync:',error.message);
      });
    }
    setEditingId(pin?.id ?? null);
    setQueue([]);

    setSelected(
      pin
        ? {
            song: pin.song,
            artist: pin.artist,
            artworkUrl: pin.artwork_url ?? undefined,
          }
        : null
    );

    setQuery('');
  };

  useEffect(() => {
    if (!owner || !accountId || params.openRotation !== '1') return;
    edit();
    router.setParams({ openRotation: undefined });
  }, [owner, accountId, params.openRotation]);

  const resolveArtwork = async (track: Track): Promise<Track> => {
    if (track.artworkUrl) return track;
    const url = await matchCatalogArtwork(track);
    return url ? {...track, artworkUrl: url} : track;
  };

  const replaceFullPin = async (pin: Pin, incoming: Track) => {
    if (!accountId || saving) return;
    setSaving(true);
    try {
      const track = await resolveArtwork(incoming);
      const {error} = await supabase.from('profile_rotation_pins')
        .update({song: track.song, artist: track.artist, artwork_url: track.artworkUrl ?? null})
        .eq('id', pin.id).eq('user_id', accountId);
      if (error) throw error;
      clearEditor();
      await reload();
    } catch (e: any) {
      Alert.alert('Could not replace song', e?.message || 'Try again.');
    } finally { setSaving(false); }
  };

  const chooseTrack = (track: Track) => {
    if (editingId) {
      setSelected(track);
      return;
    }

    if (
      queue.some(
        t => trackKey(t) === trackKey(track)
      )
    ) {
      setQueue(list =>
        list.filter(
          t => trackKey(t) !== trackKey(track)
        )
      );
      return;
    }

    if (pins.length + queue.length >= 5) {
      if (pins.length === 5 && queue.length === 0) { setPendingReplacement(track); return; }
      Alert.alert('Five songs maximum', 'Save your selected songs before choosing a replacement.');
      return;
    }

    setQueue(list => [...list, track]);
    setQuery('');
    setCatalog([]);
  };

  const save = async () => {
    if (!owner || !accountId || saving) return;
    if (editingId && !selected) return;
    if (!editingId && queue.length === 0) return;

    setSaving(true);

    try {
      if (editingId && selected) {
        const finalSelection = await resolveArtwork(selected);
        if (
          pins.some(
            p =>
              p.id !== editingId &&
              trackKey(p) === trackKey(finalSelection)
          )
        ) {
          Alert.alert(
            'Already in rotation',
            'That song is already pinned.'
          );
          return;
        }

        const { error } = await supabase
          .from('profile_rotation_pins')
          .update({
            song: finalSelection.song,
            artist: finalSelection.artist,
            artwork_url: finalSelection.artworkUrl ?? null,
          })
          .eq('id', editingId)
          .eq('user_id', accountId);

        if (error) throw error;
      } else {
        const unique = queue.filter(
          (track, index, all) =>
            all.findIndex(
              t => trackKey(t) === trackKey(track)
            ) === index
        );

        if (pins.length + unique.length > 5) {
          throw new Error(
            'Only five songs can be pinned.'
          );
        }

        const withArt = await Promise.all(unique.map(resolveArtwork));
        const rows = withArt.map((t, i) => ({
          user_id: accountId,
          song: t.song,
          artist: t.artist,
          artwork_url: t.artworkUrl ?? null,
          position: pins.length + i,
        }));

        const { error } = await supabase
          .from('profile_rotation_pins')
          .insert(rows);

        if (error) throw error;
      }

      clearEditor();
      await reload();
    } catch (e: any) {
      Alert.alert(
        'Could not save rotation',
        e?.message ?? 'Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = (pin: Pin) => {
    Alert.alert(
      'Remove from rotation?',
      `${pin.song} · ${pin.artist}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!accountId) return;

            const { error } = await supabase
              .from('profile_rotation_pins')
              .delete()
              .eq('id', pin.id)
              .eq('user_id', accountId);

            if (error) {
              Alert.alert(
                'Could not remove',
                error.message
              );
            } else {
              await reload();
            }
          },
        },
      ]
    );
  };

  const openTrack = async (track: Track) => {
    const term = encodeURIComponent(
      `${track.song} ${track.artist}`
    );

    const url =
      provider === 'spotify'
        ? `https://open.spotify.com/search/${term}`
        : `https://music.apple.com/us/search?term=${term}`;

    try {
      await Linking.openURL(url);
    } catch (e) {
      console.log('Open track:', e);
    }
  };

  const chosen: {
    track: Track;
    pin?: Pin;
  }[] = pins.map(pin => ({
    pin,
    track: {
      song: pin.song,
      artist: pin.artist,
      artworkUrl: pin.artwork_url ?? undefined,
    },
  }));

  const used = new Set(
    chosen.map(({ track }) => trackKey(track))
  );

  // In Rotation is chosen, never auto-filled: the same for Apple Music and
  // Spotify. Listening activity only shows up as suggestions in the editor.
  const displayed: {
    track: Track;
    pin?: Pin;
  }[] = chosen;

  const since = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return 'since today';
    if (days < 7) return `since ${d.toLocaleDateString('en-US', { weekday: 'long' })}`;
    return `since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const renderTrack = ({
    item,
  }: {
    item: Suggestion;
  }) => (
    <Pressable
      style={styles.result}
      onPress={() => chooseTrack(item)}
    >
      {item.artworkUrl ? (
        <Image
          source={{ uri: item.artworkUrl }}
          style={styles.smallArt}
        />
      ) : (
        <View style={styles.smallArt} />
      )}

      <View style={{ flex: 1 }}>
        <Text
          style={styles.song}
          numberOfLines={1}
        >
          {item.song}
        </Text>
        <Text
          style={styles.artist}
          numberOfLines={1}
        >
          {item.artist}
        </Text>
      </View>

      <View style={{alignItems:'flex-end',gap:6}}>
        {freshImportKeys.includes(trackKey(item))&&
          <Text style={{color:GREEN,fontSize:9,fontWeight:'900'}}>NEW SUGGESTION</Text>}
        <Text style={[styles.plus,pins.length===5&&!editingId&&{fontSize:12,fontWeight:'900'}]}>
          {pins.length===5&&!editingId?'SWAP':'+'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {!hideHeading && (
        <View style={styles.heading}>
          <View>
            <Text style={styles.eyebrow}>
              YOUR SOUND
            </Text>
            <Text style={styles.title}>
              In rotation.
            </Text>
          </View>

          {owner && (
            <Pressable
              onPress={() => edit()}
              style={styles.add}
            >
              <Text style={styles.addText}>
                EDIT / ADD +{newSuggestionCount > 0 ? ' · ' + newSuggestionCount + ' NEW' : ''}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {hideHeading && owner && (
        <Pressable
          onPress={() => edit()}
          style={styles.add}
        >
          <Text style={styles.addText}>
            EDIT / ADD +{newSuggestionCount > 0 ? ' · ' + newSuggestionCount + ' NEW' : ''}
          </Text>
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator
          color={GREEN}
          style={{ marginVertical: 18 }}
        />
      ) : displayed.length === 0 ? (
        <Text style={styles.empty}>
          {owner
            ? 'Start your current rotation with a song you love.'
            : 'Their rotation is still taking shape.'}
        </Text>
      ) : (
        displayed.map(({ track, pin }, index) => (
          <View
            key={
              pin?.id ??
              `${trackKey(track)}-${index}`
            }
            style={styles.track}
          >
            <Pressable
              style={styles.trackMain}
              onPress={() => void openTrack(track)}
            >
              {track.artworkUrl ? (
                <Image
                  source={{ uri: track.artworkUrl }}
                  style={styles.art}
                />
              ) : (
                <View style={styles.artEmpty}>
                  <Text style={styles.noteIcon}>
                    ♪
                  </Text>
                </View>
              )}

              <View style={styles.trackInfo}>
                <Text
                  style={styles.song}
                  numberOfLines={1}
                >
                  {track.song}
                </Text>
                <Text
                  style={styles.artist}
                  numberOfLines={1}
                >
                  {track.artist}
                  {pin?.created_at ? `  ·  ${since(pin.created_at)}` : ''}
                </Text>
              </View>

              <Text style={styles.arrow}>↗</Text>
            </Pressable>

            {owner && pin && (
              <View style={styles.pinActions}>
                <Pressable
                  onPress={() => edit(pin)}
                >
                  <Text style={styles.action}>
                    REPLACE
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => remove(pin)}
                >
                  <Text style={styles.remove}>
                    REMOVE
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      <Modal
        visible={owner && editing}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={clearEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>
                IN ROTATION
              </Text>
              <Text style={styles.modalTitle}>
                {editingId
                  ? 'Replace a song'
                  : 'Build your rotation'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close song picker"
              onPress={clearEditor}
              style={styles.close}
            >
              <Text style={styles.closeText}>
                ✕
              </Text>
            </Pressable>
          </View>

          {pendingReplacement ? (
            <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 16 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 6 }}>Replace a song</Text>
              <Text style={{ color: '#aaa', fontSize: 13, lineHeight: 20, marginBottom: 18 }}>
                Choose which pinned song to replace with {pendingReplacement.song} by {pendingReplacement.artist}.
              </Text>
              {pins.map(pin => (
                <Pressable key={pin.id} accessibilityRole="button" disabled={saving}
                  onPress={() => void replaceFullPin(pin, pendingReplacement)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2d2d2d', gap: 12 }}>
                  {pin.artwork_url ? <Image source={{ uri: pin.artwork_url }} style={styles.smallArt} /> : <View style={styles.smallArt} />}
                  <View style={{ flex: 1 }}><Text style={styles.song} numberOfLines={1}>{pin.song}</Text>
                    <Text style={styles.artist} numberOfLines={1}>{pin.artist}</Text></View>
                  <Text style={{ color: GREEN, fontSize: 12, fontWeight: '900' }}>REPLACE →</Text>
                </Pressable>
              ))}
              {saving && <ActivityIndicator color={GREEN} style={{ marginTop: 18 }} />}
              <Pressable onPress={() => setPendingReplacement(null)} disabled={saving} style={{ paddingVertical: 19 }}>
                <Text style={{ color: '#aaa', textAlign: 'center', fontWeight: '700' }}>BACK TO SUGGESTIONS</Text>
              </Pressable>
            </View>
          ) : editingId && selected ? (
            <View style={styles.selectionCard}>
              {selected.artworkUrl ? (
                <Image
                  source={{
                    uri: selected.artworkUrl,
                  }}
                  style={styles.selectionArt}
                />
              ) : (
                <View style={styles.selectionArt} />
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={styles.song}
                  numberOfLines={2}
                >
                  {selected.song}
                </Text>
                <Text style={styles.artist}>
                  {selected.artist}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setSelected(null);
                  setQuery('');
                }}
              >
                <Text style={styles.action}>
                  CHANGE
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!editingId && (
                <View style={styles.queueBox}>
                  <Text style={styles.queueTitle}>
                    {pins.length + queue.length}/5 PINNED ·
                    {pins.length === 5 ? 'TAP A SONG TO SWAP' : `SELECT UP TO ${5 - pins.length} SONGS`}
                  </Text>

                  <View style={styles.queueChips}>
                    {queue.map(t => (
                      <Pressable
                        key={trackKey(t)}
                        onPress={() =>
                          setQueue(list =>
                            list.filter(
                              x =>
                                trackKey(x) !== trackKey(t)
                            )
                          )
                        }
                        style={styles.queueChip}
                      >
                        <Text
                          numberOfLines={1}
                          style={styles.queueChipText}
                        >
                          {t.song} ×
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {!editingId && (
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Read my public Spotify playlists"
                  onPress={() => { clearEditor(); router.push('/spotify-library'); }}
                  style={{ paddingVertical: 13, marginBottom: 8 }}>
                  <Text style={{ color: GREEN, fontWeight: '900', fontSize: 12 }}>
                    ♫ FIND MUSIC FROM MY SPOTIFY PROFILE →
                  </Text>
                  <Text style={{ color: '#999', fontSize: 11, marginTop: 5 }}>
                    Enter your Spotify profile link. No Spotify login required.
                  </Text>
                </Pressable>
              )}

              {!editingId && (
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Discover conversations around music you enjoy"
                  onPress={() => { clearEditor(); router.push('/nearby'); }}
                  style={{paddingVertical:11,marginBottom:5}}>
                  <Text style={{color:GREEN,fontWeight:'900',fontSize:12}}>
                    ♫ EXPLORE YOUR MUSIC SUGGESTIONS →
                  </Text>
                  <Text style={{color:'#999',fontSize:11,marginTop:5}}>
                    Find posts and people around the music you've chosen.
                  </Text>
                </Pressable>
              )}

              {!editingId && !query.trim() && matches.some(item => item.source === 'activity') && (
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Suggest my rotation from OVRLEE music activity"
                  onPress={() => {
                    const pinned = new Set(pins.map(trackKey));
                    const distinct = matches
                      .filter(item => item.source === 'activity' && !pinned.has(trackKey(item)))
                      .slice(0, Math.max(0, 5 - pins.length));
                    if (pins.length === 5) {
                      const first = matches.find(item => item.source === 'activity' && !pinned.has(trackKey(item)));
                      if (first) setPendingReplacement(first);
                    } else setQueue(distinct);
                  }}
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: '#294B30',
                    backgroundColor: '#122117', padding: 15, marginBottom: 13 }}>
                  <Text style={{ color: GREEN, fontWeight: '900', fontSize: 12 }}>
                    ✦ SUGGEST MY ROTATION
                  </Text>
                  <Text style={{ color: '#B5B5B5', fontSize: 11, lineHeight: 17, marginTop: 5 }}>
                    Find songs from your music activity and selections. Review before pinning.
                  </Text>
                </Pressable>
              )}

              <View style={styles.searchBox}>
                <Text style={styles.searchSymbol}>
                  ⌕
                </Text>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Search songs or artists"
                  placeholderTextColor="#777"
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />

                {!!query && (
                  <Pressable
                    onPress={() => setQuery('')}
                  >
                    <Text style={styles.closeText}>
                      ×
                    </Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.resultsHeading}>
                {query.trim()
                  ? 'MATCHING SONGS'
                  : "MUSIC YOU'VE SHARED OR CONNECTED"}
              </Text>

              <FlatList
                data={matches}
                keyExtractor={(item, index) =>
                  `${item.source}-${trackKey(item)}-${index}`
                }
                renderItem={renderTrack}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.resultsList}
                ListFooterComponent={
                  searching ? (
                    <ActivityIndicator
                      color={GREEN}
                      style={{
                        marginVertical: 16,
                      }}
                    />
                  ) : searchError ? (
                    <Text style={styles.hint}>
                      {searchError}
                    </Text>
                  ) : null
                }
                ListEmptyComponent={
                  !searching ? (
                    <Text style={styles.hint}>
                      {query.trim().length < 2
                        ? 'Type a song or artist to search the full catalog.'
                        : 'No results yet. Try a different search.'}
                    </Text>
                  ) : null
                }
              />
            </>
          )}

          {!pendingReplacement && <View style={styles.footer}>
            <Pressable
              onPress={clearEditor}
              disabled={saving}
              style={styles.cancelButton}
            >
              <Text style={styles.cancel}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void save()}
              disabled={
                saving ||
                (editingId
                  ? !selected
                  : queue.length === 0)
              }
              style={[
                styles.save,
                (saving ||
                  (editingId
                    ? !selected
                    : queue.length === 0)) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.saveText}>
                {saving
                  ? 'SAVING…'
                  : editingId
                    ? 'SAVE REPLACEMENT'
                    : `SAVE ${queue.length} SONG${
                        queue.length === 1 ? '' : 'S'
                      }`}
              </Text>
            </Pressable>
          </View>}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 5,
  },
  add: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignSelf: 'flex-end',
  },
  addText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  hint: {
    color: '#999',
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 16,
  },
  empty: {
    color: '#aaa',
    paddingVertical: 16,
    fontSize: 14,
  },
  track: {
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
    paddingVertical: 10,
  },
  trackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  art: {
    height: 55,
    width: 55,
    borderRadius: 9,
  },
  artEmpty: {
    height: 55,
    width: 55,
    borderRadius: 9,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteIcon: {
    color: '#888',
    fontSize: 23,
  },
  trackInfo: {
    flex: 1,
    gap: 3,
  },
  song: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  artist: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 3,
  },
  arrow: {
    color: '#aaa',
    fontSize: 19,
  },
  pinActions: {
    flexDirection: 'row',
    gap: 18,
    marginLeft: 67,
    marginTop: 7,
  },
  action: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  remove: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '800',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#090909',
    paddingTop: Platform.OS === 'ios' ? 64 : 26,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 7,
  },
  close: {
    padding: 12,
  },
  closeText: {
    color: '#fff',
    fontSize: 24,
  },
  searchBox: {
    height: 55,
    marginHorizontal: 22,
    borderRadius: 13,
    backgroundColor: '#1c1c1c',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchSymbol: {
    color: '#999',
    fontSize: 26,
    marginRight: 9,
  },
  searchInput: {
    color: '#fff',
    flex: 1,
    fontSize: 16,
  },
  resultsHeading: {
    color: '#888',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginHorizontal: 22,
    marginTop: 23,
    marginBottom: 8,
  },
  resultsList: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  result: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#272727',
  },
  smallArt: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  plus: {
    color: GREEN,
    fontSize: 23,
    fontWeight: '700',
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 22,
    gap: 14,
    borderRadius: 14,
    backgroundColor: '#1b1b1b',
    flex: 1,
    maxHeight: 125,
  },
  selectionArt: {
    width: 64,
    height: 64,
    borderRadius: 9,
    backgroundColor: '#252525',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#252525',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom:
      Platform.OS === 'ios' ? 28 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0c0c0c',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 15,
  },
  cancel: {
    color: '#bbb',
    fontWeight: '700',
    fontSize: 14,
  },
  save: {
    flex: 1,
    backgroundColor: GREEN,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.7,
  },
  queueBox: {
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  queueTitle: {
    color: '#999',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  queueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  queueChip: {
    backgroundColor: '#17341e',
    borderColor: '#39E75F66',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    maxWidth: '90%',
  },
  queueChipText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
