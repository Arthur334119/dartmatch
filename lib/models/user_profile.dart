import 'dart:convert';

class UserProfile {
  final String id;
  final String username;
  final String? bio;
  final String? avatarUrl;
  final List<String> favoriteGames;
  final String? location;
  final DateTime createdAt;
  int? postCount;
  int? reviewCount;

  UserProfile({
    required this.id,
    required this.username,
    this.bio,
    this.avatarUrl,
    required this.favoriteGames,
    this.location,
    required this.createdAt,
    this.postCount,
    this.reviewCount,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    List<String> parseGames(dynamic raw) {
      if (raw == null) return [];
      if (raw is List) return raw.map((e) => e.toString()).toList();
      if (raw is String) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is List) return decoded.map((e) => e.toString()).toList();
        } catch (_) {}
      }
      return [];
    }

    return UserProfile(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? 'Anonym',
      bio: json['bio']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      favoriteGames: parseGames(json['favorite_games']),
      location: json['location']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      postCount: (json['post_count'] as num?)?.toInt(),
      reviewCount: (json['review_count'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'bio': bio,
        'avatar_url': avatarUrl,
        'favorite_games': favoriteGames,
        'location': location,
        'created_at': createdAt.toIso8601String(),
      };

  UserProfile copyWith({
    String? username,
    String? bio,
    String? avatarUrl,
    List<String>? favoriteGames,
    String? location,
  }) {
    return UserProfile(
      id: id,
      username: username ?? this.username,
      bio: bio ?? this.bio,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      favoriteGames: favoriteGames ?? this.favoriteGames,
      location: location ?? this.location,
      createdAt: createdAt,
      postCount: postCount,
      reviewCount: reviewCount,
    );
  }
}
