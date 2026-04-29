export const APP_NAME = 'Kneipenfinder';
export const APP_TAGLINE = 'Finde deine Kneipe in Berlin';

// Spielangebot einer Kneipe (Filter + Detail)
export const BAR_GAME_LABELS: Record<string, string> = {
  dart: 'Dart',
  billard: 'Billard',
  snooker: 'Snooker',
  kicker: 'Kicker',
  flipper: 'Flipper',
  karten: 'Karten',
  spielautomat: 'Spielautomat',
  bowling: 'Bowling',
  minigolf: 'Minigolf',
  karaoke: 'Karaoke',
  tischtennis: 'Tischtennis',
};

export const BAR_GAMES = Object.keys(BAR_GAME_LABELS);

// Kneipen-Eigenschaften (Filter + Detail)
export const BAR_FEATURE_LABELS: Record<string, string> = {
  smoking: 'Raucherbereich',
  outdoor: 'Außenbereich',
  dog_friendly: 'Hundefreundlich',
  live_sport: 'Live-Sport',
  food: 'Warme Küche',
  vegan: 'Vegan',
  wheelchair: 'Rollstuhlgerecht',
  cash_only: 'Nur Bar',
  late_night: '24h / lang offen',
};

export const BAR_FEATURES = Object.keys(BAR_FEATURE_LABELS);

// Dart-Spielmodi (Posts: "Wer spielt 501?")
export const DART_GAME_TYPES = [
  'Cricket',
  '501',
  '301',
  'Around the Clock',
  'Killer',
  'Shanghai',
  'Baseball',
  'Halve-It',
  'Freier für alle',
];

export const POST_TYPE_PLAYING = 'playing';
export const POST_TYPE_LOOKING = 'looking';

export const BERLIN_LAT = 52.52;
export const BERLIN_LNG = 13.405;

export const DEFAULT_ZOOM_DELTA = 0.05; // ~ Berlin city zoom
export const NEARBY_RADIUS_KM = 5.0;

export const PRESENCE_TIMEOUT_HOURS = 4;

export const DAY_NAMES_DE: Record<string, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
