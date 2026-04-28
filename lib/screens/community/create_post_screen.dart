import 'package:flutter/material.dart';
import '../../models/bar.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import '../../utils/constants.dart';

class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({super.key});

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final _service = SupabaseService();
  final _contentCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String _type = AppConstants.postTypeLooking;
  String? _selectedGame;
  Bar? _selectedBar;
  int _playerCount = 2;
  Duration? _duration;
  List<Bar> _bars = [];
  bool _isLoading = false;
  bool _loadingBars = true;

  final _durations = {
    null: 'Kein Ablauf',
    const Duration(hours: 1): '1 Stunde',
    const Duration(hours: 2): '2 Stunden',
    const Duration(hours: 4): '4 Stunden',
  };

  @override
  void initState() {
    super.initState();
    _loadBars();
  }

  Future<void> _loadBars() async {
    final bars = await _service.getAllBars();
    if (mounted) {
      setState(() {
        _bars = bars;
        _loadingBars = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await _service.createPost(
        type: _type,
        gameType: _selectedGame,
        barId: _selectedBar?.id,
        content: _contentCtrl.text.trim(),
        playerCount: _playerCount,
        duration: _duration,
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Fehler: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _contentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post erstellen'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _submit,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.primary))
                : const Text('Posten',
                    style: TextStyle(
                        color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSection(theme, 'Ich...', _buildTypeSelector(theme)),
            const SizedBox(height: 20),
            _buildSection(theme, 'Spiel', _buildGameSelector(theme)),
            const SizedBox(height: 20),
            _buildSection(theme, 'Bar', _buildBarSelector(theme)),
            const SizedBox(height: 20),
            _buildSection(theme, 'Spieler', _buildPlayerCount(theme)),
            const SizedBox(height: 20),
            _buildSection(theme, 'Gültig bis', _buildDurationSelector(theme)),
            const SizedBox(height: 20),
            _buildSection(theme, 'Nachricht', _buildContentField()),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(ThemeData theme, String title, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: theme.textTheme.labelLarge
                ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textMuted)),
        const SizedBox(height: 10),
        child,
      ],
    );
  }

  Widget _buildTypeSelector(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: _typeChip(
            theme,
            label: 'Suche Gegner',
            value: AppConstants.postTypeLooking,
            icon: Icons.search,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _typeChip(
            theme,
            label: 'Spiele gerade',
            value: AppConstants.postTypePlaying,
            icon: Icons.sports_score,
            color: AppColors.success,
          ),
        ),
      ],
    );
  }

  Widget _typeChip(ThemeData theme,
      {required String label,
      required String value,
      required IconData icon,
      required Color color}) {
    final isSelected = _type == value;
    return GestureDetector(
      onTap: () => setState(() => _type = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.12) : theme.cardColor,
          border: Border.all(
            color: isSelected ? color : Colors.transparent,
            width: 2,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: isSelected ? color : AppColors.textMuted, size: 24),
            const SizedBox(height: 4),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: isSelected ? color : AppColors.textMuted,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGameSelector(ThemeData theme) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: AppConstants.gameTypes.map((game) {
        final isSelected = _selectedGame == game;
        return FilterChip(
          label: Text(game),
          selected: isSelected,
          onSelected: (_) =>
              setState(() => _selectedGame = isSelected ? null : game),
          selectedColor: AppColors.primary.withValues(alpha: 0.15),
          checkmarkColor: AppColors.primary,
          labelStyle: TextStyle(
            color: isSelected ? AppColors.primary : null,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBarSelector(ThemeData theme) {
    if (_loadingBars) {
      return const Center(child: CircularProgressIndicator());
    }
    return Card(
      child: ListTile(
        leading: const Icon(Icons.sports_bar, color: AppColors.primary),
        title: Text(_selectedBar?.name ?? 'Keine Bar ausgewählt'),
        subtitle: _selectedBar != null
            ? Text(_selectedBar!.address,
                style: const TextStyle(color: AppColors.textMuted))
            : null,
        trailing: const Icon(Icons.chevron_right),
        onTap: _showBarPicker,
      ),
    );
  }

  void _showBarPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (_, scrollCtrl) => Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('Bar auswählen',
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.clear, color: AppColors.error),
              title: const Text('Keine Bar'),
              onTap: () {
                setState(() => _selectedBar = null);
                Navigator.pop(ctx);
              },
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                controller: scrollCtrl,
                itemCount: _bars.length,
                itemBuilder: (_, i) => ListTile(
                  leading: const Icon(Icons.sports_bar, color: AppColors.primary),
                  title: Text(_bars[i].name),
                  subtitle: Text(_bars[i].address),
                  selected: _selectedBar?.id == _bars[i].id,
                  selectedColor: AppColors.primary,
                  onTap: () {
                    setState(() => _selectedBar = _bars[i]);
                    Navigator.pop(ctx);
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayerCount(ThemeData theme) {
    return Row(
      children: [
        IconButton(
          onPressed: _playerCount > 1
              ? () => setState(() => _playerCount--)
              : null,
          icon: const Icon(Icons.remove_circle_outline),
          color: AppColors.primary,
        ),
        Expanded(
          child: Text(
            '$_playerCount Spieler',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        IconButton(
          onPressed: _playerCount < 10
              ? () => setState(() => _playerCount++)
              : null,
          icon: const Icon(Icons.add_circle_outline),
          color: AppColors.primary,
        ),
      ],
    );
  }

  Widget _buildDurationSelector(ThemeData theme) {
    return Wrap(
      spacing: 8,
      children: _durations.entries.map((e) {
        final isSelected = _duration == e.key;
        return ChoiceChip(
          label: Text(e.value),
          selected: isSelected,
          onSelected: (_) => setState(() => _duration = e.key),
          selectedColor: AppColors.primary.withValues(alpha: 0.15),
          labelStyle: TextStyle(
            color: isSelected ? AppColors.primary : null,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        );
      }).toList(),
    );
  }

  Widget _buildContentField() {
    return TextFormField(
      controller: _contentCtrl,
      maxLines: 4,
      maxLength: 300,
      decoration: const InputDecoration(
        hintText: 'Beschreibe deine Situation... (z.B. "Suche jemanden für 501 im Pub!")' ,
        labelText: 'Nachricht',
      ),
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Nachricht erforderlich';
        return null;
      },
    );
  }
}
