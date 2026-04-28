import 'package:flutter/material.dart';
import '../../models/post.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import '../../utils/constants.dart';
import '../../widgets/post_card.dart';
import '../chat/chat_detail_screen.dart';
import '../home/bar_detail_screen.dart';
import 'create_post_screen.dart';
import 'user_profile_screen.dart';

class CommunityFeedScreen extends StatefulWidget {
  const CommunityFeedScreen({super.key});

  @override
  State<CommunityFeedScreen> createState() => _CommunityFeedScreenState();
}

class _CommunityFeedScreenState extends State<CommunityFeedScreen> {
  final _service = SupabaseService();
  List<Post> _posts = [];
  bool _isLoading = true;
  String? _filterType;
  int _selectedTab = 0;

  final _tabs = ['Alle', 'Spielt', 'Sucht'];
  final _tabTypes = [null, AppConstants.postTypePlaying, AppConstants.postTypeLooking];

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    setState(() => _isLoading = true);
    final posts = await _service.getPosts(type: _filterType);
    if (mounted) {
      setState(() {
        _posts = posts;
        _isLoading = false;
      });
    }
  }

  Future<void> _deletePost(String postId) async {
    await _service.deletePost(postId);
    _loadPosts();
  }

  void _switchTab(int i) {
    setState(() {
      _selectedTab = i;
      _filterType = _tabTypes[i];
    });
    _loadPosts();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentUser = _service.getCurrentUser();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Community'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: _buildTabBar(theme),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _posts.isEmpty
              ? _buildEmpty(theme)
              : RefreshIndicator(
                  onRefresh: _loadPosts,
                  color: AppColors.primary,
                  child: StreamBuilder<List<Post>>(
                    stream: _service.postsStream,
                    builder: (ctx, snapshot) {
                      final posts = snapshot.hasData
                          ? snapshot.data!
                              .where((p) =>
                                  !p.isExpired &&
                                  (_filterType == null ||
                                      p.type == _filterType))
                              .toList()
                          : _posts;
                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: posts.length,
                        itemBuilder: (_, i) => PostCard(
                          post: posts[i],
                          currentUserId: currentUser?.id ?? '',
                          onDelete: () => _deletePost(posts[i].id),
                          onUserTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => UserProfileScreen(
                                  userId: posts[i].userId),
                            ),
                          ),
                          onBarTap: posts[i].barId != null
                              ? () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BarDetailScreen(
                                          barId: posts[i].barId!),
                                    ),
                                  )
                              : null,
                          onMessageTap: posts[i].userId != currentUser?.id
                              ? () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ChatDetailScreen(
                                        otherUserId: posts[i].userId,
                                        otherUsername:
                                            posts[i].username ?? 'Anonym',
                                      ),
                                    ),
                                  )
                              : null,
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreatePostScreen()),
          );
          _loadPosts();
        },
        icon: const Icon(Icons.add),
        label: const Text('Post erstellen'),
      ),
    );
  }

  Widget _buildTabBar(ThemeData theme) {
    return Row(
      children: List.generate(_tabs.length, (i) {
        final isSelected = _selectedTab == i;
        return Expanded(
          child: GestureDetector(
            onTap: () => _switchTab(i),
            child: Container(
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isSelected ? AppColors.primary : Colors.transparent,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                _tabs[i],
                style: theme.textTheme.labelMedium?.copyWith(
                  color: isSelected ? AppColors.primary : AppColors.textMuted,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
                ),
              ),
            ),
          ),
        );
      }),
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
          Text('Noch keine Posts',
              style: theme.textTheme.titleMedium?.copyWith(
                  color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Text('Sei der Erste und erstelle einen Post!',
              style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textMuted)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CreatePostScreen()),
              );
              _loadPosts();
            },
            icon: const Icon(Icons.add),
            label: const Text('Post erstellen'),
          ),
        ],
      ),
    );
  }
}
