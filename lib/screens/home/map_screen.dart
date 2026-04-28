import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/bar.dart';
import '../../services/supabase_service.dart';
import '../../services/location_service.dart';
import '../../utils/colors.dart';
import '../../utils/constants.dart';
import '../../widgets/bar_card.dart';
import 'bar_detail_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _service = SupabaseService();
  final _location = LocationService();
  final _mapController = MapController();

  List<Bar> _bars = [];
  List<Bar> _filteredBars = [];
  Position? _userPosition;
  bool _isLoading = true;
  String? _selectedGame;
  Bar? _selectedBar;

  final List<String> _gameFilters = ['Alle', ...AppConstants.gameTypes.take(6)];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _location.requestPermissions();
    final pos = await _location.getCurrentLocation();
    final bars = await _service.getAllBars();

    if (pos != null) {
      for (final bar in bars) {
        bar.distanceKm = _location.calculateDistance(
          pos.latitude, pos.longitude, bar.latitude, bar.longitude,
        );
      }
      bars.sort((a, b) => (a.distanceKm ?? 0).compareTo(b.distanceKm ?? 0));
    }

    if (mounted) {
      setState(() {
        _userPosition = pos;
        _bars = bars;
        _filteredBars = bars;
        _isLoading = false;
      });
      if (pos != null) {
        _mapController.move(
          LatLng(pos.latitude, pos.longitude),
          AppConstants.defaultZoom,
        );
      }
    }
  }

  void _applyFilter(String? game) {
    setState(() {
      _selectedGame = game == 'Alle' ? null : game;
      _filteredBars = _selectedGame == null
          ? _bars
          : _bars.where((b) => b.games.contains(_selectedGame)).toList();
    });
  }

  void _openBarDetail(Bar bar) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => BarDetailScreen(barId: bar.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Stack(
        children: [
          _buildMap(),
          if (_isLoading)
            const Center(child: CircularProgressIndicator()),
          Positioned(
            top: MediaQuery.of(context).padding.top + 12,
            left: 16,
            right: 16,
            child: _buildSearchBar(theme),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildBottomSheet(theme),
          ),
        ],
      ),
      floatingActionButton: _buildFilterFAB(theme),
      floatingActionButtonLocation: FloatingActionButtonLocation.endContained,
    );
  }

  Widget _buildMap() {
    final center = _userPosition != null
        ? LatLng(_userPosition!.latitude, _userPosition!.longitude)
        : const LatLng(AppConstants.berlinLat, AppConstants.berlinLng);

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: center,
        initialZoom: AppConstants.defaultZoom,
        maxZoom: AppConstants.maxZoom,
        minZoom: AppConstants.minZoom,
        onTap: (_, __) => setState(() => _selectedBar = null),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.dartmatch.app',
        ),
        if (_userPosition != null)
          MarkerLayer(
            markers: [
              Marker(
                point: LatLng(_userPosition!.latitude, _userPosition!.longitude),
                width: 24,
                height: 24,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.secondary,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.secondary.withValues(alpha: 0.4),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        MarkerLayer(
          markers: _filteredBars.map((bar) => _buildMarker(bar)).toList(),
        ),
      ],
    );
  }

  Marker _buildMarker(Bar bar) {
    final isSelected = _selectedBar?.id == bar.id;
    return Marker(
      point: LatLng(bar.latitude, bar.longitude),
      width: isSelected ? 44 : 36,
      height: isSelected ? 44 : 36,
      child: GestureDetector(
        onTap: () {
          setState(() => _selectedBar = bar);
          _mapController.move(
            LatLng(bar.latitude - 0.002, bar.longitude),
            14,
          );
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : AppColors.primary.withValues(alpha: 0.85),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: isSelected ? 3 : 2),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.4),
                blurRadius: isSelected ? 12 : 6,
              ),
            ],
          ),
          child: const Icon(Icons.sports_bar, color: Colors.white, size: 18),
        ),
      ),
    );
  }

  Widget _buildSearchBar(ThemeData theme) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Text(
            'Bars in Berlin suchen...',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textMuted,
            ),
          ),
          const Spacer(),
          if (_userPosition != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                icon: const Icon(Icons.my_location,
                    color: AppColors.primary, size: 20),
                onPressed: () => _mapController.move(
                  LatLng(_userPosition!.latitude, _userPosition!.longitude),
                  AppConstants.defaultZoom,
                ),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBottomSheet(ThemeData theme) {
    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.textMuted.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),
          if (_selectedBar != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ausgewählt',
                      style: theme.textTheme.labelSmall
                          ?.copyWith(color: AppColors.textMuted)),
                  const SizedBox(height: 8),
                  BarCard(
                    bar: _selectedBar!,
                    compact: true,
                    onTap: () => _openBarDetail(_selectedBar!),
                  ),
                ],
              ),
            ),
            const Divider(height: 20),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _selectedGame == null
                      ? 'Top Bars in der Nähe'
                      : '$_selectedGame Bars',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${_filteredBars.length} gefunden',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 170,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _filteredBars.take(10).length,
              itemBuilder: (_, i) {
                final bar = _filteredBars[i];
                return SizedBox(
                  width: 240,
                  child: BarCard(
                    bar: bar,
                    compact: true,
                    onTap: () => _openBarDetail(bar),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildFilterFAB(ThemeData theme) {
    return FloatingActionButton.extended(
      onPressed: _showFilterSheet,
      icon: const Icon(Icons.tune),
      label: Text(_selectedGame ?? 'Filter'),
    );
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Nach Spiel filtern',
                style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    )),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _gameFilters.map((game) {
                final isSelected = (_selectedGame == null && game == 'Alle') ||
                    _selectedGame == game;
                return FilterChip(
                  label: Text(game),
                  selected: isSelected,
                  onSelected: (_) {
                    _applyFilter(game);
                    Navigator.pop(ctx);
                  },
                  selectedColor: AppColors.primary.withValues(alpha: 0.15),
                  checkmarkColor: AppColors.primary,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }
}
