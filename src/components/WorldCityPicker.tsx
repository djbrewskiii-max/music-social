import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { CITY_LOCATIONS, cityLabel } from '../city-locations';
import { searchWorldwideCities, type WorldCity } from '../world-cities';

const GREEN = '#39E75F';

export default function WorldCityPicker({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (city: WorldCity) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldCity[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchWorldwideCities(query, controller.signal)
        .then(found => { if (!controller.signal.aborted) setResults(found); })
        .catch(() => { if (!controller.signal.aborted) setResults([]); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, visible]);

  const suggested: WorldCity[] = CITY_LOCATIONS.slice(0, 35).map(c => ({
    id: cityLabel(c), label: cityLabel(c) + ', United States',
    lat: c.lat, lon: c.lon, countryCode: 'US',
    country: 'United States', source: 'curated',
  }));

  return (
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808', padding: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontSize: 23, fontWeight: '900' }}>Choose your city</Text>
          <Pressable onPress={onClose}><Text style={{ color: GREEN, fontSize: 16, fontWeight: '900' }}>Done</Text></Pressable>
        </View>
        <TextInput value={query} onChangeText={setQuery} autoCorrect={false}
          placeholder="Search cities worldwide" placeholderTextColor="#777"
          style={{ color: '#fff', backgroundColor: '#181818', borderRadius: 14, padding: 15, marginVertical: 13 }} />
        <Text style={{ color: '#999', fontSize: 11, marginBottom: 12 }}>
          City-level only · no precise location requested
        </Text>
        {searching && <ActivityIndicator color={GREEN} />}
        <ScrollView keyboardShouldPersistTaps="handled">
          {(query.trim().length >= 2 ? results : suggested).map(city => (
            <Pressable key={city.id} onPress={() => { onPick(city); onClose(); }}
              accessibilityRole="button" accessibilityLabel={`Select ${city.label}`}
              style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#292929' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{city.label}</Text>
            </Pressable>
          ))}
          {!searching && query.trim().length >= 2 && !results.length &&
            <Text style={{ color: '#aaa', marginTop: 15 }}>No matching cities. Try the city name and country.</Text>}
          <Text style={{ color: '#777', fontSize: 10, marginTop: 18 }}>
            Location search: Open-Meteo.com / GeoNames · worldwide development search
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
