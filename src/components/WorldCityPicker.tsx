import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CITY_LOCATIONS } from '../city-locations';
import { searchWorldwideCities, type WorldCity } from '../world-cities';
import { WORLD_REGIONS } from '../world-regions';

const GREEN = '#39E75F';
type Stage = 'country' | 'region' | 'city';
const countries = Object.entries(WORLD_REGIONS).map(([code, item]) => ({ code, name: item.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const normalized = (s: string) => s.trim().toLocaleLowerCase();

export default function WorldCityPicker({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (city: WorldCity) => void;
}) {
  const [stage, setStage] = useState<Stage>('country');
  const [country, setCountry] = useState<{ code: string; name: string } | null>(null);
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldCity[]>([]);
  const [searching, setSearching] = useState(false);
  const regionOptions = useMemo(() =>
    (country ? WORLD_REGIONS[country.code]?.regions || [] : [])
      .filter(value => !(country?.code === 'US' && ['AA','AE','AP'].includes(value)))
      .sort((a, b) => a.localeCompare(b)), [country]);
  const moveBack = () => {
    Keyboard.dismiss();
    setQuery('');
    if (stage === 'city') setStage(regionOptions.length ? 'region' : 'country');
    else if (stage === 'region') setStage('country');
    else onClose();
  };

  useEffect(() => {
    if (!visible || stage !== 'city' || !country || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchWorldwideCities(query, controller.signal, country.code, region)
        .then(found => { if (!controller.signal.aborted) setResults(found); })
        .catch(error => { if (!controller.signal.aborted) console.log('Filtered city search:', error); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [visible, stage, country?.code, region, query]);

  const suggestions: WorldCity[] = country?.code === 'US'
    ? CITY_LOCATIONS.filter(c => !region || normalized(c.state) === normalized(region) ||
        (region === 'California' && c.state === 'CA') || (region === 'New York' && c.state === 'NY') ||
        (region === 'Connecticut' && c.state === 'CT') || (region === 'Illinois' && c.state === 'IL') ||
        (region === 'Massachusetts' && c.state === 'MA') || (region === 'New Jersey' && c.state === 'NJ'))
      .map(c => ({
        id: 'curated:' + c.name + ':' + c.state, label: c.name + ', ' + (region || c.state) + ', United States',
        lat: c.lat, lon: c.lon, country: 'United States', countryCode: 'US',
        region: region || c.state, source: 'curated' as const,
      })).slice(0, 30)
    : [];

  const chooseCountry = (selected: { code: string; name: string }) => {
    setCountry(selected);
    setRegion('');
    setQuery('');
    setStage((WORLD_REGIONS[selected.code]?.regions || []).length ? 'region' : 'city');
  };
  const chooseRegion = (selected: string) => { setRegion(selected); setQuery(''); setStage('city'); };
  const label = stage === 'country' ? 'Choose your country' : stage === 'region' ? 'Choose your state / region' : 'Choose your city';
  const hint = stage === 'country' ? 'Every country and territory'
    : stage === 'region' ? country?.name || '' : [region, country?.name].filter(Boolean).join(', ');
  const entries = stage === 'country' ? countries.filter(item => normalized(item.name).includes(normalized(query)))
    : regionOptions.filter(item => normalized(item).includes(normalized(query)));

  return (
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={moveBack}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={moveBack} hitSlop={12}>
            <Text style={styles.action}>{stage === 'country' ? 'Cancel' : '‹ Back'}</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}><Text style={styles.action}>Done</Text></Pressable>
        </View>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.steps}>
          {['COUNTRY','REGION','CITY'].map((item, i) =>
            <Text key={item} style={{ color: ['country','region','city'].indexOf(stage) === i ? GREEN : '#686868',
              letterSpacing: 1.5, fontWeight: '900', fontSize: 10 }}>{item}{i < 2 ? '  ›  ' : ''}</Text>)}
        </View>
        <TextInput autoCorrect={false} autoCapitalize="words"
          value={query} onChangeText={setQuery}
          placeholder={stage === 'country' ? 'Search countries' : stage === 'region' ? 'Search states or regions' : 'Search cities in ' + (region || country?.name)}
          placeholderTextColor="#777" style={styles.input}
          clearButtonMode="while-editing" />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 50 }}>
          {stage !== 'city' ? entries.map(item => {
            const name = typeof item === 'string' ? item : item.name;
            return <Pressable key={typeof item === 'string' ? item : item.code} onPress={() =>
              stage === 'country' ? chooseCountry(item as { code: string; name: string }) : chooseRegion(item as string)}
              style={styles.row} accessibilityRole="button" accessibilityLabel={name}>
              <Text style={styles.rowText}>{name}</Text><Text style={styles.chevron}>›</Text>
            </Pressable>;
          }) : <>
            {searching && <ActivityIndicator color={GREEN} style={{ marginTop: 10 }} />}
            {(query.trim().length >= 2 ? results : suggestions).map(city => (
              <Pressable key={city.id} style={styles.row} accessibilityRole="button" accessibilityLabel={city.label}
                onPress={() => { onPick(city); onClose(); Keyboard.dismiss(); }}>
                <Text style={styles.rowText}>{city.label}</Text><Text style={styles.chevron}>✓</Text>
              </Pressable>
            ))}
            {!searching && (query.trim().length >= 2 ? !results.length : !suggestions.length) &&
              <Text style={styles.empty}>Enter at least two letters of a city name. Only populated places will appear—no landmarks, zoos, or airports.</Text>}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808', paddingHorizontal: 22, paddingTop: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, minHeight: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  hint: { color: '#999', fontSize: 14, marginBottom: 16 },
  action: { color: GREEN, fontSize: 16, fontWeight: '800' },
  steps: { flexDirection: 'row', marginBottom: 16 },
  input: { color: '#fff', backgroundColor: '#181818', borderWidth: 1, borderColor: '#333', borderRadius: 13, padding: 14, fontSize: 16, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#222', paddingVertical: 15, minHeight: 55 },
  rowText: { color: '#fff', fontSize: 15, fontWeight: '650', flex: 1 },
  chevron: { color: GREEN, fontSize: 21, marginLeft: 16 },
  empty: { color: '#999', fontSize: 14, lineHeight: 21, marginTop: 22 },
});
