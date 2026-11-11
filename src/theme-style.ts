import {StyleSheet} from 'react-native';

const CHOCOLATE='#3B2218';
const LIGHT_CHOCOLATE='#BA8B73';
const GREEN='#39E75F';
const ONLINE=new Set(['online','live','presence','unread','new','verified','success','status','listening','dot','activeindicator','available']);
const isStatus=(key:string)=>ONLINE.has(key.toLowerCase())||/(?:online|live|presence|unread|verified|success|listening|status|newdot|roomcountdot|onlinedot)/i.test(key);

function recolor(name:string,prop:string,value:string,scheme:'light'|'dark'):string{
  if(scheme==='dark')return value; // Preserve the original dark design exactly.
  const textProp=prop==='color';
  const borderProp=prop.toLowerCase().includes('border')&&prop.toLowerCase().includes('color');
  const bgProp=prop==='backgroundColor';
  if(!textProp&&!borderProp&&!bgProp)return value;
  if(value==='transparent')return value;
  const brightGreen=/(?:#39e75f|#35d95[0-9a-f]|#2fe[0-9a-f]{3}|#ba[f0-9]{4})/i.test(value);
  const status=isStatus(name);
  if(brightGreen){
    if(status)return GREEN;
    if(textProp||borderProp)return scheme==='light'?CHOCOLATE:LIGHT_CHOCOLATE;
    if(bgProp)return scheme==='light'?'#EFE0D7':'#3B2218';
  }
  if(scheme==='light' && value.toLowerCase()==='#ba8b73'){
    if(textProp||borderProp)return CHOCOLATE;
    if(bgProp)return '#F1E5DE';
  }
  if(scheme==='dark')return value;
  if(value.toLowerCase()==='white'&&textProp)return CHOCOLATE;
  if(value.startsWith('rgba(')){
    if(textProp){
      const match=/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(value);
      if(match&&+match[1]>160&&+match[2]>160&&+match[3]>160)
        return `rgba(59,34,24,${match[4]})`;
    }
    return value;
  }
  const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if(!m)return value;
  const hex=m[1].length===3?m[1].split('').map(x=>x+x).join(''):m[1];
  const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  const bright=(r+g+b)/3;
  const greenish=g>r*1.18&&g>b*1.06;
  if(textProp){
    if(greenish)return status?'#16843E':CHOCOLATE;
    if(bright>170)return CHOCOLATE;
    if(bright>65)return '#796C65';
    return value;
  }
  if(borderProp){
    if(greenish)return status?'#78BF84':'#C8A99A';
    return bright<140?'#E1D4CC':value;
  }
  if(bgProp){
    if(greenish)return status?'#D7F5DE':'#F1E5DE';
    if(bright<35)return '#FFFFFF';
    if(bright<100)return '#F2EBE6';
  }
  return value;
}

/** Transitional palette for dark-first components.
 * Light screens get readable surfaces; brand-green styles turn chocolate,
 * except for explicit live/online/notification states.
 * For all new UI use useAppearance().colors directly.
 */
export function themedStyleSheet<T extends Record<string,any>>(source:T,scheme:'light'|'dark'):T{
  if(scheme==='dark')return source;
  const out:Record<string,any>={};
  for(const [name,style] of Object.entries(source)){
    const flat=StyleSheet.flatten(style) as Record<string,unknown>|undefined;
    if(!flat){out[name]=style;continue;}
    const changed:Record<string,unknown>={...flat};
    for(const [prop,value] of Object.entries(flat))
      if(typeof value==='string')changed[prop]=recolor(name,prop,value,scheme);
    out[name]=changed;
  }
  return out as T;
}
