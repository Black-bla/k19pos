import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}
