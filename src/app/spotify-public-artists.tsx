import SpotifyConnectScreen from './spotify-connect';
/**
 * User-initiated preview of artists visibly rendered on
 * a public Spotify profile. No Spotify API token, login, hidden endpoints,
 * cookie extraction, playback history inference or background collection.
 *
 * Spotify's HTML and product policy can change. Do not commercialize
 * automatically collected Spotify data without appropriate permission.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { normalizePublicProfile } from '../spotify-public-reader';
import { newlyVisibleArtistIds } from '../spotify-observation-diff';
import { supabase } from '../supabase';

const GREEN = '#39E75F';
// Request Spotify's desktop website instead of its mobile app handoff page.
// This is a compatibility experiment, not a guarantee that WKWebView is supported.
const DESKTOP_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const clean = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
type VisibleArtist = { id: string; name: string; url: string; imageUrl?: string };
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
      var img = card.querySelector('img');
      var imageUrl = img && (img.currentSrc || img.getAttribute('src') || '');
      if (typeof imageUrl !== 'string' || imageUrl.indexOf('https://') !== 0) imageUrl = '';
      artists.push({id:match[1],name:name,url:'https://open.spotify.com/artist/'+match[1],imageUrl:imageUrl});
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

function PublicSpotifyArtistsPreviewExperiment(){
  const {url,onboarding} = useLocalSearchParams<{url?:string;onboarding?:string}>();
  const fromOnboarding=onboarding==='1';
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
  const [message,setMessage] = useState("Open Spotify's public artist page, then bring those artists into OVRLEE.");
  const [navigation,setNavigation] = useState('');
  const [popupNote,setPopupNote] = useState('');
  const [query,setQuery] = useState('');
  const [showBrowser,setShowBrowser] = useState(true);
  const filteredArtists=useMemo(()=>{
    const q=query.toLowerCase().trim();
    return q ? artists.filter(a=>a.name.toLowerCase().includes(q)) : artists;
  },[artists,query]);
  const selectedCount=useMemo(()=>artists.filter(a=>selected.includes(a.id)).length,[artists,selected]);
  const page = profile ? profile.url+'/recently-played-artists' : null;
  const isPreviewPage=(value:string)=>{
    if(!page)return false;
    try{
      const target=new URL(value);
      return target.origin==='https://open.spotify.com'
        && target.pathname.replace(/\/$/,'')===new URL(page).pathname;
    }catch{return false;}
  };
  const currentOriginIsSpotify=isPreviewPage(navigation);
  const isVerificationURL=(value:URL)=>value.hostname==='challenge.spotify.com'
    || (value.hostname==='www.google.com'&&value.pathname.includes('recaptcha'))
    || value.hostname==='www.recaptcha.net';
  const onPublicPageNavigation=(request:{url:string;isTopFrame?:boolean;hasTargetFrame?:boolean})=>{
    if(request.url==='about:blank')return true;
    // Don't obstruct embedded page resources or subordinate frames.
    if(request.isTopFrame===false)return true;
    let target:URL;
    try{target=new URL(request.url);}catch{return false;}
    if(isVerificationURL(target)){
      // A genuine top-level challenge means the public artist page is
      // not available. We do not attempt to circumvent verification.
      if(request.hasTargetFrame!==false){
        setSecurityChallenge(true);
        setLoaded(false);
        setMessage('Spotify requested browser verification. Artist preview is unavailable until Spotify permits this page.');
      }else{
        setPopupNote('Spotify requested another window. OVRLEE kept the original preview open.');
      }
      return false;
    }
    // Only the exact, user-selected public artist page may replace the view.
    // Returning false also prevents iOS from opening unrelated websites.
    return isPreviewPage(request.url);
  };
  const onOpenExternalWindow=(targetUrl:string)=>{
    // onOpenWindow intentionally does not open a browser or follow the URL.
    // This preserves the artist page when Spotify requests an extra window.
    try{
      if(isVerificationURL(new URL(targetUrl))){
        setPopupNote('Spotify attempted a separate verification window. The public preview remains visible, but we will not bypass a required challenge.');
      }else{
        setPopupNote('A separate browser window was requested. OVRLEE stayed on the public artist preview.');
      }
    }catch{setPopupNote('A separate browser window was blocked.');}
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
    if(result.type !== 'artists' || !result.url || !isPreviewPage(result.url)) {
      setMessage('The browser navigated away from this public artist page.');
      return;
    }
    const valid=(Array.isArray(result.artists)?result.artists:[])
      .filter(a => typeof a.id === 'string' && /^[A-Za-z0-9]{10,64}$/.test(a.id)
        && typeof a.name === 'string' && a.name.trim().length>0 && a.name.length<=120
        && a.url==='https://open.spotify.com/artist/'+a.id)
      .map(a=>({
        ...a,
        imageUrl:typeof a.imageUrl==='string' && /^https:\/\/(?:i\.scdn\.co|image-cdn-ak\.spotifycdn\.com)\//.test(a.imageUrl)
          ? a.imageUrl : undefined
      }));
    const deduped=[...new Map(valid.map(a=>[a.id,a])).values()].slice(0,50);
    setAppHandoff(result.appHandoff===true);
    setArtists(deduped);
    setSelected(deduped.map(a=>a.id));
    if(deduped.length){
      setShowBrowser(false);
      // Preserve only a successful, explicit observation of the member's
      // own registered profile. Browsing a different profile must not
      // change the member's musical identity or saved source snapshots.
      void (async()=>{
        const {data:{user}}=await supabase.auth.getUser();
        if(!user||!profile)return;
        const {data:connection,error}=await supabase.from('member_music_connections')
          .select('provider_user_id,self_declared_owner,last_observed_artist_ids,last_observed_artist_at')
          .eq('user_id',user.id).maybeSingle();
        if(error||!connection?.self_declared_owner||connection.provider_user_id!==profile.userId)return;
        const latestIds=deduped.map(a=>a.id);
        const previouslyObserved=connection.last_observed_artist_at
          ? connection.last_observed_artist_ids as string[] : null;
        const newArtistIds=newlyVisibleArtistIds(previouslyObserved,latestIds);
        const {error:writeError}=await supabase.from('member_music_connections')
          .update({
            last_observed_artist_ids:latestIds,
            last_new_artist_ids:newArtistIds,
            last_observed_artist_at:new Date().toISOString(),
            updated_at:new Date().toISOString(),
          }).eq('user_id',user.id).eq('provider_user_id',profile.userId);
        if(writeError)console.log('Artist observation sync:',writeError.message);
      })().catch(error=>console.log('Artist observation sync:',error));
    }
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
        {text:'Stay here'},{text:fromOnboarding?'Finish setup':'Explore music',onPress:()=>router.replace(fromOnboarding?'/now':'/music-discovery')}
      ]);
    }catch(e){Alert.alert('Unable to save',e instanceof Error?e.message:'Please try again.');}
    finally{setSaving(false);}
  };
  if(!profile || !page)return <SafeAreaView style={s.root}><Text style={s.error}>Enter a valid Spotify profile link first.</Text>
    <Pressable onPress={()=>router.back()}><Text style={s.link}>GO BACK</Text></Pressable></SafeAreaView>;
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable>
      <Text style={s.headerText}>SPOTIFY ARTISTS</Text><View style={{width:22}}/>
    </View>
    {showBrowser || artists.length===0 ? <>
      <Text style={s.explainer}>Artists from the public Spotify profile. Nothing is saved until you choose.</Text>
      <View style={s.browser}>
        <WebView ref={webRef} source={{uri:page}}
          contentMode="desktop"
          userAgent={DESKTOP_SAFARI_UA}
          javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false} incognito
          originWhitelist={['https://*']}
          javaScriptCanOpenWindowsAutomatically={false}
          onOpenWindow={e=>onOpenExternalWindow(e.nativeEvent.targetUrl)}
          onShouldStartLoadWithRequest={onPublicPageNavigation}
          onNavigationStateChange={state=>{
            setNavigation(state.url);
            setLoaded(!state.loading && isPreviewPage(state.url) && !securityChallenge);
          }}
          onMessage={receive}
          onError={()=>{setLoaded(false);setMessage('Spotify could not load this page in the embedded browser.');}}
          onHttpError={e=>setMessage('Spotify page returned HTTP '+e.nativeEvent.statusCode)}
          setSupportMultipleWindows={false}
          style={{flex:1,backgroundColor:'#101010'}}/>
      </View>
      <View style={s.bottom}>
        <Pressable accessibilityRole="button" accessibilityLabel="Read artists displayed in Spotify"
          style={[s.button,(!loaded||reading||securityChallenge)&&{opacity:.5}]}
          disabled={!loaded||reading||securityChallenge} onPress={read}>
          {reading?<ActivityIndicator color="#000"/>:<Text style={s.buttonText}>FIND ARTISTS →</Text>}
        </Pressable>
        <Text style={s.message}>{message}</Text>
        {!!popupNote&&<Text style={s.popupNote}>{popupNote}</Text>}
        {securityChallenge&&<Text style={s.error}>Spotify requires browser verification. Artist extraction is not available on this page.</Text>}
        {appHandoff&&<Text style={s.error}>Spotify is showing its Download App screen instead of an artist list.</Text>}
        <Text style={s.notice}>Spotify's public pages can change. This is not a live listening-history connection.</Text>
      </View>
    </> : <>
      <View style={s.reviewIntro}>
        <Text style={s.kicker}>OVRLEE × SPOTIFY</Text>
        <Text style={s.reviewTitle}>{artists.length} artists found</Text>
        <Text style={s.reviewDescription}>Choose what catches your ear. These selections quietly improve your music suggestions.</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search these artists"
          placeholderTextColor="#777" style={s.search} autoCorrect={false}
          accessibilityLabel="Search artist suggestions"/>
        <View style={s.actions}>
          <Text style={s.selectedText}>{selectedCount} of {artists.length} selected</Text>
          <Pressable accessibilityRole="button" onPress={()=>setSelected(artists.map(a=>a.id))}>
            <Text style={s.selectAction}>SELECT ALL</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={()=>setSelected([])}>
            <Text style={s.selectAction}>CLEAR</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={s.reviewList} contentContainerStyle={s.reviewContent} keyboardShouldPersistTaps="handled">
        {filteredArtists.map((a,i)=>{
          const checked=selected.includes(a.id);
          return <Pressable key={a.id} accessibilityRole="checkbox"
            accessibilityState={{checked}} accessibilityLabel={a.name}
            onPress={()=>setSelected(previous=>checked
              ? previous.filter(id=>id!==a.id) : [...previous,a.id])}
            style={s.artistRow}>
            {a.imageUrl
              ? <Image source={{uri:a.imageUrl}} style={s.avatar}/>
              : <View style={s.avatarFallback}><Text style={s.avatarLetter}>{a.name.charAt(0).toUpperCase()}</Text></View>}
            <View style={s.artistDetails}>
              <Text style={s.artistName} numberOfLines={1}>{a.name}</Text>
              <Text style={s.artistMeta}>Spotify artist</Text>
            </View>
            <View style={[s.checkCircle,checked&&s.checkCircleOn]}>
              <Text style={{fontSize:14,fontWeight:'900',color:checked?'#090909':'#777'}}>{checked?'✓':'+'}</Text>
            </View>
          </Pressable>;
        })}
        {!filteredArtists.length&&<Text style={s.empty}>No artists match that search.</Text>}
      </ScrollView>
      <View style={s.reviewFooter}>
        <Pressable accessibilityRole="button" disabled={saving||selectedCount===0}
          onPress={()=>void save()} style={[s.button,(saving||selectedCount===0)&&{opacity:.45}]}>
          {saving?<ActivityIndicator color="#000"/>:
            <Text style={s.buttonText}>SAVE {selectedCount} ARTIST{selectedCount===1?'':'S'} PRIVATELY →</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" style={s.again}
          onPress={()=>{
            setArtists([]);setSelected([]);setQuery('');setShowBrowser(true);
            setLoaded(false);setSecurityChallenge(false);setAppHandoff(false);
            setPopupNote('');setMessage("Open Spotify's public artist page, then bring those artists into OVRLEE.");
          }}>
          <Text style={s.againText}>SCAN AGAIN</Text>
        </Pressable>
        <Text style={s.notice}>Saving does not publish artists, establish listening frequency, or add anything to your public profile.</Text>
      </View>
    </>}
  </SafeAreaView>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#090909'},
  header:{paddingHorizontal:18,height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#292929'},
  back:{color:'#fff',fontSize:32},headerText:{color:'#fff',fontWeight:'900',letterSpacing:1,fontSize:12},
  explainer:{fontSize:12,color:'#aaa',lineHeight:18,margin:14},
  browser:{flex:1,marginHorizontal:12,overflow:'hidden',borderRadius:13,borderWidth:1,borderColor:'#333'},
  bottom:{paddingHorizontal:18,paddingTop:12,paddingBottom:12},
  button:{backgroundColor:GREEN,padding:15,alignItems:'center',borderRadius:12},
  buttonText:{fontSize:12,color:'#070707',fontWeight:'900'},
  message:{color:'#b6b6b6',fontSize:12,marginVertical:12,lineHeight:18},
  notice:{fontSize:10,color:'#777',marginTop:10,lineHeight:15},
  popupNote:{fontSize:11,color:'#d6b27d',marginBottom:8,lineHeight:16},
  error:{color:'#f99',fontSize:13,marginVertical:8},
  link:{color:GREEN,fontWeight:'900',margin:20},
  kicker:{color:GREEN,fontSize:10,fontWeight:'900',letterSpacing:1.5},
  reviewIntro:{paddingHorizontal:19,paddingTop:21,paddingBottom:10},
  reviewTitle:{color:'#fff',fontSize:29,fontWeight:'900',marginTop:8},
  reviewDescription:{color:'#aaa',fontSize:13,lineHeight:20,marginTop:9},
  search:{backgroundColor:'#1B1B1B',color:'#fff',fontSize:14,padding:15,borderWidth:1,borderColor:'#333',borderRadius:12,marginTop:17},
  actions:{flexDirection:'row',alignItems:'center',gap:15,marginTop:16,paddingBottom:5},
  selectedText:{color:'#bcbcbc',fontSize:12,flex:1},
  selectAction:{color:GREEN,fontSize:11,fontWeight:'900'},
  reviewList:{flex:1},
  reviewContent:{paddingHorizontal:19,paddingBottom:25},
  artistRow:{flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:'#242424',paddingVertical:11},
  avatar:{width:51,height:51,borderRadius:26,backgroundColor:'#232323'},
  avatarFallback:{width:51,height:51,borderRadius:26,backgroundColor:'#18281D',alignItems:'center',justifyContent:'center'},
  avatarLetter:{fontSize:20,color:GREEN,fontWeight:'900'},
  artistDetails:{flex:1,gap:4},artistName:{color:'#fff',fontSize:15,fontWeight:'800'},
  artistMeta:{color:'#888',fontSize:11},
  checkCircle:{width:27,height:27,borderRadius:14,borderWidth:1,borderColor:'#555',alignItems:'center',justifyContent:'center'},
  checkCircleOn:{backgroundColor:GREEN,borderColor:GREEN},
  empty:{color:'#aaa',fontSize:13,paddingTop:30,textAlign:'center'},
  reviewFooter:{paddingHorizontal:19,paddingTop:10,paddingBottom:14,borderTopWidth:1,borderTopColor:'#242424'},
  again:{padding:12,alignItems:'center'},againText:{color:'#bcbcbc',fontSize:11,fontWeight:'900',letterSpacing:.6},
});

// Keep this browser DOM reader out of release navigation.
export default function PublicSpotifyArtistsPreview() {
  return __DEV__ ? <PublicSpotifyArtistsPreviewExperiment /> : <SpotifyConnectScreen />;
}
