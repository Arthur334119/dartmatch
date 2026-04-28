import 'package:flutter/material.dart';
import '../../models/user_profile.dart';
import '../../models/post.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import '../../widgets/post_card.dart';
import '../chat/chat_detail_screen.dart';

class UserProfileScreen extends StatefulWidget {
  final String userId;
  const UserProfileScreen({super.key, required this.userId});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  final _service = SupabaseService();
  UserProfile? _profile;
  List<Post> _posts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final profile = await _service.getUserProfile(widget.userId);
    final allPosts = await _service.getPosts();
    if (mounted) {
      setState(() {
        _profile = profile;
        _posts = allPosts.where((p) => p.userId == widget.userId).toList();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profil')),
        body: const Center(child: Text('Profil nicht gefunden.')),
      );
    }

    final theme = Theme.of(context);
    final currentUserId = _service.getCurrentUser()?.id;
    final isOwnProfile = currentUserId == widget.userId;

    return Scaffold(
      appBar: AppBar(
        title: Text(_profile!.username),
        actions: [
          if (!isOwnProfile)
            IconButton(
              icon: const Icon(Icons.chat_bubble_outline),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ChatDetailScreen(
                    otherUserId: widget.userId,
                    otherUsername: _profile!.username,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        children: [
          _buildHeader(theme, isOwnProfile),
          _buildStats(theme),
          if (_profile!.favoriteGames.isNotEmpty) _buildGames(theme),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Posts',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
          ),
          if (_posts.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: Text('Noch keine Posts.',
                    style: TextStyle(color: AppColors.textMuted)),
              ),
            )
          else
            ..._posts.map((post) => PostCard(
                  post: post,
                  currentUserId: currentUserId ?? '',
                  onDelete: isOwnProfile
                      ? () async {
                          await _service.deletePost(post.id);
                          _loadData();
                        }
                      : null,
                )),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildHeader(ThemeData theme, bool isOwn) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          CircleAvatar(
            radius: 40,
            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
            backgroundImage: _profile!.avatarUrl != null
                ? NetworkImage(_profile!.avatarUrl!)
                : null,
            child: _profile!.avatarUrl == null
                ? Text(
                    _profile!.username.substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                        fontSize: 32,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700),
                  )
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_profile!.username,
                    style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800)),
                if (_profile!.location != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text(_profile!.location!,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: AppColors.textMuted)),
                    ],
                  ),
                ],
                if (_profile!.bio != null && _profile!.bio!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(_profile!.bio!,
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: AppColors.textMuted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      color: theme.cardColor,
      child: Row(
        children: [
          _statItem(theme, '${_posts.length}', 'Posts'),
          Container(
              width: 1, height: 30, color: AppColors.divider.withValues(alpha: 0.5)),
          _statItem(theme, '${_profile!.favoriteGames.length}', 'Lieblingsspiele'),
        ],
      ),
    );
  }

  Widget _statItem(ThemeData theme, String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style:
                  theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          Text(label,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _buildGames(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Lieblingsspiele',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _profile!.favoriteGames.map((game) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Text(game,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.primary, fontWeight: FontWeight.w600)),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
