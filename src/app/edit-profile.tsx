import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../supabase';
import { OVERLY_TRAITS, normalizeOverlyTrait } from '../overly-traits';
import { CITY_LOCATIONS, cityLabel, resolveCity } from '../city-locations';
import { searchWorldwideCities, type WorldCity } from '../world-cities';

type Profile = {
  display_name: string | null;
  username: string | null;
  city: string | null;
  city_lat: number | null;
  city_lon: number | null;
  city_country_code: string | null;
  nearby_visible: boolean;
  bio: string | null;
  overly_trait: string | null;
  avatar_url: string | null;
  header_url: string | null;
};

type SavedProfile = Profile & {
  user_id: string;
  profile_color: string | null;
};

type MediaType = 'avatar' | 'header';

const NOW_GREEN = '#39E75F';

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] =
    useState<MediaType | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [nearbyVisible, setNearbyVisible] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<WorldCity[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [cityCoordinates, setCityCoordinates] = useState<{lat:number;lon:number;countryCode:string}|null>(null);
  const [choosingCity, setChoosingCity] = useState(false);
  useEffect(() => {
    if (!choosingCity) return;
    if (cityQuery.trim().length < 2) {
      setCityResults([]);
      setCitySearching(false);
      return;
    }
    const controller = new AbortController();
    setCitySearching(true);
    const timeout = setTimeout(() => {
      searchWorldwideCities(cityQuery, controller.signal)
        .then(results => { if (!controller.signal.aborted) setCityResults(results); })
        .catch(error => { if (!controller.signal.aborted) console.log('City search:', error); })
        .finally(() => { if (!controller.signal.aborted) setCitySearching(false); });
    }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [choosingCity, cityQuery]);

  const [bio, setBio] = useState('');
  const [overlyTrait, setOverlyTrait] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null);

  const [headerUrl, setHeaderUrl] =
    useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'display_name, username, city, city_lat, city_lon, city_country_code, nearby_visible, bio, overly_trait, avatar_url, header_url'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.log(
          'Edit profile load error:',
          error.message
        );

        Alert.alert(
          'Could not load profile',
          'NOW could not load your profile right now.'
        );

        return;
      }

      const profile = data as Profile | null;

      if (!profile) {
        return;
      }

      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setCity(profile.city || '');
      setCityCoordinates(profile.city_lat != null && profile.city_lon != null ? { lat: profile.city_lat, lon: profile.city_lon, countryCode: profile.city_country_code || '' } : null);
      setNearbyVisible(!!profile.nearby_visible);
      setBio(profile.bio || '');
      setOverlyTrait(normalizeOverlyTrait(profile.overly_trait));
      setAvatarUrl(profile.avatar_url || null);
      setHeaderUrl(profile.header_url || null);
    } catch (error) {
      console.log(
        'Edit profile load error:',
        error
      );

      Alert.alert(
        'Something went wrong',
        'NOW could not load your profile right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (
    type: MediaType
  ) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photos permission needed',
          'Allow NOW to access your photos so you can choose a profile image.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect:
            type === 'avatar'
              ? [1, 1]
              : [3, 1],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert(
          'Could not use photo',
          'NOW could not read that photo. Try choosing another one.'
        );

        return;
      }

      await uploadImage(asset, type);
    } catch (error) {
      console.log(
        'Image picker error:',
        error
      );

      Alert.alert(
        'Could not choose photo',
        error instanceof Error
          ? error.message
          : 'Try choosing the image again.'
      );
    }
  };

  const uploadImage = async (
    asset: ImagePicker.ImagePickerAsset,
    type: MediaType
  ) => {
    setUploading(type);

    try {
      console.log(
        '========== NOW PROFILE MEDIA UPLOAD =========='
      );

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionData.session
      ) {
        throw new Error(
          'Your NOW session has expired. Please sign in again.'
        );
      }

      const user =
        sessionData.session.user;

      const imageResponse =
        await fetch(asset.uri);

      if (!imageResponse.ok) {
        throw new Error(
          `NOW could not read the selected image (${imageResponse.status}).`
        );
      }

      const arrayBuffer =
        await imageResponse.arrayBuffer();

      if (!arrayBuffer.byteLength) {
        throw new Error(
          'The selected image appears to be empty.'
        );
      }

      let extension = 'jpg';

      const originalMimeType =
        asset.mimeType ||
        'image/jpeg';

      if (
        originalMimeType.includes('png')
      ) {
        extension = 'png';
      } else if (
        originalMimeType.includes('webp')
      ) {
        extension = 'webp';
      }

      const contentType =
        extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

      const filePath =
        `${user.id}/${type}.${extension}`;

      const {
        data: uploadData,
        error: uploadError,
      } = await supabase.storage
        .from('profile-media')
        .upload(
          filePath,
          arrayBuffer,
          {
            contentType,
            upsert: true,
            cacheControl: '3600',
          }
        );

      console.log(
        'Storage upload data:',
        uploadData
      );

      console.log(
        'Storage upload error:',
        uploadError
      );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from('profile-media')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error(
          'The photo uploaded, but NOW could not create its image URL.'
        );
      }

      const cacheBustedUrl =
        `${publicUrlData.publicUrl}?v=${Date.now()}`;

      if (type === 'avatar') {
        setAvatarUrl(cacheBustedUrl);
      } else {
        setHeaderUrl(cacheBustedUrl);
      }

      console.log(
        'Profile media upload succeeded:',
        type,
        cacheBustedUrl
      );

      console.log(
        '========== END PROFILE MEDIA UPLOAD =========='
      );
    } catch (error: any) {
      console.log(
        'Profile media upload error:',
        error
      );

      console.log(
        '========== END PROFILE MEDIA UPLOAD =========='
      );

      const message =
        error?.message ||
        'NOW could not upload that image.';

      Alert.alert(
        'Upload failed',
        message
      );
    } finally {
      setUploading(null);
    }
  };

  const removeImage = (
    type: MediaType
  ) => {
    if (type === 'avatar') {
      setAvatarUrl(null);
    } else {
      setHeaderUrl(null);
    }
  };

  const saveProfile = async () => {
    if (saving || uploading) {
      return;
    }

    const cleanDisplayName =
      displayName.trim();

    const cleanUsername =
      username
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();

    const cleanCity =
      city.trim();

    const cleanBio =
      bio.trim();

    if (!cleanDisplayName) {
      Alert.alert(
        'Add your name',
        'Your profile needs a display name.'
      );

      return;
    }

    if (!cleanUsername) {
      Alert.alert(
        'Add a username',
        'Your profile needs a username.'
      );

      return;
    }

    if (
      !/^[a-z0-9._]+$/.test(
        cleanUsername
      )
    ) {
      Alert.alert(
        'Check your username',
        'Use only letters, numbers, periods, and underscores.'
      );

      return;
    }

    if (cleanBio.length > 160) {
      Alert.alert(
        'Bio is too long',
        'Keep your bio to 160 characters or less.'
      );

      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      console.log(
        '========== NOW PROFILE SAVE =========='
      );

      console.log(
        'Saving profile for:',
        user.id
      );

      console.log(
        'Avatar URL being saved:',
        avatarUrl
      );

      console.log(
        'Header URL being saved:',
        headerUrl
      );

      const {
        data: usernameOwner,
        error: usernameError,
      } = await supabase
        .from('profiles')
        .select('user_id')
        .eq(
          'username',
          cleanUsername
        )
        .neq(
          'user_id',
          user.id
        )
        .maybeSingle();

      if (usernameError) {
        console.log(
          'Username check error:',
          usernameError.message
        );

        throw usernameError;
      }

      if (usernameOwner) {
        Alert.alert(
          'Username taken',
          'Choose another username.'
        );

        return;
      }

      const {
        data: savedProfile,
        error: saveError,
      } = await supabase
        .from('profiles')
        .update({
          display_name:
            cleanDisplayName,
          username:
            cleanUsername,
          city:
            cleanCity || null,
          city_lat: cityCoordinates?.lat ?? null,
          city_lon: cityCoordinates?.lon ?? null,
          city_country_code: cityCoordinates?.countryCode || null,
          nearby_visible: nearbyVisible,
          bio:
            cleanBio || null,
          overly_trait: overlyTrait,
          avatar_url:
            avatarUrl,
          header_url:
            headerUrl,
          profile_color:
            NOW_GREEN,
        })
        .eq(
          'user_id',
          user.id
        )
        .select(
          'user_id, display_name, username, city, city_lat, city_lon, city_country_code, nearby_visible, bio, overly_trait, avatar_url, header_url, profile_color'
        )
        .single();

      console.log(
        'Profile save returned:',
        savedProfile
      );

      console.log(
        'Profile save error:',
        saveError
      );

      if (saveError) {
        throw saveError;
      }

      if (!savedProfile) {
        throw new Error(
          'Supabase did not return an updated profile.'
        );
      }

      const verifiedProfile =
        savedProfile as SavedProfile;

      if (
        avatarUrl &&
        verifiedProfile.avatar_url !==
          avatarUrl
      ) {
        throw new Error(
          'Your photo uploaded, but the profile row did not save the photo URL.'
        );
      }

      if (
        headerUrl &&
        verifiedProfile.header_url !==
          headerUrl
      ) {
        throw new Error(
          'Your header uploaded, but the profile row did not save the header URL.'
        );
      }

      setAvatarUrl(
        verifiedProfile.avatar_url
      );

      setHeaderUrl(
        verifiedProfile.header_url
      );

      console.log(
        'Profile save verified successfully.'
      );

      console.log(
        '========== END PROFILE SAVE =========='
      );

      router.back();
    } catch (error: any) {
      console.log(
        'Profile save error:',
        error
      );

      console.log(
        '========== END PROFILE SAVE =========='
      );

      Alert.alert(
        'Could not save',
        error?.message ||
          'NOW could not save your profile right now.'
      );
    } finally {
      setSaving(false);
    }
  };

  const initial =
    displayName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    '?';

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loadingScreen
        }
      >
        <ActivityIndicator
          size="large"
          color="#ffffff"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Pressable
              onPress={() =>
                router.back()
              }
              hitSlop={12}
            >
              <Text
                style={
                  styles.cancel
                }
              >
                CANCEL
              </Text>
            </Pressable>

            <Text
              style={
                styles.headerTitle
              }
            >
              EDIT PROFILE
            </Text>

            <Pressable
              onPress={
                saveProfile
              }
              disabled={
                saving ||
                !!uploading
              }
              hitSlop={12}
            >
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color={
                    NOW_GREEN
                  }
                />
              ) : (
                <Text
                  style={
                    styles.save
                  }
                >
                  SAVE
                </Text>
              )}
            </Pressable>
          </View>

          <View
            style={
              styles.preview
            }
          >
            <Pressable
              style={
                styles.headerImageContainer
              }
              onPress={() =>
                pickImage(
                  'header'
                )
              }
            >
              {headerUrl ? (
                <Image
                  source={{
                    uri:
                      headerUrl,
                  }}
                  style={
                    styles.headerImage
                  }
                />
              ) : (
                <View
                  style={
                    styles.headerPlaceholder
                  }
                >
                  <View
                    style={
                      styles.headerGlow
                    }
                  />

                  <Text
                    style={
                      styles.headerPlaceholderText
                    }
                  >
                    ADD HEADER
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.headerEditPill
                }
              >
                {uploading ===
                'header' ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.headerEditText
                    }
                  >
                    CHANGE
                  </Text>
                )}
              </View>
            </Pressable>

            <View
              style={
                styles.avatarArea
              }
            >
              <Pressable
                style={
                  styles.avatarRing
                }
                onPress={() =>
                  pickImage(
                    'avatar'
                  )
                }
              >
                {avatarUrl ? (
                  <Image
                    source={{
                      uri:
                        avatarUrl,
                    }}
                    style={
                      styles.avatarImage
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.avatarPlaceholder
                    }
                  >
                    <Text
                      style={
                        styles.avatarInitial
                      }
                    >
                      {initial}
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.avatarEdit
                  }
                >
                  {uploading ===
                  'avatar' ? (
                    <ActivityIndicator
                      size="small"
                      color="#000000"
                    />
                  ) : (
                    <Text
                      style={
                        styles.avatarEditText
                      }
                    >
                      +
                    </Text>
                  )}
                </View>
              </Pressable>

              <View
                style={
                  styles.previewIdentity
                }
              >
                <Text
                  style={
                    styles.previewName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {displayName.trim() ||
                    'Your name'}
                </Text>

                <Text
                  style={
                    styles.previewUsername
                  }
                  numberOfLines={
                    1
                  }
                >
                  @
                  {username
                    .trim()
                    .replace(
                      /^@+/,
                      ''
                    ) ||
                    'username'}
                </Text>
              </View>
            </View>
          </View>

          {(avatarUrl ||
            headerUrl) && (
            <View
              style={
                styles.removeRow
              }
            >
              {avatarUrl && (
                <Pressable
                  onPress={() =>
                    removeImage(
                      'avatar'
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    REMOVE PHOTO
                  </Text>
                </Pressable>
              )}

              {headerUrl && (
                <Pressable
                  onPress={() =>
                    removeImage(
                      'header'
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    REMOVE HEADER
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              IDENTITY
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Make it yours.
            </Text>

            <View
              style={
                styles.field
              }
            >
              <Text
                style={
                  styles.fieldLabel
                }
              >
                NAME
              </Text>

              <TextInput
                value={
                  displayName
                }
                onChangeText={
                  setDisplayName
                }
                placeholder="Your name"
                placeholderTextColor="#444444"
                style={
                  styles.input
                }
                maxLength={50}
              />
            </View>

            <View
              style={
                styles.field
              }
            >
              <Text
                style={
                  styles.fieldLabel
                }
              >
                USERNAME
              </Text>

              <View
                style={
                  styles.usernameInputRow
                }
              >
                <Text
                  style={
                    styles.atSymbol
                  }
                >
                  @
                </Text>

                <TextInput
                  value={
                    username
                  }
                  onChangeText={(
                    value
                  ) =>
                    setUsername(
                      value.replace(
                        /^@+/,
                        ''
                      )
                    )
                  }
                  placeholder="username"
                  placeholderTextColor="#444444"
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  style={
                    styles.usernameInput
                  }
                  maxLength={30}
                />
              </View>
            </View>

            <View
              style={
                styles.field
              }
            >
              <View
                style={
                  styles.fieldLabelRow
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  BIO
                </Text>

                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {bio.length}/160
                </Text>
              </View>

              <TextInput
                value={bio}
                onChangeText={
                  setBio
                }
                placeholder="Say something about yourself."
                placeholderTextColor="#444444"
                style={[
                  styles.input,
                  styles.bioInput,
                ]}
                multiline
                maxLength={160}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>YOUR OVERLY</Text>
              <Text style={{ color: '#999', fontSize: 13, marginTop: 8, marginBottom: 14 }}>
                Choose a word that feels like you. It appears beneath your name.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {OVERLY_TRAITS.map((trait) => (
                  <Pressable key={trait} accessibilityRole="radio"
                    accessibilityState={{ selected: overlyTrait === trait }}
                    onPress={() => setOverlyTrait(overlyTrait === trait ? null : trait)}
                    style={{ borderRadius: 20, borderWidth: 1, borderColor: overlyTrait === trait ? NOW_GREEN : '#3b3b3b', backgroundColor: overlyTrait === trait ? '#16351d' : '#151515', paddingVertical: 10, paddingHorizontal: 13 }}>
                    <Text style={{ color: overlyTrait === trait ? '#fff' : '#bbb', fontSize: 12, fontWeight: '700' }}>{trait}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View
              style={
                styles.field
              }
            >
              <Text
                style={
                  styles.fieldLabel
                }
              >
                CITY
              </Text>

              <Pressable onPress={() => { setCityQuery(city); setChoosingCity(true); }}
                accessibilityRole="button" accessibilityLabel="Choose a city from the OVRLEE directory"
                style={[styles.input, { justifyContent: 'center' }]}>
                <Text style={{ color: city ? '#ffffff' : '#777', fontSize: 16 }}>{city || 'Select your city'}</Text>
              </Pressable>
              <Text style={{ color: '#888', fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                Your selected city helps OVRLEE find people in the surrounding area. No GPS required.
              </Text>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: nearbyVisible }}
                accessibilityLabel="Allow my profile and music posts to appear in Nearby"
                onPress={() => setNearbyVisible(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 14,
                  backgroundColor: '#161616', borderWidth: 1, borderColor: nearbyVisible ? NOW_GREEN : '#333', borderRadius: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Show me in Nearby</Text>
                  <Text style={{ color: '#aaa', fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                    Let people in the surrounding area discover your profile and music shares. Off by default; your public profile and posts remain visible elsewhere.
                  </Text>
                </View>
                <Text style={{ color: nearbyVisible ? NOW_GREEN : '#888', fontWeight: '900', marginLeft: 12 }}>
                  {nearbyVisible ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={
              styles.personalizationSection
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              YOUR PROFILE
            </Text>

            <Text
              style={
                styles.personalizationTitle
              }
            >
              Your corner of NOW.
            </Text>

            <Text
              style={
                styles.personalizationCopy
              }
            >
              Your photo, header,
              bio and music make this
              space yours. Green stays
              live.
            </Text>

            <View
              style={
                styles.liveLanguageCard
              }
            >
              <View
                style={
                  styles.liveDot
                }
              />

              <View
                style={
                  styles.liveLanguageInfo
                }
              >
                <Text
                  style={
                    styles.liveLanguageTitle
                  }
                >
                  NOW GREEN
                </Text>

                <Text
                  style={
                    styles.liveLanguageText
                  }
                >
                  Listening. Active.
                  Happening now.
                </Text>
              </View>
            </View>
          </View>

          <Modal visible={choosingCity} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChoosingCity(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#080808', padding: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ color: '#fff', fontSize: 23, fontWeight: '900' }}>Choose your city</Text>
                <Pressable onPress={() => setChoosingCity(false)}><Text style={{ color: NOW_GREEN, fontSize: 16, fontWeight: '700' }}>Done</Text></Pressable>
              </View>
              <TextInput value={cityQuery} onChangeText={setCityQuery}
                autoCorrect={false} placeholder="Search cities or state..." placeholderTextColor="#888"
                style={{ backgroundColor: '#181818', borderColor: '#333', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', marginBottom: 15 }} />
              <Text style={{ color: '#999', fontSize: 11, marginBottom: 12 }}>
                Search cities worldwide · choose the right region and country
              </Text>
              {citySearching && <ActivityIndicator color={NOW_GREEN} style={{ marginBottom: 10 }} />}

              <ScrollView keyboardShouldPersistTaps="handled">
                {(cityQuery.trim().length >= 2 ? cityResults : CITY_LOCATIONS.slice(0, 35).map(c => ({
                  id: `curated:${cityLabel(c)}`, label: cityLabel(c) + ', United States',
                  lat: c.lat, lon: c.lon, countryCode: 'US', country: 'United States', source: 'curated' as const,
                }))).map(candidate => (
                  <Pressable key={candidate.id} accessibilityRole="button"
                    accessibilityLabel={`Select ${candidate.label}`}
                    onPress={() => {
                      setCity(candidate.label);
                      setCityCoordinates({ lat: candidate.lat, lon: candidate.lon, countryCode: candidate.countryCode });
                      setChoosingCity(false);
                    }}
                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#272727',
                      flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 }}>{candidate.label}</Text>
                    {city === candidate.label && <Text style={{ color: NOW_GREEN }}>✓</Text>}
                  </Pressable>
                ))}
                {!citySearching && cityQuery.trim().length >= 2 && !cityResults.length &&
                  <Text style={{ color: '#aaa', fontSize: 14, lineHeight: 22, marginTop: 20 }}>
                    No matching cities found. Try the city name or country in English.
                  </Text>}
                <Text style={{ color: '#777', fontSize: 10, marginTop: 18 }}>
                  Location search data: Open-Meteo.com / GeoNames. Select a city, never a precise address.
                </Text>
              </ScrollView>
            </SafeAreaView>
          </Modal>

          <Pressable
            style={({
              pressed,
            }) => [
              styles.saveButton,
              pressed &&
                styles.buttonPressed,
              (saving ||
                !!uploading) &&
                styles.buttonDisabled,
            ]}
            onPress={
              saveProfile
            }
            disabled={
              saving ||
              !!uploading
            }
          >
            {saving ? (
              <ActivityIndicator
                color="#000000"
              />
            ) : (
              <>
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  SAVE PROFILE
                </Text>

                <Text
                  style={
                    styles.saveButtonArrow
                  }
                >
                  →
                </Text>
              </>
            )}
          </Pressable>

          <Text
            style={
              styles.footer
            }
          >
            YOUR MUSIC. YOUR PEOPLE.
            RIGHT NOW.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#050505',
    },

    loadingScreen: {
      flex: 1,
      backgroundColor:
        '#050505',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color: '#666666',
      fontSize: 12,
      marginTop: 14,
    },

    content: {
      paddingBottom: 55,
    },

    header: {
      height: 62,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    cancel: {
      color: '#777777',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      width: 55,
    },

    headerTitle: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.6,
    },

    save: {
      color: NOW_GREEN,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      width: 55,
      textAlign: 'right',
    },

    preview: {
      marginTop: 8,
      marginHorizontal: 20,
      borderWidth: 1,
      borderColor: '#202020',
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor:
        '#090909',
    },

    headerImageContainer: {
      height: 135,
      backgroundColor:
        '#111111',
    },

    headerImage: {
      width: '100%',
      height: '100%',
    },

    headerPlaceholder: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor:
        '#39E75F44',
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },

    headerGlow: {
      position: 'absolute',
      width: 210,
      height: 210,
      borderRadius: 105,
      backgroundColor:
        '#39E75F18',
    },

    headerPlaceholderText: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    headerEditPill: {
      position: 'absolute',
      top: 12,
      right: 12,
      minWidth: 70,
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 100,
      backgroundColor:
        'rgba(0,0,0,0.72)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    headerEditText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    avatarArea: {
      minHeight: 105,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingBottom: 14,
    },

    avatarRing: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 3,
      borderColor: NOW_GREEN,
      padding: 3,
      backgroundColor:
        '#050505',
      marginTop: -25,
    },

    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 38,
      backgroundColor:
        '#171717',
    },

    avatarPlaceholder: {
      flex: 1,
      borderRadius: 38,
      backgroundColor:
        '#171717',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    avatarInitial: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '900',
    },

    avatarEdit: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 27,
      height: 27,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: '#050505',
      backgroundColor:
        NOW_GREEN,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    avatarEditText: {
      color: '#000000',
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 18,
    },

    previewIdentity: {
      flex: 1,
      marginLeft: 15,
      paddingTop: 8,
    },

    previewName: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.4,
    },

    previewUsername: {
      color: '#777777',
      fontSize: 11,
      marginTop: 4,
    },

    removeRow: {
      paddingHorizontal: 23,
      paddingTop: 13,
      flexDirection: 'row',
      justifyContent:
        'flex-end',
      gap: 18,
    },

    removeText: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },

    section: {
      marginTop: 37,
      paddingHorizontal: 22,
    },

    sectionEyebrow: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.8,
      marginBottom: 7,
    },

    sectionTitle: {
      color: '#ffffff',
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginBottom: 23,
    },

    field: {
      marginBottom: 19,
    },

    fieldLabelRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    fieldLabel: {
      color: '#666666',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.4,
      marginBottom: 9,
    },

    characterCount: {
      color: '#444444',
      fontSize: 8,
      marginBottom: 9,
    },

    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 14,
      backgroundColor:
        '#0b0b0b',
      color: '#ffffff',
      paddingHorizontal: 15,
      fontSize: 14,
    },

    usernameInputRow: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: '#242424',
      borderRadius: 14,
      backgroundColor:
        '#0b0b0b',
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },

    atSymbol: {
      color: '#666666',
      fontSize: 14,
      marginRight: 2,
    },

    usernameInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      paddingVertical: 0,
    },

    bioInput: {
      minHeight: 105,
      paddingTop: 14,
      paddingBottom: 14,
      lineHeight: 20,
    },

    personalizationSection: {
      marginTop: 18,
      marginHorizontal: 22,
      borderTopWidth: 1,
      borderTopColor:
        '#202020',
      paddingTop: 32,
    },

    personalizationTitle: {
      color: '#ffffff',
      fontSize: 27,
      lineHeight: 32,
      fontWeight: '900',
      letterSpacing: -0.7,
    },

    personalizationCopy: {
      color: '#666666',
      fontSize: 12,
      lineHeight: 19,
      marginTop: 10,
      maxWidth: 315,
    },

    liveLanguageCard: {
      minHeight: 75,
      borderWidth: 1,
      borderColor:
        '#39E75F44',
      borderRadius: 17,
      marginTop: 21,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#090909',
    },

    liveDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        NOW_GREEN,
      marginRight: 13,
    },

    liveLanguageInfo: {
      flex: 1,
    },

    liveLanguageTitle: {
      color: NOW_GREEN,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    liveLanguageText: {
      color: '#777777',
      fontSize: 11,
      marginTop: 5,
    },

    saveButton: {
      minHeight: 56,
      marginHorizontal: 22,
      marginTop: 40,
      borderRadius: 100,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      backgroundColor:
        NOW_GREEN,
    },

    saveButtonText: {
      color: '#000000',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    saveButtonArrow: {
      color: '#000000',
      fontSize: 20,
      fontWeight: '900',
    },

    buttonPressed: {
      opacity: 0.7,
    },

    buttonDisabled: {
      opacity: 0.45,
    },

    footer: {
      color: '#3f3f3f',
      textAlign: 'center',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginTop: 44,
      paddingHorizontal: 20,
    },
  });