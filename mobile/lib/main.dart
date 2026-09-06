import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/api_client.dart';
import 'data/kuwe_api.dart';
import 'data/local_db.dart';
import 'logic/payments_controller.dart';
import 'logic/round_controller.dart';
import 'logic/session_controller.dart';
import 'theme.dart';
import 'ui/login_screen.dart';
import 'ui/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final client = await ApiClient.create();
  final db = await LocalDb.open();
  final api = KuweApi(client);

  runApp(KuweMeterApp(api: api, db: db));
}

class KuweMeterApp extends StatelessWidget {
  const KuweMeterApp({super.key, required this.api, required this.db});

  final KuweApi api;
  final LocalDb db;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SessionController(api: api, db: db)..restore(),
        ),
        ChangeNotifierProvider(
          create: (_) => RoundController(api: api, db: db)..loadFromCache(),
        ),
        ChangeNotifierProvider(create: (_) => PaymentsController(api: api)),
      ],
      child: MaterialApp(
        title: 'Kuwe Meter',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _Gate(),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final status = context.watch<SessionController>().status;

    return switch (status) {
      SessionStatus.checking => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      SessionStatus.signedOut => const LoginScreen(),
      SessionStatus.signedIn => const HomeScreen(),
    };
  }
}
