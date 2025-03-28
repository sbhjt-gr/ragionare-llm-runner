import { ThemeColors } from '../types/theme';

const lightTheme = {
  background: '#fff',
  text: '#000',
  headerBackground: '#660880',
  headerText: '#fff',
  tabBarBackground: '#660880',
  tabBarActiveText: '#fff',
  tabBarInactiveText: 'rgba(255, 255, 255, 0.6)',
  borderColor: '#eee',
  statusBarStyle: 'light' as const,
  statusBarBg: '#4d0461',
  navigationBar: '#660880',
  secondaryText: '#666',
  primary: '#4a0660',
};

const darkTheme = {
  background: '#1E1326',
  text: '#fff',
  headerBackground: '#4a0660',
  headerText: '#fff',
  tabBarBackground: '#4a0660',
  tabBarActiveText: '#fff',
  tabBarInactiveText: 'rgba(255, 255, 255, 0.6)',
  borderColor: '#2D1F39',
  statusBarStyle: 'light' as const,
  statusBarBg: '#31043d',
  navigationBar: '#4a0660',
  secondaryText: '#999',
  primary: '#4a0660',
};

export const theme: Record<ThemeColors, typeof lightTheme> = {
  light: lightTheme,
  dark: darkTheme,
}; 