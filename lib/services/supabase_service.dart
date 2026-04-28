import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/bar.dart';
import '../models/post.dart';
import '../models/review.dart';
import '../models/user_profile.dart';
import '../models/message.dart';
import '../config/supabase_config.dart';
import 'location_service.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get _client => Supabase.instance.client;
  final LocationService _location = LocationService();

  // ── AUTH ──────────────────────────────────────────────────────────────────

  Future<AuthResponse> login(String email, String password) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<AuthResponse> signup(String email, String password,
      {String? username}) async {
    final res = await _client.auth.signUp(
      email: email,
      password: password,
      data: username != null ? {'username': username} : null,
    );
    if (res.user != null) {
      await _ensureProfile(res.user!.id, username ?? email.split('@').first);
    }
    return res;
  }

  Future<void> logout() async {
    await _client.auth.signOut();
  }

  User? getCurrentUser() => _client.auth.currentUser;

  bool get isLoggedIn => _client.auth.currentUser != null;

  Future<void> _ensureProfile(String userId, String username) async {
    try {
      final existing = await _client
          .from(SupabaseConfig.profilesTable)
          .select()
          .eq('id', userId)
          .maybeSingle();
      if (existing == null) {
        await _client.from(SupabaseConfig.profilesTable).insert({
          'id': userId,
          'username': username,
          'favorite_games': [],
          'created_at': DateTime.now().toIso8601String(),
        });
      }
    } catch (_) {}
  }

  // ── PROFILES ──────────────────────────────────────────────────────────────

  Future<UserProfile?> getUserProfile(String userId) async {
    try {
      final data = await _client
          .from(SupabaseConfig.profilesTable)
          .select()
          .eq('id', userId)
          .maybeSingle();
      if (data == null) return null;
      return UserProfile.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  Future<void> updateProfile(String userId, Map<String, dynamic> data) async {
    await _client
        .from(SupabaseConfig.profilesTable)
        .upsert({'id': userId, ...data});
  }

  // ── BARS ──────────────────────────────────────────────────────────────────

  Future<List<Bar>> getAllBars() async {
    try {
      final data = await _client
          .from(SupabaseConfig.barsTable)
          .select()
          .order('name');
      return (data as List).map((e) => Bar.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<Bar>> getBarsNearby({
    double? lat,
    double? lng,
    double radiusKm = 5.0,
  }) async {
    final bars = await getAllBars();
    final pos = _location.lastKnownPosition;
    final userLat = lat ?? pos?.latitude;
    final userLng = lng ?? pos?.longitude;

    if (userLat == null || userLng == null) return bars;

    for (final bar in bars) {
      bar.distanceKm = _location.calculateDistance(
        userLat, userLng, bar.latitude, bar.longitude,
      );
    }
    bars.sort((a, b) => (a.distanceKm ?? 0).compareTo(b.distanceKm ?? 0));
    return bars.where((b) => (b.distanceKm ?? 0) <= radiusKm).toList();
  }

  Future<Bar?> getBarDetails(String barId) async {
    try {
      final data = await _client
          .from(SupabaseConfig.barsTable)
          .select()
          .eq('id', barId)
          .single();
      return Bar.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  // ── REVIEWS ───────────────────────────────────────────────────────────────

  Future<List<Review>> getBarReviews(String barId) async {
    try {
      final data = await _client
          .from(SupabaseConfig.reviewsTable)
          .select('*, profiles(username, avatar_url)')
          .eq('bar_id', barId)
          .order('created_at', ascending: false);
      return (data as List).map((e) => Review.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> addReview({
    required String barId,
    required double rating,
    required String content,
  }) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) throw Exception('Nicht angemeldet');

    await _client.from(SupabaseConfig.reviewsTable).insert({
      'user_id': userId,
      'bar_id': barId,
      'rating': rating,
      'content': content,
      'created_at': DateTime.now().toIso8601String(),
    });

    // Recalculate bar rating
    final reviews = await getBarReviews(barId);
    if (reviews.isNotEmpty) {
      final avg = reviews.map((r) => r.rating).reduce((a, b) => a + b) /
          reviews.length;
      await _client.from(SupabaseConfig.barsTable).update({
        'rating': double.parse(avg.toStringAsFixed(1)),
        'review_count': reviews.length,
      }).eq('id', barId);
    }
  }

  // ── POSTS ─────────────────────────────────────────────────────────────────

  Future<List<Post>> getPosts({String? type, String? barId}) async {
    try {
      var query = _client
          .from(SupabaseConfig.postsTable)
          .select('*, profiles(username, avatar_url), bars(name)')
          .order('created_at', ascending: false)
          .limit(50);

      // Filter client-side since chaining dynamic filters is complex
      final data = await query;
      var posts = (data as List).map((e) => Post.fromJson(e)).toList();

      if (type != null) posts = posts.where((p) => p.type == type).toList();
      if (barId != null) posts = posts.where((p) => p.barId == barId).toList();

      return posts.where((p) => !p.isExpired).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> createPost({
    required String type,
    String? gameType,
    String? barId,
    required String content,
    int? playerCount,
    Duration? duration,
  }) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) throw Exception('Nicht angemeldet');

    await _client.from(SupabaseConfig.postsTable).insert({
      'user_id': userId,
      'bar_id': barId,
      'type': type,
      'game_type': gameType,
      'content': content,
      'player_count': playerCount,
      'expires_at': duration != null
          ? DateTime.now().add(duration).toIso8601String()
          : null,
      'created_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deletePost(String postId) async {
    await _client
        .from(SupabaseConfig.postsTable)
        .delete()
        .eq('id', postId);
  }

  Stream<List<Post>> get postsStream {
    return _client
        .from(SupabaseConfig.postsTable)
        .stream(primaryKey: ['id'])
        .order('created_at', ascending: false)
        .map((data) => data.map((e) => Post.fromJson(e)).toList());
  }

  // ── MESSAGES ──────────────────────────────────────────────────────────────

  Future<List<Message>> getMessages(String otherUserId) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) return [];

    try {
      final data = await _client
          .from(SupabaseConfig.messagesTable)
          .select('*, sender:sender_id(username, avatar_url)')
          .or('and(sender_id.eq.$userId,receiver_id.eq.$otherUserId),and(sender_id.eq.$otherUserId,receiver_id.eq.$userId)')
          .order('created_at');
      return (data as List).map((e) => Message.fromJson(e)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> sendMessage({
    required String receiverId,
    required String content,
  }) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) throw Exception('Nicht angemeldet');

    await _client.from(SupabaseConfig.messagesTable).insert({
      'sender_id': userId,
      'receiver_id': receiverId,
      'content': content,
      'created_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> markMessageAsRead(String messageId) async {
    await _client
        .from(SupabaseConfig.messagesTable)
        .update({'read_at': DateTime.now().toIso8601String()})
        .eq('id', messageId);
  }

  Future<List<Conversation>> getConversations() async {
    final userId = getCurrentUser()?.id;
    if (userId == null) return [];

    try {
      final data = await _client
          .from(SupabaseConfig.messagesTable)
          .select('*, sender:sender_id(id, username, avatar_url), receiver:receiver_id(id, username, avatar_url)')
          .or('sender_id.eq.$userId,receiver_id.eq.$userId')
          .order('created_at', ascending: false);

      final messages = (data as List).map((e) => Message.fromJson(e)).toList();
      final Map<String, List<Message>> grouped = {};

      for (final msg in messages) {
        final otherId =
            msg.senderId == userId ? msg.receiverId : msg.senderId;
        grouped.putIfAbsent(otherId, () => []).add(msg);
      }

      final conversations = <Conversation>[];
      for (final entry in grouped.entries) {
        final otherId = entry.key;
        final msgs = entry.value;
        final lastMsg = msgs.first;
        final unread = msgs
            .where((m) => m.receiverId == userId && !m.isRead)
            .length;

        final rawSender = data.firstWhere(
          (d) => d['sender_id'] == otherId || d['receiver_id'] == otherId,
          orElse: () => {},
        );
        String otherUsername = 'Unbekannt';
        String? otherAvatar;
        if (rawSender.isNotEmpty) {
          if (rawSender['sender_id'] == otherId) {
            otherUsername =
                rawSender['sender']?['username']?.toString() ?? 'Unbekannt';
            otherAvatar = rawSender['sender']?['avatar_url']?.toString();
          } else {
            otherUsername =
                rawSender['receiver']?['username']?.toString() ?? 'Unbekannt';
            otherAvatar = rawSender['receiver']?['avatar_url']?.toString();
          }
        }

        conversations.add(Conversation(
          otherUserId: otherId,
          otherUsername: otherUsername,
          otherAvatarUrl: otherAvatar,
          lastMessage: lastMsg,
          unreadCount: unread,
        ));
      }
      return conversations;
    } catch (e) {
      return [];
    }
  }

  Stream<List<Message>> messagesStream(String otherUserId) {
    final userId = getCurrentUser()?.id ?? '';
    return _client
        .from(SupabaseConfig.messagesTable)
        .stream(primaryKey: ['id'])
        .order('created_at')
        .map((data) {
          final all = data.map((e) => Message.fromJson(e)).toList();
          return all
              .where((m) =>
                  (m.senderId == userId && m.receiverId == otherUserId) ||
                  (m.senderId == otherUserId && m.receiverId == userId))
              .toList();
        });
  }

  // ── PRESENCE ──────────────────────────────────────────────────────────────

  Future<void> addPresence(String barId) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) return;

    await _client.from(SupabaseConfig.presenceTable).upsert({
      'user_id': userId,
      'bar_id': barId,
      'checked_in_at': DateTime.now().toIso8601String(),
      'expires_at':
          DateTime.now().add(const Duration(hours: 4)).toIso8601String(),
    });
  }

  Future<void> removePresence(String barId) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) return;

    await _client
        .from(SupabaseConfig.presenceTable)
        .delete()
        .eq('user_id', userId)
        .eq('bar_id', barId);
  }

  Future<int> getPresenceAtBar(String barId) async {
    try {
      final now = DateTime.now().toIso8601String();
      final data = await _client
          .from(SupabaseConfig.presenceTable)
          .select('user_id')
          .eq('bar_id', barId)
          .gt('expires_at', now);
      return (data as List).length;
    } catch (e) {
      return 0;
    }
  }

  Future<bool> isCheckedIn(String barId) async {
    final userId = getCurrentUser()?.id;
    if (userId == null) return false;
    try {
      final now = DateTime.now().toIso8601String();
      final data = await _client
          .from(SupabaseConfig.presenceTable)
          .select()
          .eq('user_id', userId)
          .eq('bar_id', barId)
          .gt('expires_at', now)
          .maybeSingle();
      return data != null;
    } catch (e) {
      return false;
    }
  }
}
