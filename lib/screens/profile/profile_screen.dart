import 'package:flutter/material.dart';
import '../../models/user_profile.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import '../../utils/constants.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _service = SupabaseService();
  UserProfile? _profile;
  bool _isLoading = true;
  bool _isDarkMode = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final userId = _service.getCurrentUser()?.id;
    if (userId == null) return;
    final profile = await _service.getUserProfile(userId);
    if (mounted) {
      setState(() {
        _profile = profile;
        _isLoading = false;
      });
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Abmelden'),
        content: const Text('Wirklich abmelden?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Abbrechen'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Abmelden'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _service.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil'),
        actions: [
          if (_profile != null)
            TextButton(
              onPressed: _showEditProfile,
              child: const Text('Bearbeiten',
                  style: TextStyle(color: AppColors.primary)),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                _buildHeader(theme),
                const SizedBox(height: 8),
                if (_profile?.favoriteGames.isNotEmpty == true)
                  _buildFavoriteGames(theme),
                const SizedBox(height: 8),
                _buildSettingsSection(theme),
                const SizedBox(height: 8),
                _buildDangerSection(theme),
                const SizedBox(height: 40),
              ],
            ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      color: theme.cardColor,
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Stack(
            children: [
              CircleAvatar(
                radius: 50,
                backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                backgroundImage: _profile?.avatarUrl != null
                    ? NetworkImage(_profile!.avatarUrl!)
                    : null,
                child: _profile?.avatarUrl == null
                    ? Text(
                        (_profile?.username ?? 'A')
                            .substring(0, 1)
                            .toUpperCase(),
                        style: const TextStyle(
                            fontSize: 40,
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700),
                      )
                    : null,
              ),
              Positioned(
                right: 0,
                bottom: 0,
                child: GestureDetector(
                  onTap: _showEditProfile,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt,
                        size: 16, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _profile?.username ?? 'Unbekannt',
            style: theme.textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (_profile?.bio != null && _profile!.bio!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              _profile!.bio!,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
          ],
          if (_profile?.location != null) ...[
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
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
          const SizedBox(height: 12),
          Text(
            _service.getCurrentUser()?.email ?? '',
            style:
                theme.textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildFavoriteGames(ThemeData theme) {
    return Container(
      color: theme.cardColor,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Lieblingsspiele',
              style: theme.textTheme.labelMedium
                  ?.copyWith(color: AppColors.textMuted, letterSpacing: 0.5)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _profile!.favoriteGames.map((game) {
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Text(game,
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600)),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(ThemeData theme) {
    return Container(
      color: theme.cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text('Einstellungen',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: AppColors.textMuted, letterSpacing: 0.5)),
          ),
          SwitchListTile(
            title: const Text('Dark Mode'),
            subtitle: const Text('Dunkles Design aktivieren'),
            secondary: const Icon(Icons.dark_mode_outlined),
            value: _isDarkMode,
            onChanged: (v) => setState(() => _isDarkMode = v),
            activeThumbColor: AppColors.primary,
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Benachrichtigungen'),
            subtitle: const Text('Push-Benachrichtigungen verwalten'),
            trailing: const Icon(Icons.chevron_right,
                color: AppColors.textMuted),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Datenschutz'),
            trailing: const Icon(Icons.chevron_right,
                color: AppColors.textMuted),
            onTap: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildDangerSection(ThemeData theme) {
    return Container(
      color: theme.cardColor,
      child: Column(
        children: [
          ListTile(
            leading:
                const Icon(Icons.logout, color: AppColors.error),
            title: const Text('Abmelden',
                style: TextStyle(color: AppColors.error)),
            onTap: _logout,
          ),
        ],
      ),
    );
  }

  void _showEditProfile() {
    if (_profile == null) return;

    final usernameCtrl =
        TextEditingController(text: _profile!.username);
    final bioCtrl = TextEditingController(text: _profile!.bio ?? '');
    final locationCtrl =
        TextEditingController(text: _profile!.location ?? '');
    final selectedGames =
        List<String>.from(_profile!.favoriteGames);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Profil bearbeiten',
                    style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                TextField(
                  controller: usernameCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Benutzername'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bioCtrl,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(labelText: 'Bio'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: locationCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Stadtteil / Ort'),
                ),
                const SizedBox(height: 16),
                Text('Lieblingsspiele',
                    style: Theme.of(ctx).textTheme.labelMedium?.copyWith(
                        color: AppColors.textMuted)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: AppConstants.gameTypes.map((game) {
                    final sel = selectedGames.contains(game);
                    return FilterChip(
                      label: Text(game),
                      selected: sel,
                      onSelected: (_) => setSheetState(() {
                        if (sel) {
                          selectedGames.remove(game);
                        } else {
                          selectedGames.add(game);
                        }
                      }),
                      selectedColor: AppColors.primary.withValues(alpha: 0.15),
                      checkmarkColor: AppColors.primary,
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final userId = _service.getCurrentUser()?.id;
                      if (userId == null) return;
                      Navigator.pop(ctx);
                      await _service.updateProfile(userId, {
                        'username': usernameCtrl.text.trim(),
                        'bio': bioCtrl.text.trim(),
                        'location': locationCtrl.text.trim(),
                        'favorite_games': selectedGames,
                      });
                      _loadProfile();
                    },
                    child: const Text('Speichern'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
