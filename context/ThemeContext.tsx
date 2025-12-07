import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

export type ThemePalette = {
  mode: ThemeMode;
  isDark: boolean;
  colors: {
    background: string;
    card: string;
    border: string;
    text: string;
    subtext: string;
    muted: string;
    primary: string;
    success: string;
    danger: string;
    warning: string;
    overlay: string;
    input: string;
    tabBar: string;
    tabBarBorder: string;
    ripple: string;
  };
};

const lightPalette: ThemePalette = {
  mode: 'light',
  isDark: false,
  colors: {
    background: '#f9fafb',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#0f172a',
    subtext: '#475569',
    muted: '#94a3b8',
    primary: '#2563eb',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    overlay: 'rgba(15, 23, 42, 0.6)',
    input: '#f8fafc',
    tabBar: '#ffffff',
    tabBarBorder: '#e5e7eb',
    ripple: '#e5e7eb',
  },
};

const darkPalette: ThemePalette = {
  mode: 'dark',
  isDark: true,
  colors: {
    background: '#0b1220',
    card: '#111827',
    border: '#1f2937',
    text: '#e5e7eb',
    subtext: '#cbd5e1',
    muted: '#94a3b8',
    primary: '#60a5fa',
    success: '#34d399',
    danger: '#f87171',
    warning: '#fbbf24',
    overlay: 'rgba(0, 0, 0, 0.7)',
    input: '#0f172a',
    tabBar: '#0f172a',
    tabBarBorder: '#1f2937',
    ripple: '#1f2937',
  },
};

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedScheme: ThemeMode;
  theme: ThemePalette;
  setPreference: (pref: ThemePreference) => void;
} | null>(null);

const STORAGE_KEY = 'theme-preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreferenceState(value);
        }
      })
      .catch((err) => console.warn('Failed to hydrate theme preference', err));
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch((err) =>
      console.warn('Failed to persist theme preference', err)
    );
  }, []);

  const resolvedScheme: ThemeMode = preference === 'system' ? (systemScheme as ThemeMode) : preference;
  const palette = resolvedScheme === 'dark' ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({ preference, resolvedScheme, theme: palette, setPreference }),
    [palette, preference, resolvedScheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
