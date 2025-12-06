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
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: '#fff' }, style]}>
      {children}
    </SafeAreaView>
  );
}
