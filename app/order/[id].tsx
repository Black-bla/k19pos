
import OrderTakingScreen from '@/components/screens/OrderTakingScreen';
import { useTheme } from '@/context/ThemeContext';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function OrderScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { id } = useLocalSearchParams();

  function handleClose() {
    router.back();
  }

  return (
    <OrderTakingScreen 
      guestId={id as string}
      onClose={handleClose}
    />
  );
}

function createStyles(theme: any) {
  const c = theme.colors;
  return {};
}

const styles = {};
