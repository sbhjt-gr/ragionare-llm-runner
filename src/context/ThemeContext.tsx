import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;  // The active theme (light/dark)
  selectedTheme: ThemeType;  // The selected theme mode (system/light/dark)
  toggleTheme: (newTheme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  selectedTheme: 'system',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>('system');

  const getActiveTheme = () => {
    if (selectedTheme === 'system') {
      return systemColorScheme || 'light';
    }
    return selectedTheme;
  };

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (selectedTheme === 'system') {
      // Force re-render when system theme changes
      getActiveTheme();
    }
  }, [systemColorScheme]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      if (savedTheme) {
        setSelectedTheme(savedTheme as ThemeType);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = (newTheme: ThemeType) => {
    setSelectedTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme: getActiveTheme(), 
      selectedTheme,
      toggleTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 