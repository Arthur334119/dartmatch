import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../../models/message.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import 'chat_detail_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final _service = SupabaseService();
  List<Conversation> _conversations = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    final convs = await _service.getConversations();
    if (mounted) {
      setState(() {
        _conversations = convs;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Nachrichten')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _conversations.isEmpty
              ? _buildEmpty(theme)
              : RefreshIndicator(
                  onRefresh: _loadConversations,
                  color: AppColors.primary,
                  child: ListView.separated(
                    itemCount: _conversations.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 72),
                    itemBuilder: (_, i) =>
                        _buildConversationTile(_conversations[i], theme),
                  ),
                ),
    );
  }

  Widget _buildConversationTile(Conversation conv, ThemeData theme) {
    final hasUnread = conv.unreadCount > 0;
    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
            backgroundImage: conv.otherAvatarUrl != null
                ? NetworkImage(conv.otherAvatarUrl!)
                : null,
            child: conv.otherAvatarUrl == null
                ? Text(
                    conv.otherUsername.substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 18),
                  )
                : null,
          ),
          if (hasUnread)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                width: 18,
                height: 18,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    conv.unreadCount > 9 ? '9+' : '${conv.unreadCount}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
        ],
      ),
      title: Text(
        conv.otherUsername,
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: hasUnread ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
      subtitle: Text(
        conv.lastMessage.content,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.bodySmall?.copyWith(
          color: hasUnread ? theme.colorScheme.onSurface : AppColors.textMuted,
          fontWeight: hasUnread ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      trailing: Text(
        timeago.format(conv.lastMessage.createdAt, locale: 'de'),
        style: theme.textTheme.bodySmall?.copyWith(
          color: hasUnread ? AppColors.primary : AppColors.textMuted,
          fontWeight: hasUnread ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatDetailScreen(
              otherUserId: conv.otherUserId,
              otherUsername: conv.otherUsername,
              otherAvatarUrl: conv.otherAvatarUrl,
            ),
          ),
        );
        _loadConversations();
      },
    );
  }

  Widget _buildEmpty(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.chat_bubble_outline,
              size: 72, color: AppColors.textMuted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          Text('Noch keine Nachrichten',
              style: theme.textTheme.titleMedium
                  ?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Text(
            'Schreibe jemanden aus dem Community Feed an!',
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: AppColors.textMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
