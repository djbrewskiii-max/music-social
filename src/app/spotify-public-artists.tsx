/**
 * Experimental, user-initiated preview of artists visibly rendered on
 * a public Spotify profile. No Spotify API token, login, hidden endpoints,
 * cookie extraction, playback history inference or background collection.
 *
 * Spotify's HTML and product policy can change. Do not commercialize
 * automatically collected Spotify data without appropriate permission.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { normalizePublicProfile } from '../spotify-public-reader';
import { supabase } from '../supabase';

const GREEN = '#39E75F';
// Request Spotify's desktop website instead of its mobile app handoff page.
// This is a compatibility experiment, not a guarantee that WKWebView is supported.
const DESKTOP_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const clean = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
type VisibleArtist = { id: string; name: string; url: string };
type BrowserResult = { type: string; url: string; artists?: VisibleArtist[]; pageTitle?: string; headingVisible?: boolean; pageNotFound?: boolean; appHandoff?: boolean };

// Only runs after the user explicitly taps "Read visible artists".
// Observe a named Spotify UI grid. Never read browser storage, credentials,
// responses, cookies or any hidden application state.
const READ_VISIBLE_ARTISTS = `(function(){
  try {
    if (!/^\\/user\\/[a-zA-Z0-9_-]+\\/recently-played-artists\\/?$/.test(location.pathname)) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'artists',url:location.href,artists:[]}));
      return true;
    }
    var screenText = (document.body && document.body.innerText || '').slice(0,3000);
    var handoff = /continue in the spotify app/i.test(screenText) && /download app/i.test(screenText);
    if (handoff) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'artists',url:location.href,artists:[],appHandoff:true}));
      return true;
    }
    var grid = document.querySelector('[data-testid="grid-container"]');
    var cards = grid ? Array.from(grid.querySelectorAll('[data-encore-id="card"]')) : [];
    var artists = [], seen = {};
    cards.forEach(function(card) {
      var link = card.querySelector('a[href*="/artist/"]');
      var match = link && (link.getAttribute('href') || '').match(/\\/artist\\/([A-Za-z0-9]{10,64})(?:[/?#]|$)/);
      var label = card.querySelector('[data-encore-id="cardTitle"]');
      var name = (label && (label.getAttribute('title') || label.textContent) || link && link.textContent || '').trim();
      if (!match || !name || name.length > 120 || seen[match[1]] || artists.length >= 50) return;
      seen[match[1]] = true;
      artists.push({id:match[1],name:name,url:'https://open.spotify.com/artist/'+match[1]});
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type:'artists',url:location.href,artists:artists,
      pageTitle:document.title,
      headingVisible:!!Array.from(document.querySelectorAll('h1,h2,h3,h4'))
        .find(function(h){return /recently played artists/i.test(h.textContent || '');}),
      pageNotFound:/couldn['’]?t find that page/i.test(document.body && document.body.innerText || '')
    }));
  } catch (_) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'artists',url:location.href,artists:[]}));
  }
  return true;
})();true;`;

export default function PublicSpotifyArtistsPreview(){
  const {url} = useLocalSearchParams<{url?:string}>();
  const profile = useMemo(()=>{
    try { return normalizePublicProfile(typeof url === 'string' ? url : ''); } catch { return null; }
  },[url]);
  const webRef = useRef<WebView>(null);
  const [artists,setArtists] = useState<VisibleArtist[]>([]);
  const [selected,setSelected] = useState<string[]>([]);
  const [reading,setReading] = useState(false);
  const [appHandoff,setAppHandoff] = useState(false);
  const [securityChallenge,setSecurityChallenge] = useState(false);
  const [saving,setSaving] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [message,setMessage] = useState('Open the public artist page, then tap Read visible artists.');
  const [navigation,setNavigation] = useState('');
  const page = profile ? profile.url+'/recently-played-artists' : null;
  const currentOriginIsSpotify = !!page && navigation.split('?')[0].replace(/\\/$/,'') === page;
  const onPublicPageNavigation = (request:{url:string}) => {
    let address:URL;
    try { address = new URL(request.url); } catch { return false; }
    // Reject top-level navigation into Spotify's separate security challenge.
    // Never attempt to solve, hide, or circumvent CAPTCHA.
    const challenge = address.hostname === 'challenge.spotify.com'
      || address.hostname === 'www.google.com' && address.pathname.includes('recaptcha')
      || address.hostname === 'www.recaptcha.net';
    if(challenge){
      setSecurityChallenge(true);
      setLoaded(false);
      setMessage('Spotify requested a security challenge, so the public artist preview is unavailable in this embedded browser.');
      return false;
    }
    if(address.hostname !== 'open.spotify.com')return false;
    return true;
  };
  const read = () => {
    if(securityChallenge){
      setMessage('Spotify blocked the embedded preview with a security challenge. Artist extraction is unavailable here.');
      return;
    }
    if(!loaded || !currentOriginIsSpotify || !webRef.current) {
      setMessage('Spotify has not finished loading the public artist page.');
      return;
    }
    setReading(true);
    setAppHandoff(false);
    setMessage('Checking the artist cards currently visible on this page…');
    webRef.current.injectJavaScript(READ_VISIBLE_ARTISTS);
  };
  const receive = (event:WebViewMessageEvent) => {
    setReading(false);
    let result:BrowserResult;
    try { result = JSON.parse(event.nativeEvent.data) as BrowserResult; }
    catch { setMessage('Spotify returned an unreadable page result.'); return; }
    if(result.type !== 'artists' || !page || !result.url?.startsWith(page)) {
      setMessage('The browser navigated away from this public artist page.');
      return;
    }
    const valid=(Array.isArray(result.artists)?result.artists:[])
      .filter(a => typeof a.id === 'string' && /^[A-Za-z0-9]{10,64}$/.test(a.id)
        && typeof a.name === 'string' && a.name.trim().length>0 && a.name.length<=120
        && a.url==='https://open.spotify.com/artist/'+a.id);
    const deduped=[...new Map(valid.map(a=>[a.id,a])).values()].slice(0,50);
    setAppHandoff(result.appHandoff===true);
    setArtists(deduped);
    setSelected(deduped.map(a=>a.id));
    setMessage(deduped.length
      ? deduped.length+' visible artist cards found. Choose which to save privately.'
      : result.appHandoff ? 'Spotify is showing its Download App screen instead of the artist grid. That screen cannot provide artist data in this viewer.'
      : result.pageNotFound ? 'Spotify says this profile page was not found. Verify the exact shared profile link.'
      : result.headingVisible ? 'The section loaded but its artist cards were not exposed.'
      : 'Spotify has not rendered the public artist grid here. Try again once the page is visible.');
  };
  const save=async()=>{
    const chosen=artists.filter(a=>selected.includes(a.id));
    if(!chosen.length || saving)return;
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign into OVRLEE before saving artists.');
      const unique=[...new Map(chosen.map(a=>[clean(a.name),a])).values()];
      const rows=unique.map(a=>({
        user_id:user.id,artist:a.name.trim(),artist_key:clean(a.name),
        source_label:'Spotify public profile · user reviewed'
      }));
      const {error}=await supabase.from('music_import_artists')
        .upsert(rows,{onConflict:'user_id,artist_key',ignoreDuplicates:true});
      if(error)throw error;
      Alert.alert('Saved privately',rows.length+' artists added to your private music suggestions. Your public profile has not changed.',[
        {text:'Stay here'},{text:'My imported music',onPress:()=>router.push('/imported-music')}
      ]);
    }catch(e){Alert.alert('Unable to save',e instanceof Error?e.message:'Please try again.');}
    finally{setSaving(false);}
  };
  if(!profile || !page)return <SafeAreaView style={s.root}><Text style={s.error}>Enter a valid Spotify profile link first.</Text>
    <Pressable onPress={()=>router.back()}><Text style={s.link}>GO BACK</Text></Pressable></SafeAreaView>;
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable>
      <Text style={s.headerText}>PUBLIC ARTIST PREVIEW</Text><View style={{width:22}}/>
    </View>
    <Text style={s.explainer}>Experimental browser preview · no Spotify sign-in or API token required. Read artists only after the public page has loaded.</Text>
    <View style={s.browser}>
      <WebView ref={webRef} source={{uri:page}}
        contentMode="desktop"
        userAgent={DESKTOP_SAFARI_UA}
        javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false} incognito
        originWhitelist={['https://open.spotify.com']}
        onShouldStartLoadWithRequest={onPublicPageNavigation}
        onNavigationStateChange={state=>{
          setNavigation(state.url);
          setLoaded(!state.loading && state.url.split('?')[0].replace(/\\/$/,'') === page);
        }}
        onMessage={receive}
        onError={()=>{setLoaded(false);setMessage('Spotify could not load this page in the embedded browser.');}}
        onHttpError={e=>setMessage('Spotify page returned HTTP '+e.nativeEvent.statusCode)}
        setSupportMultipleWindows={false}
        style={{flex:1,backgroundColor:'#101010'}}/>
    </View>
    <View style={s.bottom}>
      <Pressable style={[s.button,(!loaded || reading || securityChallenge)&&{opacity:.5}]}
        disabled={!loaded || reading || securityChallenge} onPress={read}>
        {reading?<ActivityIndicator color="#000"/>:<Text style={s.buttonText}>READ VISIBLE ARTISTS →</Text>}
      </Pressable>
      <Text style={s.message}>{message}</Text>
      {securityChallenge&&<Text style={s.error}>Spotify is requesting reCAPTCHA rather than loading artist cards. This WebView approach cannot continue. No further login or Download App attempts are needed.</Text>}
      {appHandoff&&<Text style={s.error}>The embedded browser is not receiving the desktop artist page. Don't press Download App again; this path is unavailable on this device.</Text>}
      {artists.length>0&&<ScrollView style={{maxHeight:205}} contentContainerStyle={{paddingBottom:8}}>
        {artists.map(a=>{
          const yes=selected.includes(a.id);
          return <Pressable key={a.id} onPress={()=>setSelected(previous=>
            yes?previous.filter(id=>id!==a.id):[...previous,a.id]
          )} style={s.artist}>
            <Text style={s.tick}>{yes?'✓':'○'}</Text><Text style={s.artistName}>{a.name}</Text>
          </Pressable>;
        })}
      </ScrollView>}
      {artists.length>0&&<Pressable disabled={saving||!selected.length}
        onPress={()=>void save()} style={[s.save,(!selected.length||saving)&&{opacity:.5}]}>
        {saving?<ActivityIndicator color="#000"/>:<Text style={s.buttonText}>SAVE {selected.length} ARTISTS PRIVATELY</Text>}
      </Pressable>}
      <Text style={s.notice}>This is a user-initiated proof of concept, not an approved commercial Spotify data integration. No background scans or public posting.</Text>
    </View>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#090909'},header:{paddingHorizontal:18,height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#292929'},
  back:{color:'#fff',fontSize:32},headerText:{color:'#fff',fontWeight:'900',letterSpacing:1,fontSize:12},
  explainer:{fontSize:12,color:'#aaa',lineHeight:18,margin:14},browser:{flex:1,marginHorizontal:12,overflow:'hidden',borderRadius:13,borderWidth:1,borderColor:'#333'},
  bottom:{paddingHorizontal:18,paddingTop:12,paddingBottom:12},button:{backgroundColor:GREEN,padding:15,alignItems:'center',borderRadius:12},
  buttonText:{fontSize:12,color:'#070707',fontWeight:'900'},message:{color:'#b6b6b6',fontSize:12,marginVertical:12,lineHeight:18},
  artist:{borderBottomWidth:1,borderBottomColor:'#222',paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10},
  artistName:{fontSize:13,color:'#fff',fontWeight:'700'},tick:{fontSize:19,color:GREEN},save:{backgroundColor:GREEN,padding:13,borderRadius:12,alignItems:'center',marginTop:10},
  notice:{fontSize:10,color:'#777',marginTop:10,lineHeight:15},error:{color:'#f99',fontSize:14,margin:24},link:{color:GREEN,fontWeight:'900',margin:20},
});
