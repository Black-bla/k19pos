
import OrderTakingScreen from '@/components/screens/OrderTakingScreen';
import { router, useLocalSearchParams } from 'expo-router';

export default function OrderScreen() {
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
