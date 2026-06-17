// Shared design tokens — used by all screens via useAppTheme()
import { useThemeStore } from './theme-store';

export const Colors = {
  primary: '#0B5FFF',
  accent: '#FFB400',
  success: '#16A34A',
  danger: '#DC2626',
  ink: '#0F172A',
};

export function useAppTheme() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  return {
    dark,
    theme,
    bg: dark ? '#09090b' : '#f4f6fb',
    card: dark ? '#18181b' : '#ffffff',
    border: dark ? '#27272a' : '#e5e7eb',
    ink: dark ? '#ffffff' : '#0F172A',
    muted: dark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)',
    subtle: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.04)',
    input: dark ? '#27272a' : '#f1f5f9',
  };
}
