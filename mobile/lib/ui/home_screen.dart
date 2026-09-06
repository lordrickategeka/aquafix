import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/round_controller.dart';
import '../logic/session_controller.dart';
import '../theme.dart';
import 'format.dart';
import 'payments_screen.dart';
import 'round_screen.dart';
import 'widgets/server_dialog.dart';

/// The app's one piece of chrome. Which tabs exist comes from the permissions
/// the server sent at sign-in, not from a setting: a meter reader never sees a
/// payments tab they would be refused at, and a cashier never sees a round.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

enum _Tab { round, payments }

class _HomeScreenState extends State<HomeScreen> {
  late _Tab _tab;

  @override
  void initState() {
    super.initState();
    final session = context.read<SessionController>().session;
    _tab = (session?.canCaptureReadings ?? false) ? _Tab.round : _Tab.payments;
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

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final round = context.watch<RoundController>();

    final canRead = session.session?.canCaptureReadings ?? false;
    final canPay = session.session?.canRecordPayments ?? false;
    final bothTabs = canRead && canPay;

    // A person with only one of the two never lands on the other, even if a
    // stale tab index survives a permission change.
    final tab = !canRead ? _Tab.payments : (!canPay ? _Tab.round : _tab);
    final onRound = tab == _Tab.round;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              onRound
                  ? (round.cycle == null ? 'No round' : periodLabel(round.cycle!.period))
                  : 'Payments',
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

      // IndexedStack rather than a swap, so a half-typed search or a scroll
      // position survives a trip to the other tab.
      body: IndexedStack(
        index: onRound ? 0 : 1,
        children: [
          canRead ? const RoundBody() : const SizedBox.shrink(),
          canPay ? const PaymentsScreen() : const SizedBox.shrink(),
        ],
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

      bottomNavigationBar: bothTabs
          ? NavigationBar(
              height: 62,
              backgroundColor: Colors.white,
              indicatorColor: Kuwe.brand100,
              selectedIndex: onRound ? 0 : 1,
              onDestinationSelected: (index) =>
                  setState(() => _tab = index == 0 ? _Tab.round : _Tab.payments),
              destinations: [
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible: round.pendingCount > 0,
                    label: Text('${round.pendingCount}'),
                    child: const Icon(Icons.speed_outlined),
                  ),
                  selectedIcon: const Icon(Icons.speed, color: Kuwe.brand700),
                  label: 'Readings',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.payments_outlined),
                  selectedIcon: Icon(Icons.payments, color: Kuwe.brand700),
                  label: 'Payments',
                ),
              ],
            )
          : null,
    );
  }
}
