import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../models/post.dart';
import '../utils/colors.dart';

class PostCard extends StatelessWidget {
  final Post post;
  final String currentUserId;
  final VoidCallback? onDelete;
  final VoidCallback? onUserTap;
  final VoidCallback? onBarTap;
  final VoidCallback? onMessageTap;

  const PostCard({
    super.key,
    required this.post,
    required this.currentUserId,
    this.onDelete,
    this.onUserTap,
    this.onBarTap,
    this.onMessageTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isOwner = post.userId == currentUserId;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(theme, isOwner),
            const SizedBox(height: 12),
            _buildTypeChip(theme),
            const SizedBox(height: 8),
            Text(
              post.content,
              style: theme.textTheme.bodyMedium,
            ),
            if (post.gameType != null) ...[
              const SizedBox(height: 8),
              _buildInfoRow(theme, Icons.sports_score, post.gameType!),
            ],
            if (post.playerCount != null) ...[
              const SizedBox(height: 4),
              _buildInfoRow(
                  theme, Icons.people_outline, '${post.playerCount} Spieler'),
            ],
            if (post.expiresAt != null) ...[
              const SizedBox(height: 4),
              _buildInfoRow(
                theme,
                Icons.timer_outlined,
                post.isExpired
                    ? 'Abgelaufen'
                    : 'Bis ${_formatTime(post.expiresAt!)}',
                color: post.isExpired ? AppColors.error : AppColors.textMuted,
              ),
            ],
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            _buildFooter(theme, isOwner),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme, bool isOwner) {
    return Row(
      children: [
        GestureDetector(
          onTap: onUserTap,
          child: CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
            backgroundImage: post.avatarUrl != null
                ? NetworkImage(post.avatarUrl!)
                : null,
            child: post.avatarUrl == null
                ? Text(
                    (post.username ?? 'A').substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: onUserTap,
                child: Text(
                  post.username ?? 'Anonym',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (post.barName != null)
                GestureDetector(
                  onTap: onBarTap,
                  child: Text(
                    post.barName!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        ),
        Text(
          timeago.format(post.createdAt, locale: 'de'),
          style:
              theme.textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
        ),
        if (isOwner) ...[
          const SizedBox(width: 4),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, size: 20,
                color: AppColors.textMuted),
            onSelected: (value) {
              if (value == 'delete') onDelete?.call();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                  SizedBox(width: 8),
                  Text('Löschen',
                      style: TextStyle(color: AppColors.error)),
                ]),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildTypeChip(ThemeData theme) {
    final isPlaying = post.isPlaying;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isPlaying
            ? AppColors.success.withValues(alpha: 0.12)
            : AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPlaying ? Icons.sports_score : Icons.search,
            size: 14,
            color: isPlaying ? AppColors.success : AppColors.primary,
          ),
          const SizedBox(width: 4),
          Text(
            post.typeLabel,
            style: theme.textTheme.bodySmall?.copyWith(
              color: isPlaying ? AppColors.success : AppColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(ThemeData theme, IconData icon, String text,
      {Color? color}) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color ?? AppColors.textMuted),
        const SizedBox(width: 6),
        Text(
          text,
          style: theme.textTheme.bodySmall
              ?.copyWith(color: color ?? AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildFooter(ThemeData theme, bool isOwner) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (!isOwner)
          TextButton.icon(
            onPressed: onMessageTap,
            icon: const Icon(Icons.chat_bubble_outline, size: 16),
            label: const Text('Schreiben'),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            ),
          ),
      ],
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m Uhr';
  }
}
