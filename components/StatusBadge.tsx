import { StatusColors } from '@/constants/Colors';
import { StyleSheet, Text, View } from 'react-native';

type StatusType = keyof typeof StatusColors;

interface Props {
  status: StatusType;
  label?: string;
}

export default function StatusBadge({ status, label }: Props) {
  const displayLabel = label || status.replace(/_/g, ' ');
  return (
    <View style={[styles.badge, { backgroundColor: StatusColors[status] }]}> 
      <Text style={styles.text}>{displayLabel.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
