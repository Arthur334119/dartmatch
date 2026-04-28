import 'dart:convert';

class Bar {
  final String id;
  final String name;
  final String description;
  final String address;
  final double latitude;
  final double longitude;
  final String? phone;
  final String? website;
  final double? beerPrice;
  final int? capacity;
  final List<String> games;
  final Map<String, String> openingHours;
  final String? imageUrl;
  final double rating;
  final int reviewCount;
  final String? osmId;
  double? distanceKm;

  Bar({
    required this.id,
    required this.name,
    required this.description,
    required this.address,
    required this.latitude,
    required this.longitude,
    this.phone,
    this.website,
    this.beerPrice,
    this.capacity,
    required this.games,
    required this.openingHours,
    this.imageUrl,
    required this.rating,
    required this.reviewCount,
    this.osmId,
    this.distanceKm,
  });

  factory Bar.fromJson(Map<String, dynamic> json) {
    List<String> parseGames(dynamic raw) {
      if (raw == null) return [];
      if (raw is List) return raw.map((e) => e.toString()).toList();
      if (raw is String) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is List) return decoded.map((e) => e.toString()).toList();
        } catch (_) {}
      }
      return [];
    }

    Map<String, String> parseHours(dynamic raw) {
      if (raw == null) return {};
      if (raw is Map) {
        return raw.map((k, v) => MapEntry(k.toString(), v.toString()));
      }
      if (raw is String) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is Map) {
            return decoded.map((k, v) => MapEntry(k.toString(), v.toString()));
          }
        } catch (_) {}
      }
      return {};
    }

    return Bar(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 52.5200,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 13.4050,
      phone: json['phone']?.toString(),
      website: json['website']?.toString(),
      beerPrice: (json['beer_price'] as num?)?.toDouble(),
      capacity: (json['capacity'] as num?)?.toInt(),
      games: parseGames(json['games']),
      openingHours: parseHours(json['opening_hours']),
      imageUrl: json['image_url']?.toString(),
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: (json['review_count'] as num?)?.toInt() ?? 0,
      osmId: json['osm_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'phone': phone,
        'website': website,
        'beer_price': beerPrice,
        'capacity': capacity,
        'games': games,
        'opening_hours': openingHours,
        'image_url': imageUrl,
        'rating': rating,
        'review_count': reviewCount,
        'osm_id': osmId,
      };

  String get gamesText => games.join(', ');

  String get ratingText => rating.toStringAsFixed(1);

  String get distanceText {
    if (distanceKm == null) return '';
    if (distanceKm! < 1) return '${(distanceKm! * 1000).toInt()} m';
    return '${distanceKm!.toStringAsFixed(1)} km';
  }

  String? get todayHours {
    final days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ];
    final today = days[DateTime.now().weekday - 1];
    return openingHours[today];
  }
}
