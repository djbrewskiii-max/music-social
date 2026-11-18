import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from '../appearance';
import { canSearchLiveCities, searchWorldwideCities, suggestedCities, type WorldCity } from '../world-cities';
import { WORLD_REGIONS } from '../world-regions';

type Stage = 'country' | 'region' | 'city';
type Country = { code:string; name:string };
const countries:Country[] = Object.entries(WORLD_REGIONS)
  .map(([code,item])=>({code,name:item.name})).sort((a,b)=>a.name.localeCompare(b.name));
const normalize = (s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase();

export default function WorldCityPicker({visible,onClose,onPick}:{
  visible:boolean;
  onClose:()=>void;
  onPick:(city:WorldCity)=>void;
}) {
  const {scheme,colors}=useAppearance();
  const styles=useMemo(()=>makeStyles(scheme),[scheme]);
  const [stage,setStage]=useState<Stage>('country');
  const [country,setCountry]=useState<Country|null>(null);
  const [region,setRegion]=useState('');
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<WorldCity[]>([]);
  const [searching,setSearching]=useState(false);

  useEffect(()=>{
    // A new edit session starts with no stale country/region/query.
    if(visible){
      setStage('country');setCountry(null);setRegion('');setQuery('');
      setResults([]);setSearching(false);
    }
  },[visible]);

  const regionOptions=useMemo(()=>country
    ? [...(WORLD_REGIONS[country.code]?.regions||[])]
        .filter(value=>!(country.code==='US'&&['AA','AE','AP'].includes(value)))
        .sort((a,b)=>a.localeCompare(b))
    : [],[country]);
  const suggestions=useMemo(
    ()=>country?suggestedCities(country.code,region):[],
    [country?.code,region]
  );
  const hasQuery=query.trim().length>=2;
  const entries=useMemo(()=>stage==='country'
    ? countries.filter(item=>normalize(item.name).includes(normalize(query)))
    : regionOptions.filter(item=>normalize(item).includes(normalize(query))),
    [stage,query,regionOptions]);
  const shownCities=hasQuery?results:suggestions;
  const liveLookup=canSearchLiveCities();

  const moveBack=()=>{
    Keyboard.dismiss();setQuery('');setResults([]);
    if(stage==='city')setStage(regionOptions.length?'region':'country');
    else if(stage==='region')setStage('country');
    else onClose();
  };
  const chooseCountry=(selected:Country)=>{
    Keyboard.dismiss();setCountry(selected);setRegion('');setQuery('');setResults([]);
    setStage((WORLD_REGIONS[selected.code]?.regions||[]).length?'region':'city');
  };
  const chooseRegion=(selected:string)=>{
    Keyboard.dismiss();setRegion(selected);setQuery('');setResults([]);setStage('city');
  };
  const chooseCity=(selected:WorldCity)=>{
    Keyboard.dismiss();onPick(selected);onClose();
  };

  useEffect(()=>{
    if(!visible||stage!=='city'||!country||!hasQuery){
      setResults([]);setSearching(false);return;
    }
    const controller=new AbortController();
    setResults([]);setSearching(true);
    const timer=setTimeout(()=>{
      searchWorldwideCities(query,controller.signal,country.code,region)
        .then(found=>{if(!controller.signal.aborted)setResults(found);})
        .catch(error=>{if(!controller.signal.aborted)console.log('City search failed:',error);})
        .finally(()=>{if(!controller.signal.aborted)setSearching(false);});
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[visible,stage,country?.code,region,query,hasQuery]);

  const title=stage==='country'?'Choose your country':stage==='region'?'Choose your state / region':'Choose your city';
  const subtitle=stage==='country'?'Start with your country or territory'
    :stage==='region'?country?.name||'':[region,country?.name].filter(Boolean).join(', ');
  const searchPlaceholder=stage==='country'?'Search countries'
    :stage==='region'?'Search states or regions':`Search cities in ${region||country?.name}`;
  return (
    <Modal visible={visible} presentationStyle="fullScreen" animationType="slide" onRequestClose={moveBack}>
      <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
        <View style={styles.inner}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel={stage==='country'?'Cancel city selection':'Go back'}
              onPress={moveBack} hitSlop={10} style={styles.headerButton}>
              <Text style={styles.action}>{stage==='country'?'Cancel':'‹ Back'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close without changing city"
              onPress={()=>{Keyboard.dismiss();onClose();}} hitSlop={10} style={styles.headerButton}>
              <Text style={styles.action}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{subtitle}</Text>
          <View style={styles.steps}>
            {(['country','region','city'] as Stage[]).map((step,i)=>(
              <Text key={step} style={[styles.step,stage===step&&styles.stepCurrent]}>
                {step.toUpperCase()}{i<2?'  ›  ':''}
              </Text>
            ))}
          </View>
          <TextInput autoCorrect={false} autoCapitalize="words"
            accessibilityLabel={searchPlaceholder} value={query} onChangeText={setQuery}
            placeholder={searchPlaceholder} placeholderTextColor={colors.secondary}
            style={styles.input} clearButtonMode="while-editing" returnKeyType="search"
            onSubmitEditing={()=>Keyboard.dismiss()} />
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag" contentContainerStyle={styles.list}>
            {stage!=='city' ? entries.map(item=>{
              const name=typeof item==='string'?item:item.name;
              return <Pressable key={typeof item==='string'?item:item.code}
                accessibilityRole="button" accessibilityLabel={name}
                onPress={()=>stage==='country'?chooseCountry(item as Country):chooseRegion(item as string)}
                style={styles.row}>
                <Text style={styles.rowText}>{name}</Text><Text style={styles.chevron}>›</Text>
              </Pressable>;
            }) : <>
              {searching&&<ActivityIndicator color={colors.accent} style={styles.loading}/>}
              {shownCities.map(city=>(
                <Pressable key={city.id} style={styles.row} accessibilityRole="button"
                  accessibilityLabel={`Select ${city.label}`}
                  onPress={()=>chooseCity(city)}>
                  <Text style={styles.rowText}>{city.label}</Text>
                  <Text style={styles.choose}>SELECT</Text>
                </Pressable>
              ))}
              {!searching&&!shownCities.length&&
                <Text style={styles.empty}>
                  {hasQuery
                    ? liveLookup
                      ? 'No matching cities found. Check the spelling or try a nearby city.'
                      : 'That city is not in OVRLEE’s current offline directory. Broader worldwide search is not configured for this build.'
                    : 'No suggested cities here yet. Type at least two letters to search.'}
                </Text>}
              {!liveLookup&&
                <Text style={styles.directoryNote}>
                  City choices are currently from OVRLEE’s offline directory. More locations require our licensed worldwide search service.
                </Text>}
            </>}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(scheme:'light'|'dark'){
  const light=scheme==='light';
  const text=light?'#3B2218':'#FFFFFF';
  const secondary=light?'#796C65':'#A1A9A2';
  const border=light?'#E1D4CC':'#2D3530';
  const accent=light?'#3B2218':'#39E75F';
  const screen=light?'#FAF8F6':'#080808';
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:screen},
    inner:{flex:1,paddingHorizontal:22,paddingTop:12},
    top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20,minHeight:48},
    headerButton:{minHeight:44,justifyContent:'center',paddingHorizontal:6},
    action:{color:accent,fontSize:16,fontWeight:'800'},
    title:{color:text,fontSize:29,fontWeight:'900',letterSpacing:-0.7,marginBottom:7},
    hint:{color:secondary,fontSize:14,marginBottom:16},
    steps:{flexDirection:'row',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:8},
    step:{color:secondary,fontSize:10,fontWeight:'900',letterSpacing:1.2},
    stepCurrent:{color:accent},
    input:{color:text,backgroundColor:light?'#FFFFFF':'#181818',borderWidth:1,borderColor:border,borderRadius:14,padding:14,fontSize:16,marginBottom:12},
    scroll:{flex:1},
    list:{paddingBottom:45},
    row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
      borderBottomWidth:1,borderBottomColor:border,paddingVertical:15,minHeight:56,gap:10},
    rowText:{color:text,fontSize:15,fontWeight:'600',flex:1},
    chevron:{color:accent,fontSize:23},
    choose:{color:accent,fontSize:10,fontWeight:'900',letterSpacing:0.8},
    loading:{marginVertical:10},
    empty:{color:secondary,fontSize:14,lineHeight:21,marginTop:22},
    directoryNote:{color:secondary,fontSize:12,lineHeight:18,marginTop:18},
  });
}
