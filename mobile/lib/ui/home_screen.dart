import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/round_controller.dart';
import '../logic/session_controller.dart';
import '../theme.dart';
import 'format.dart';
import 'payments_screen.dart';
import 'register_screen.dart';
import 'round_screen.dart';
import 'widgets/server_dialog.dart';

/// The app's one piece of chrome. Which tabs exist comes from the permissions
/// the server sent at sign-in, not from a setting: a meter reader never sees a
/// payments tab they would be refused at, and somebody without
/// register-consumers never sees the registration form.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

enum _Tab { round, payments, register }

class _HomeScreenState extends State<HomeScreen> {
  /// What the person last chose. Only ever honoured if they still hold the
  /// permission for it — see [_visibleTabs].
  _Tab? _chosen;

  /// In the order they appear along the bottom. A tab is here only if the
  /// server said this account may use it, so there is no separate check
  /// anywhere else in this file.
  List<_Tab> _visibleTabs(SessionController session) {
    final s = session.session;
    return [
      if (s?.canCaptureReadings ?? false) _Tab.round,
      if (s?.canRecordPayments ?? false) _Tab.payments,
      if (s?.canRegisterConsumers ?? false) _Tab.register,
    ];
  }

  Future<void> _confirmLogout() async {
    final round = context.read<RoundController>();
    final pending = round.pendingCount;

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Sign out?', style: TextStyle(fontSize: 17)),
        content: Text(
          pending > 0
              // Worth being blunt about: this is a whole morning's walk.
              ? '$pending ${pending == 1 ? 'reading has' : 'readings have'} not been '
                  'sent yet. Signing out deletes them from this phone.'
              : 'Anything saved on this phone will be removed.',
          style: const TextStyle(fontSize: 14, color: Kuwe.mutedDeep),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size(88, 42),
              backgroundColor: pending > 0 ? Kuwe.badFg : Kuwe.brand600,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (ok == true && mounted) await context.read<SessionController>().logout();
  }

  String _title(_Tab tab, RoundController round) => switch (tab) {
        _Tab.round => round.cycle == null ? 'No round' : periodLabel(round.cycle!.period),
        _Tab.payments => 'Payments',
        _Tab.register => 'New connection',
      };

  Widget _body(_Tab tab) => switch (tab) {
        _Tab.round => const RoundBody(),
        _Tab.payments => const PaymentsScreen(),
        _Tab.register => const RegisterScreen(),
      };

  NavigationDestination _destination(_Tab tab, RoundController round) => switch (tab) {
        _Tab.round => NavigationDestination(
            icon: Badge(
              isLabelVisible: round.pendingCount > 0,
              label: Text('${round.pendingCount}'),
              child: const Icon(Icons.speed_outlined),
            ),
            selectedIcon: const Icon(Icons.speed, color: Kuwe.brand700),
            label: 'Readings',
          ),
        _Tab.payments => const NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            selectedIcon: Icon(Icons.payments, color: Kuwe.brand700),
            label: 'Payments',
          ),
        _Tab.register => const NavigationDestination(
            icon: Icon(Icons.person_add_alt_outlined),
            selectedIcon: Icon(Icons.person_add_alt_1, color: Kuwe.brand700),
            label: 'Register',
          ),
      };

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final round = context.watch<RoundController>();

    final tabs = _visibleTabs(session);
    if (tabs.isEmpty) return const _NoTabs();

    // A permission taken away between sessions must not strand anyone on a tab
    // they can no longer use, so the remembered choice is only honoured while
    // it is still in the list.
    final tab = (_chosen != null && tabs.contains(_chosen)) ? _chosen! : tabs.first;
    final onRound = tab == _Tab.round;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _title(tab, round),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              session.session?.email ?? '',
              style: const TextStyle(fontSize: 11.5, color: Kuwe.muted),
            ),
          ],
        ),
        actions: [
          if (onRound)
            IconButton(
              tooltip: 'Download round',
              onPressed: round.loading ? null : () => round.download(),
              icon: round.loading
                  ? const SizedBox(
                      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.cloud_download_outlined),
            ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'server') showServerDialog(context);
              if (value == 'logout') _confirmLogout();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'server', child: Text('Office server')),
              PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),

      // IndexedStack rather than a swap, so a half-typed search, a scroll
      // position or a part-filled registration form survives a trip to another
      // tab.
      body: IndexedStack(
        index: tabs.indexOf(tab),
        children: [for (final each in tabs) _body(each)],
      ),

      floatingActionButton: onRound && round.pendingCount > 0
          ? FloatingActionButton.extended(
              backgroundColor: Kuwe.brand600,
              foregroundColor: Colors.white,
              onPressed: round.syncing ? null : () => round.sync(),
              icon: round.syncing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.cloud_upload_outlined),
              label: Text('Send ${round.pendingCount}'),
            )
          : null,

      bottomNavigationBar: tabs.length > 1
          ? NavigationBar(
              height: 62,
              backgroundColor: Colors.white,
              indicatorColor: Kuwe.brand100,
              selectedIndex: tabs.indexOf(tab),
              onDestinationSelected: (index) => setState(() => _chosen = tabs[index]),
              destinations: [for (final each in tabs) _destination(each, round)],
            )
          : null,
    );
  }
}

/// Only reachable if the office withdrew every field permission while somebody
/// was signed in. Sign-in itself refuses such an account outright.
class _NoTabs extends StatelessWidget {
  const _NoTabs();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 34, color: Kuwe.muted),
              const SizedBox(height: 14),
              const Text(
                'This account no longer has any field permissions. Ask the '
                'office to restore them.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: Kuwe.mutedDeep, height: 1.4),
              ),
              const SizedBox(height: 20),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size(160, 46)),
                onPressed: () => context.read<SessionController>().logout(),
                child: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
