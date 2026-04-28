import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'config/supabase_config.dart';
import 'config/theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/map_screen.dart';
import 'screens/community/community_feed_screen.dart';
import 'screens/chat/chat_list_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'services/supabase_service.dart';
import 'utils/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  timeago.setLocaleMessages('de', timeago.DeMessages());
  await Supabase.initialize(
    url: SupabaseConfig.supabaseUrl,
    anonKey: SupabaseConfig.supabaseAnonKey,
  );
  runApp(const DartMatchApp());
}

class DartMatchApp extends StatefulWidget {
  const DartMatchApp({super.key});

  @override
  State<DartMatchApp> createState() => _DartMatchAppState();
}

class _DartMatchAppState extends State<DartMatchApp> {
  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(() => setState(() {}));
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DartMatch',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: AppState.instance.themeMode,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return const LoginScreen();
    return const MainNavigationScreen();
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  final _service = SupabaseService();

  static const _screens = [
    MapScreen(),
    CommunityFeedScreen(),
    ChatListScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(() => setState(() {}));
    _pollUnread();
  }

  Future<void> _pollUnread() async {
    if (!mounted) return;
    final count = await _service.getUnreadCount();
    AppState.instance.setUnreadMessages(count);
    await Future.delayed(const Duration(seconds: 30));
    _pollUnread();
  }

  @override
  Widget build(BuildContext context) {
    final unread = AppState.instance.unreadMessages;
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) {
          setState(() => _currentIndex = i);
          if (i == 2) {
            AppState.instance.setUnreadMessages(0);
          }
        },
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.map_outlined),
            activeIcon: Icon(Icons.map),
            label: 'Karte',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.groups_outlined),
            activeIcon: Icon(Icons.groups),
            label: 'Community',
          ),
          BottomNavigationBarItem(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.chat_bubble_outline),
                if (unread > 0)
                  Positioned(
                    right: -6,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFF6B35),
                        shape: BoxShape.circle,
                      ),
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        unread > 9 ? '9+' : '$unread',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            activeIcon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.chat_bubble),
                if (unread > 0)
                  Positioned(
                    right: -6,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFF6B35),
                        shape: BoxShape.circle,
                      ),
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        unread > 9 ? '9+' : '$unread',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            label: 'Chat',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
