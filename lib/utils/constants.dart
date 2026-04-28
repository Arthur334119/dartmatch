class AppConstants {
  static const String appName = 'DartMatch';
  static const String appTagline = 'Finde dein Dart-Match in Berlin';

  // Game types
  static const List<String> gameTypes = [
    'Cricket',
    '501',
    '301',
    'Around the Clock',
    'Killer',
    'Shanghai',
    'Baseball',
    'Halve-It',
    'Freierfür alle',
  ];

  // Post types
  static const String postTypePlaying = 'playing';
  static const String postTypeLooking = 'looking';

  // Berlin center
  static const double berlinLat = 52.5200;
  static const double berlinLng = 13.4050;

  // Map settings
  static const double defaultZoom = 13.0;
  static const double maxZoom = 18.0;
  static const double minZoom = 10.0;
  static const double nearbyRadiusKm = 5.0;

  // Pagination
  static const int postsPageSize = 20;
  static const int barsPageSize = 50;

  // Cache
  static const Duration cacheExpiry = Duration(minutes: 5);

  // Presence
  static const Duration presenceTimeout = Duration(hours: 4);
}
