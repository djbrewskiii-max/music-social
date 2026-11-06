import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_ENABLED_KEY = 'ovrlee:overly-intro:enabled:v1';
const INTRO_LAST_SHOWN_KEY = 'ovrlee:overly-intro:last-shown:v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export async function isOverlyIntroEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_ENABLED_KEY)) !== 'false';
}

export async function setOverlyIntroEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(INTRO_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function shouldShowOverlyIntro(): Promise<boolean> {
  if (!(await isOverlyIntroEnabled())) return false;
  const last = Number(await AsyncStorage.getItem(INTRO_LAST_SHOWN_KEY));
  return !Number.isFinite(last) || last <= 0 || Date.now() - last >= DAY_MS;
}

export async function markOverlyIntroShown(): Promise<void> {
  await AsyncStorage.setItem(INTRO_LAST_SHOWN_KEY, String(Date.now()));
}
