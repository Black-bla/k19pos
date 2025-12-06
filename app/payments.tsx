import PaymentsListScreen from '@/components/screens/PaymentsListScreen';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

export default function PaymentsPage() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return <PaymentsListScreen />;
}
