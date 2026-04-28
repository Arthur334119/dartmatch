class Post {
  final String id;
  final String userId;
  final String? barId;
  final String type;
  final String? gameType;
  final String content;
  final int? playerCount;
  final DateTime? expiresAt;
  final DateTime createdAt;
  final String? username;
  final String? avatarUrl;
  final String? barName;

  Post({
    required this.id,
    required this.userId,
    this.barId,
    required this.type,
    this.gameType,
    required this.content,
    this.playerCount,
    this.expiresAt,
    required this.createdAt,
    this.username,
    this.avatarUrl,
    this.barName,
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      barId: json['bar_id']?.toString(),
      type: json['type']?.toString() ?? 'looking',
      gameType: json['game_type']?.toString(),
      content: json['content']?.toString() ?? '',
      playerCount: (json['player_count'] as num?)?.toInt(),
      expiresAt: json['expires_at'] != null
          ? DateTime.tryParse(json['expires_at'].toString())
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      username: json['profiles']?['username']?.toString() ??
          json['username']?.toString(),
      avatarUrl: json['profiles']?['avatar_url']?.toString() ??
          json['avatar_url']?.toString(),
      barName:
          json['bars']?['name']?.toString() ?? json['bar_name']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'bar_id': barId,
        'type': type,
        'game_type': gameType,
        'content': content,
        'player_count': playerCount,
        'expires_at': expiresAt?.toIso8601String(),
        'created_at': createdAt.toIso8601String(),
      };

  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());

  bool get isPlaying => type == 'playing';

  String get typeLabel => isPlaying ? 'Spielt gerade' : 'Sucht Gegner';
}
