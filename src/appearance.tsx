import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';

export type AppearancePreference='system'|'light'|'dark';
const KEY='ovrlee.appearance.v1';
type AppearanceContextValue={
  preference:AppearancePreference;
  scheme:'light'|'dark';
  colors:{background:string;surface:string;raised:string;text:string;secondary:string;border:string;accent:string;accentText:string};
  setPreference:(next:AppearancePreference)=>Promise<void>;
};
const AppearanceContext=createContext<AppearanceContextValue|null>(null);
export function AppearanceProvider({children}:{children:React.ReactNode}){
  const system=useColorScheme();
  const [preference,setLocalPreference]=useState<AppearancePreference>('system');
  useEffect(()=>{
    let mounted=true;
    AsyncStorage.getItem(KEY).then(saved=>{
      if(mounted && (saved==='system'||saved==='light'||saved==='dark'))setLocalPreference(saved);
    }).catch(()=>{});
    return ()=>{mounted=false;};
  },[]);
  const scheme=preference==='system'?(system==='light'?'light':'dark'):preference;
  const colors=useMemo(()=>scheme==='light'?{
    background:'#FAF8F6',surface:'#FFFFFF',raised:'#F2EBE6',
    text:'#2E201B',secondary:'#796C65',border:'#E1D4CC',
    accent:'#3B2218',accentText:'#FFFFFF'
  }:{
    background:'#080808',surface:'#141414',raised:'#1C241E',
    text:'#FFFFFF',secondary:'#A1A9A2',border:'#2D3530',
    accent:'#39E75F',accentText:'#071108'
  },[scheme]);
  const value=useMemo<AppearanceContextValue>(()=>({
    preference,scheme,colors,
    setPreference:async next=>{
      await AsyncStorage.setItem(KEY,next);
      setLocalPreference(next);
    }
  }),[preference,scheme,colors]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(){
  const value=useContext(AppearanceContext);
  if(!value)throw new Error('useAppearance must be used inside AppearanceProvider');
  return value;
}
