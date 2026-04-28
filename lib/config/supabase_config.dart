class SupabaseConfig {
  // WICHTIG: Ersetze den Anon Key mit deinem vollständigen Key aus dem Supabase Dashboard
  static const String supabaseUrl = 'https://lnvfhyiudwbcasaiggzl.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudmZoeWl1ZHdiY2FzYWlnZ3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjIyNDYsImV4cCI6MjA5MjkzODI0Nn0.0GzClghqX4SNvWcIlqz9ONf0S3cHJv78hWP8NfEQV6I'; // ← aus Supabase Dashboard kopieren

  // Table names
  static const String barsTable = 'bars';
  static const String postsTable = 'posts';
  static const String reviewsTable = 'reviews';
  static const String profilesTable = 'profiles';
  static const String messagesTable = 'messages';
  static const String presenceTable = 'presence';

  // Storage buckets
  static const String avatarsBucket = 'avatars';
  static const String barImagesBucket = 'bar-images';

  // Realtime channels
  static const String postsChannel = 'posts_channel';
  static const String messagesChannel = 'messages_channel';
  static const String presenceChannel = 'presence_channel';
}
