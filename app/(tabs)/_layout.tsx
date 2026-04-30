import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { palette, colors, radii, spacing } from '@/lib/colors';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { subscribeIncomingMessages } from '@/lib/chat';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size?: number;
  badge?: number;
};

function TabIcon({ name, focused, color, size = 22, badge }: TabIconProps) {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  return (
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: p.primarySoft },
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
      {badge != null && badge > 0 && (
        <View style={[styles.badge, { borderColor: p.surface }]}>
          <Text style={styles.badgeText}>
            {badge > 9 ? '9+' : String(badge)}
          </Text>
        </View>
      )}
    </View>
  );
}

function useUnreadChatCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;

    async function refresh() {
      const user = await getCurrentUser();
      if (!user) {
        if (mounted) setCount(0);
        return;
      }
      const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .is('read_at', null);
      if (!mounted) return;
      if (error) {
        setCount(0);
        return;
      }
      setCount(count ?? 0);
    }

    refresh();

    getCurrentUser().then((user) => {
      if (!user || !mounted) return;
      unsub = subscribeIncomingMessages(user.id, () => {
        refresh();
      });
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  return count;
}

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const p = palette(scheme);
  const unread = useUnreadChatCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: p.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginBottom: Platform.OS === 'ios' ? 0 : 6,
        },
        tabBarStyle: {
          backgroundColor: p.surface,
          borderTopColor: p.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarItemStyle: {
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Karte',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'map' : 'map-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'people' : 'people-outline'}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              focused={focused}
              color={color}
              badge={unread}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person-circle' : 'person-circle-outline'}
              focused={focused}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
