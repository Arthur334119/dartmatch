class Review {
  final String id;
  final String userId;
  final String barId;
  final double rating;
  final String content;
  final DateTime createdAt;
  final String? username;
  final String? avatarUrl;

  Review({
    required this.id,
    required this.userId,
    required this.barId,
    required this.rating,
    required this.content,
    required this.createdAt,
    this.username,
    this.avatarUrl,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      barId: json['bar_id']?.toString() ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      content: json['content']?.toString() ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      username: json['profiles']?['username']?.toString() ??
          json['username']?.toString(),
      avatarUrl: json['profiles']?['avatar_url']?.toString() ??
          json['avatar_url']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'bar_id': barId,
        'rating': rating,
        'content': content,
        'created_at': createdAt.toIso8601String(),
      };
}
