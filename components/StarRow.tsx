import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/colors';

export function StarRow({
  rating,
  size = 16,
  interactive,
  onChange,
  inactiveColor,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
  inactiveColor?: string;
}) {
  const inactive = inactiveColor ?? colors.warning + '40';
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rating;
        const half = !filled && i - 0.5 <= rating;
        const icon = filled ? 'star' : half ? 'star-half' : 'star';
        const color = filled || half ? colors.warning : inactive;
        if (interactive && onChange) {
          return (
            <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={8}>
              <Ionicons name={icon} size={size} color={color} />
            </TouchableOpacity>
          );
        }
        return <Ionicons key={i} name={icon} size={size} color={color} />;
      })}
    </View>
  );
}
