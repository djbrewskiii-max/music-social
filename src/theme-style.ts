import {StyleSheet} from 'react-native';

/**
 * Transitional light palette for legacy dark-first screens.
 * Treat their shared StyleSheet colors consistently without touching layout.
 * New components should consume useAppearance().colors directly.
 * This intentionally does not recolor photos, artwork or inline image overlays.
 */
function recolor(key:string, original:string):string{
  if(original==='transparent'||original.startsWith('rgba('))return original;
  const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(original);
  if(!m)return original;
  let hex=m[1];
  if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');
  const nums=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  const [r,g,b]=nums;
  const bright=(r+g+b)/3;
  const greenish=g>r*1.18 && g>b*1.06;
  const isBorder=key.toLowerCase().includes('border');
  if(key==='color'){
    if(greenish)return '#18783A';
    if(bright>175)return '#17251B';
    if(bright>70)return '#516459';
    return original; // Keep button text on colored call-to-actions.
  }
  if(isBorder){
    if(greenish)return '#9BCBAB';
    if(bright<140)return '#D3DED5';
    return original;
  }
  if(key==='backgroundColor'){
    if(greenish)return '#E7F3E9';
    if(bright<35)return '#FFFFFF';
    if(bright<95)return '#EEF3EF';
    return original;
  }
  return original;
}
export function themedStyleSheet<T extends Record<string,any>>(source:T,scheme:'light'|'dark'):T{
  if(scheme==='dark')return source;
  const out:Record<string,any>={};
  for(const [key,style] of Object.entries(source)){
    const flat=StyleSheet.flatten(style) as Record<string,unknown>|undefined;
    if(!flat){out[key]=style;continue;}
    const changed:Record<string,unknown>={...flat};
    for(const [prop,value] of Object.entries(flat))
      if(typeof value==='string' && (prop==='color'||prop==='backgroundColor'||prop.toLowerCase().includes('border')))
        changed[prop]=recolor(prop,value);
    out[key]=changed;
  }
  return out as T;
}
