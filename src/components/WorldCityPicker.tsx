import {useEffect,useMemo,useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import {ActivityIndicator,Keyboard,Modal,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {useAppearance} from '../appearance';
import {searchWorldwideCities,canSearchLiveCities,type WorldCity} from '../world-cities';

/**
 * One direct city search, not Country → Region → City.
 * Locations are chosen by members, never read from device GPS.
 * ZIP lookup is not advertised until a licensed postal geocoder is configured.
 */
export default function WorldCityPicker({visible,onClose,onPick}:{
  visible:boolean;onClose:()=>void;onPick:(city:WorldCity)=>void;
}){
  const {scheme,colors}=useAppearance();
  const styles=useMemo(()=>makeStyles(scheme),[scheme]);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<WorldCity[]>([]);
  const [searching,setSearching]=useState(false);
  const [error,setError]=useState('');
  const hasQuery=query.trim().length>=2;

  useEffect(()=>{
    if(visible){setQuery('');setResults([]);setError('');setSearching(false);}
  },[visible]);

  useEffect(()=>{
    if(!visible||!hasQuery){setResults([]);setSearching(false);return;}
    const controller=new AbortController();
    setSearching(true);setResults([]);setError('');
    const timer=setTimeout(()=>{
      searchWorldwideCities(query.trim(),controller.signal)
        .then(rows=>{if(!controller.signal.aborted)setResults(rows);})
        .catch(()=>{if(!controller.signal.aborted)setError('City search is unavailable. Try again.');})
        .finally(()=>{if(!controller.signal.aborted)setSearching(false);});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[visible,query,hasQuery]);

  const choose=(city:WorldCity)=>{Keyboard.dismiss();onPick(city);onClose();};

  return <Modal visible={visible} presentationStyle="fullScreen" animationType="slide"
    onRequestClose={onClose}>
    <StatusBar style={scheme==='light'?'dark':'light'}/>
    <SafeAreaView style={[styles.screen,{backgroundColor:colors.background}]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.brand}>OVRLEE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close city search" onPress={()=>{
            Keyboard.dismiss();onClose();
          }} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Where are you based?</Text>
        <Text style={styles.description}>Choose a city for local music discovery.</Text>
        <TextInput
          autoFocus
          accessibilityLabel="Search cities worldwide"
          value={query} onChangeText={setQuery}
          autoCorrect={false} autoCapitalize="words"
          placeholder="Search your city" placeholderTextColor={colors.secondary}
          clearButtonMode="while-editing" returnKeyType="search"
          style={styles.input} onSubmitEditing={()=>Keyboard.dismiss()}
        />
        <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag" contentContainerStyle={{paddingBottom:36}}>
          {searching&&<ActivityIndicator color={colors.accent} style={{marginTop:25}}/>}
          {!!error&&!searching&&<Text style={styles.feedback}>{error}</Text>}
          {!searching&&results.map(city=><Pressable
            key={city.id} accessibilityRole="button"
            accessibilityLabel={'Choose '+city.label}
            onPress={()=>choose(city)} style={styles.row}>
            <Text style={styles.rowText}>{city.label}</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>)}
          {!hasQuery&&<Text style={styles.feedback}>Type at least two letters to find your city.</Text>}
          {hasQuery&&!searching&&!error&&results.length===0&&
            <Text style={styles.feedback}>No matching city yet. Try a nearby city or choose later.</Text>}
          {hasQuery&&!searching&&!canSearchLiveCities()&&
            <Text style={styles.privacy}>More cities are being added. You can update yours later.</Text>}
        </ScrollView>
        <Text style={styles.privacy}>Only your selected city is used—never your exact location.</Text>
      </View>
    </SafeAreaView>
  </Modal>;
}

function makeStyles(scheme:'light'|'dark'){
 const light=scheme==='light';
 const ink=light?'#3B2218':'#FFFFFF';
 const secondary=light?'#796C65':'#A1A9A2';
 const border=light?'#E1D4CC':'#2D3530';
 const accent=light?'#3B2218':'#39E75F';
 return StyleSheet.create({
  screen:{flex:1},inner:{flex:1,paddingHorizontal:24,paddingTop:12,paddingBottom:18},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:50,marginBottom:25},
  brand:{color:ink,fontWeight:'900',letterSpacing:3,fontSize:15},
  close:{color:accent,fontSize:15,fontWeight:'800',padding:9},
  title:{color:ink,fontSize:31,fontWeight:'900',marginBottom:8},
  description:{color:secondary,fontSize:15,marginBottom:23},
  input:{color:ink,backgroundColor:light?'#FFFFFF':'#171717',borderWidth:1,borderColor:border,borderRadius:15,
    paddingVertical:16,paddingHorizontal:17,fontSize:16,marginBottom:12},
  row:{borderBottomWidth:1,borderColor:border,minHeight:61,paddingVertical:15,
    flexDirection:'row',alignItems:'center',gap:12},
  rowText:{color:ink,fontSize:16,fontWeight:'600',flex:1},
  arrow:{color:accent,fontSize:23,fontWeight:'800'},
  feedback:{color:secondary,fontSize:14,lineHeight:22,marginTop:25},
  privacy:{color:secondary,fontSize:11,lineHeight:17,marginTop:12}
 });
}
