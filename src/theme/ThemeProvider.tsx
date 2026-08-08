import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ColorScheme, darkColors, lightColors } from './colors';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  colors: ColorScheme;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = '@smt_customer/theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  mode: 'light',
  setMode: () => {},
  toggle: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  // The reference is a light-mode design, so light stays the default until the
  // customer explicitly opts into dark or system.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (
          !cancelled &&
          (stored === 'light' || stored === 'dark' || stored === 'system')
        ) {
          setModeState(stored);
        }
      })
      .catch(() => {
        /* first launch — keep the default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = useMemo(
    () => (mode === 'system' ? systemScheme === 'dark' : mode === 'dark'),
    [mode, systemScheme],
  );

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      mode,
      setMode,
      toggle,
    }),
    [isDark, mode, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
