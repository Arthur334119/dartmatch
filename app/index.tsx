import { Redirect } from 'expo-router';
import {
  View,
  Text,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '@/lib/auth';
import {
  colors,
  palette,
  shadows,
  spacing,
} from '@/lib/colors';

export default function AuthGate() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const { session, fullyVerified, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.bg,
        }}
      >
        <Animated.View
          entering={FadeIn.duration(280)}
          style={{ alignItems: 'center', gap: spacing.lg }}
        >
          <View
            style={[
              {
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
              shadows.brand,
            ]}
          >
            <Ionicons name="beer" size={40} color="#fff" />
          </View>
          <Text
            style={{
              color: colors.primaryDeep,
              fontWeight: '900',
              fontSize: 22,
              letterSpacing: -0.4,
            }}
          >
            Kneipenfinder
          </Text>
          <ActivityIndicator color={colors.primary} />
        </Animated.View>
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!fullyVerified) return <Redirect href="/(auth)/verify" />;
  return <Redirect href="/(tabs)" />;
}
