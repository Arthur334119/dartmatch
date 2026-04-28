import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/bar.dart';
import '../utils/colors.dart';

class BarCard extends StatelessWidget {
  final Bar bar;
  final VoidCallback? onTap;
  final bool compact;

  const BarCard({
    super.key,
    required this.bar,
    this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (compact) return _buildCompact(context, theme);
    return _buildFull(context, theme);
  }

  Widget _buildFull(BuildContext context, ThemeData theme) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildImage(height: 160),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          bar.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _buildRating(theme),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          bar.address,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textMuted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (bar.distanceKm != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          bar.distanceText,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  _buildGameChips(theme),
                  if (bar.beerPrice != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.local_drink_outlined,
                            size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          'Bier ab ${bar.beerPrice!.toStringAsFixed(2)} €',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompact(BuildContext context, ThemeData theme) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                bottomLeft: Radius.circular(16),
              ),
              child: _buildImageWidget(width: 90, height: 90),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bar.name,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      bar.address,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: AppColors.textMuted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _buildRating(theme, small: true),
                        if (bar.distanceKm != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            bar.distanceText,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.chevron_right, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage({double height = 160}) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      child: _buildImageWidget(height: height),
    );
  }

  Widget _buildImageWidget({double? width, double? height}) {
    if (bar.imageUrl != null && bar.imageUrl!.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: bar.imageUrl!,
        width: width,
        height: height,
        fit: BoxFit.cover,
        placeholder: (_, __) => _placeholder(width: width, height: height),
        errorWidget: (_, __, ___) => _placeholder(width: width, height: height),
      );
    }
    return _placeholder(width: width, height: height);
  }

  Widget _placeholder({double? width, double? height}) {
    return Container(
      width: width,
      height: height,
      color: AppColors.primary.withValues(alpha: 0.1),
      child: const Center(
        child: Icon(Icons.sports_bar, size: 40, color: AppColors.primary),
      ),
    );
  }

  Widget _buildRating(ThemeData theme, {bool small = false}) {
    return Row(
      children: [
        Icon(Icons.star_rounded,
            size: small ? 14 : 16, color: AppColors.warning),
        const SizedBox(width: 2),
        Text(
          bar.ratingText,
          style: (small ? theme.textTheme.bodySmall : theme.textTheme.bodyMedium)
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(
          ' (${bar.reviewCount})',
          style: (small ? theme.textTheme.bodySmall : theme.textTheme.bodySmall)
              ?.copyWith(color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _buildGameChips(ThemeData theme) {
    if (bar.games.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: bar.games.take(3).map((game) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            game,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        );
      }).toList(),
    );
  }
}
