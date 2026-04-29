import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://lecyqxfmfmyoipbuhsrc.supabase.co';
export const SUPABASE_ANON_KEY =
  'sb_publishable_O7Fwr_SETgjZ5LAiY2hKSw_f20sZVi2';

export const TABLES = {
  bars: 'bars',
  posts: 'posts',
  reviews: 'reviews',
  profiles: 'profiles',
  presence: 'presence',
} as const;

export const BUCKETS = {
  avatars: 'avatars',
  barImages: 'bar-images',
} as const;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
