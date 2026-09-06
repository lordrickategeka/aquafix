import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/payments_controller.dart';
import '../models/account.dart';
import '../theme.dart';
import 'format.dart';
import 'record_payment_screen.dart';

/// Find an account, see what it owes, take money against it. The list is
/// ordered by balance because whoever owes the most is usually who the cashier
/// is looking for.
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Load once the first frame is up, so the list is there by the time
    // somebody has walked to the counter.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<PaymentsController>().load();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final payments = context.watch<PaymentsController>();

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onChanged: payments.setSearch,
            onSubmitted: (value) => payments.load(query: value),
            decoration: InputDecoration(
              hintText: 'Name, account, meter or phone',
              prefixIcon: const Icon(Icons.search, size: 20, color: Kuwe.muted),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              suffixIcon: payments.search.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _search.clear();
                        payments.setSearch('');
                        payments.load();
                      },
                    ),
            ),
          ),
        ),
        if (payments.error != null)
          Material(
            color: Kuwe.badBg,
            child: InkWell(
              onTap: payments.clearError,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        payments.error!,
                        style: const TextStyle(fontSize: 12.5, color: Kuwe.badFg),
                      ),
                    ),
                    const Icon(Icons.close, size: 16, color: Kuwe.badFg),
                  ],
                ),
              ),
            ),
          ),
        Expanded(
          child: payments.loading && payments.accounts.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : payments.accounts.isEmpty
                  ? const _Empty()
                  : RefreshIndicator(
                      color: Kuwe.brand600,
                      onRefresh: () => payments.load(
                        query: payments.search.isEmpty ? null : payments.search,
                      ),
                      child: ListView.separated(
                        padding: const EdgeInsets.only(bottom: 24),
                        itemCount: payments.accounts.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 1, color: Kuwe.lineSoft),
                        itemBuilder: (context, index) =>
                            _AccountRow(account: payments.accounts[index]),
                      ),
                    ),
        ),
      ],
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({required this.account});

  final Account account;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => RecordPaymentScreen(account: account)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: Kuwe.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        account.accountNo,
                        if (account.zoneName != null) account.zoneName,
                        if (account.phone != null) account.phone,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: Kuwe.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    account.owes
                        ? ugx(account.balance)
                        : account.inCredit > 0
                            ? ugx(account.inCredit)
                            : 'Clear',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: account.owes ? Kuwe.badFg : Kuwe.okFg,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    account.owes
                        ? 'owing'
                        : account.inCredit > 0
                            ? 'in credit'
                            : 'nothing due',
                    style: const TextStyle(fontSize: 11, color: Kuwe.muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.person_search, size: 38, color: Kuwe.muted),
              SizedBox(height: 14),
              Text(
                'No accounts found',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Kuwe.ink),
              ),
              SizedBox(height: 6),
              Text(
                'Search by name, account number, meter or phone.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Kuwe.mutedDeep),
              ),
            ],
          ),
        ),
      );
}
