import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

type ThemeState = {
  theme: 'light' | 'dark';
  init: () => Promise<void>;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  init: async () => {
    const stored = await AsyncStorage.getItem('bidwave-theme');
    const theme = stored === 'dark' ? 'dark' : 'light';
    colorScheme.set(theme);
    set({ theme });
  },
  toggle: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      colorScheme.set(next);
      AsyncStorage.setItem('bidwave-theme', next);
      return { theme: next };
    });
  },
}));
