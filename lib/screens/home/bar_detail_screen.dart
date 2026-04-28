import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/bar.dart';
import '../../models/review.dart';
import '../../services/supabase_service.dart';
import '../../utils/colors.dart';
import 'package:timeago/timeago.dart' as timeago;

class BarDetailScreen extends StatefulWidget {
  final String barId;
  const BarDetailScreen({super.key, required this.barId});

  @override
  State<BarDetailScreen> createState() => _BarDetailScreenState();
}

class _BarDetailScreenState extends State<BarDetailScreen>
    with SingleTickerProviderStateMixin {
  final _service = SupabaseService();
  Bar? _bar;
  List<Review> _reviews = [];
  bool _isLoading = true;
  bool _isCheckedIn = false;
  bool _checkingIn = false;
  int _presenceCount = 0;
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    final bar = await _service.getBarDetails(widget.barId);
    final reviews = await _service.getBarReviews(widget.barId);
    final isCheckedIn = await _service.isCheckedIn(widget.barId);
    final presence = await _service.getPresenceAtBar(widget.barId);
    if (mounted) {
      setState(() {
        _bar = bar;
        _reviews = reviews;
        _isCheckedIn = isCheckedIn;
        _presenceCount = presence;
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleCheckIn() async {
    if (_bar == null) return;
    setState(() => _checkingIn = true);
    try {
      if (_isCheckedIn) {
        await _service.removePresence(widget.barId);
        setState(() {
          _isCheckedIn = false;
          _presenceCount = (_presenceCount - 1).clamp(0, 999);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Check-out erfolgreich')),
          );
        }
      } else {
        await _service.addPresence(widget.barId);
        setState(() {
          _isCheckedIn = true;
          _presenceCount++;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Du bist jetzt in ${_bar!.name}!'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Fehler beim Check-in'),
              backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
          body: Center(child: CircularProgressIndicator()));
    }
    if (_bar == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Bar nicht gefunden')),
        body: const Center(child: Text('Diese Bar existiert nicht mehr.')),
      );
    }

    final theme = Theme.of(context);
    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [_buildAppBar(theme)],
        body: Column(
          children: [
            _buildPresenceBar(theme),
            TabBar(
              controller: _tabCtrl,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textMuted,
              indicatorColor: AppColors.primary,
              tabs: const [
                Tab(text: 'Info'),
                Tab(text: 'Spiele'),
                Tab(text: 'Bewertungen'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildInfoTab(theme),
                  _buildGamesTab(theme),
                  _buildReviewsTab(theme),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _checkingIn ? null : _toggleCheckIn,
        backgroundColor: _isCheckedIn ? AppColors.success : AppColors.primary,
        icon: _checkingIn
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : Icon(_isCheckedIn ? Icons.check_circle : Icons.location_on),
        label: Text(_isCheckedIn ? 'Ich bin da!' : 'Check-in'),
      ),
    );
  }

  SliverAppBar _buildAppBar(ThemeData theme) {
    return SliverAppBar(
      expandedHeight: 260,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          _bar!.name,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            shadows: [Shadow(blurRadius: 8, color: Colors.black54)],
          ),
        ),
        background: _bar!.imageUrl != null
            ? CachedNetworkImage(
                imageUrl: _bar!.imageUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppColors.darkCard),
                errorWidget: (_, __, ___) =>
                    Container(color: AppColors.primary.withValues(alpha: 0.2)),
              )
            : Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.primary,
                      AppColors.primary.withValues(alpha: 0.7),
                    ],
                  ),
                ),
                child: const Center(
                  child: Icon(Icons.sports_bar, size: 80, color: Colors.white),
                ),
              ),
        collapseMode: CollapseMode.parallax,
      ),
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      actions: [
        IconButton(
          icon: const Icon(Icons.share_outlined),
          onPressed: () {},
        ),
      ],
    );
  }

  Widget _buildPresenceBar(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: theme.cardColor,
      child: Row(
        children: [
          _buildStat(theme, _bar!.ratingText, 'Rating',
              icon: Icons.star_rounded, iconColor: AppColors.warning),
          _buildDivider(),
          _buildStat(theme, '${_bar!.reviewCount}', 'Bewertungen',
              icon: Icons.rate_review_outlined),
          _buildDivider(),
          _buildStat(theme, '$_presenceCount', 'Vor Ort',
              icon: Icons.people_outline,
              iconColor: _presenceCount > 0 ? AppColors.success : null),
        ],
      ),
    );
  }

  Widget _buildStat(ThemeData theme, String value, String label,
      {IconData? icon, Color? iconColor}) {
    return Expanded(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: iconColor ?? AppColors.textMuted),
            const SizedBox(width: 6),
          ],
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(value,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              Text(label,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppColors.textMuted)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1, height: 36, color: AppColors.divider.withValues(alpha: 0.5));
  }

  Widget _buildInfoTab(ThemeData theme) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_bar!.description.isNotEmpty) ...[
          Text('Beschreibung',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(_bar!.description, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 20),
        ],
        _buildInfoCard(theme, [
          _infoRow(Icons.location_on_outlined, _bar!.address),
          if (_bar!.phone != null) _infoRow(Icons.phone_outlined, _bar!.phone!),
          if (_bar!.website != null)
            _infoRow(Icons.language_outlined, _bar!.website!),
          if (_bar!.beerPrice != null)
            _infoRow(Icons.local_drink_outlined,
                'Bier ab ${_bar!.beerPrice!.toStringAsFixed(2)} €'),
          if (_bar!.capacity != null)
            _infoRow(Icons.people_outline, 'Kapazität: ${_bar!.capacity} Personen'),
        ]),
        if (_bar!.openingHours.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('Öffnungszeiten',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          _buildOpeningHours(theme),
        ],
      ],
    );
  }

  Widget _buildInfoCard(ThemeData theme, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: children
              .map((w) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: w,
                  ))
              .toList(),
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Text(text),
        ),
      ],
    );
  }

  Widget _buildOpeningHours(ThemeData theme) {
    const dayNames = {
      'monday': 'Montag',
      'tuesday': 'Dienstag',
      'wednesday': 'Mittwoch',
      'thursday': 'Donnerstag',
      'friday': 'Freitag',
      'saturday': 'Samstag',
      'sunday': 'Sonntag',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: dayNames.entries.map((entry) {
            final hours = _bar!.openingHours[entry.key] ?? 'Geschlossen';
            final isToday = entry.key ==
                ['monday', 'tuesday', 'wednesday', 'thursday', 'friday',
                    'saturday', 'sunday'][DateTime.now().weekday - 1];
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(
                    width: 100,
                    child: Text(
                      entry.value,
                      style: TextStyle(
                        fontWeight: isToday
                            ? FontWeight.w700
                            : FontWeight.normal,
                        color: isToday ? AppColors.primary : null,
                      ),
                    ),
                  ),
                  Text(
                    hours,
                    style: TextStyle(
                      color: isToday ? AppColors.primary : AppColors.textMuted,
                      fontWeight: isToday ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildGamesTab(ThemeData theme) {
    if (_bar!.games.isEmpty) {
      return const Center(child: Text('Keine Spiele eingetragen.'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Verfügbare Spiele',
            style: theme.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        ..._bar!.games.map((game) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.sports_score,
                      color: AppColors.primary),
                ),
                title: Text(game,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
            )),
      ],
    );
  }

  Widget _buildReviewsTab(ThemeData theme) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_reviews.length} Bewertungen',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
              TextButton.icon(
                onPressed: _showAddReview,
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Bewerten'),
                style: TextButton.styleFrom(foregroundColor: AppColors.primary),
              ),
            ],
          ),
        ),
        Expanded(
          child: _reviews.isEmpty
              ? const Center(child: Text('Noch keine Bewertungen.'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _reviews.length,
                  itemBuilder: (_, i) => _buildReviewCard(_reviews[i], theme),
                ),
        ),
      ],
    );
  }

  Widget _buildReviewCard(Review review, ThemeData theme) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                  child: Text(
                    (review.username ?? 'A').substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                        color: AppColors.primary, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(review.username ?? 'Anonym',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                        timeago.format(review.createdAt, locale: 'de'),
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
                Row(
                  children: List.generate(5, (i) {
                    return Icon(
                      i < review.rating.round()
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      size: 16,
                      color: AppColors.warning,
                    );
                  }),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(review.content, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }

  void _showAddReview() {
    double rating = 4;
    final ctrl = TextEditingController();

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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${_bar!.name} bewerten',
                  style: Theme.of(ctx)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  return IconButton(
                    icon: Icon(
                      i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
                      color: AppColors.warning,
                      size: 36,
                    ),
                    onPressed: () => setSheetState(() => rating = i + 1.0),
                    padding: EdgeInsets.zero,
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Deine Bewertung...',
                  labelText: 'Kommentar',
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (ctrl.text.isEmpty) return;
                    Navigator.pop(ctx);
                    await _service.addReview(
                      barId: widget.barId,
                      rating: rating,
                      content: ctrl.text,
                    );
                    _loadData();
                  },
                  child: const Text('Bewertung absenden'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }
}
