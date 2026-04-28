class Message {
  final String id;
  final String senderId;
  final String receiverId;
  final String content;
  final DateTime? readAt;
  final DateTime createdAt;
  final String? senderUsername;
  final String? senderAvatarUrl;

  Message({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    this.readAt,
    required this.createdAt,
    this.senderUsername,
    this.senderAvatarUrl,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id']?.toString() ?? '',
      senderId: json['sender_id']?.toString() ?? '',
      receiverId: json['receiver_id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      readAt: json['read_at'] != null
          ? DateTime.tryParse(json['read_at'].toString())
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      senderUsername: json['sender']?['username']?.toString() ??
          json['sender_username']?.toString(),
      senderAvatarUrl: json['sender']?['avatar_url']?.toString() ??
          json['sender_avatar_url']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sender_id': senderId,
        'receiver_id': receiverId,
        'content': content,
        'read_at': readAt?.toIso8601String(),
        'created_at': createdAt.toIso8601String(),
      };

  bool get isRead => readAt != null;
}

class Conversation {
  final String otherUserId;
  final String otherUsername;
  final String? otherAvatarUrl;
  final Message lastMessage;
  final int unreadCount;

  Conversation({
    required this.otherUserId,
    required this.otherUsername,
    this.otherAvatarUrl,
    required this.lastMessage,
    required this.unreadCount,
  });
}
