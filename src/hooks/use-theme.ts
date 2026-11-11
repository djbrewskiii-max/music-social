import { Colors } from '@/constants/theme';
import { useAppearance } from '../appearance';

export function useTheme(){
  const {scheme}=useAppearance();
  return Colors[scheme];
}
