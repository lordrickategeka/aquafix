import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/payments_controller.dart';
import '../models/account.dart';
import '../theme.dart';
import 'format.dart';
import 'widgets/keypad.dart';

/// Taking money against one account. The amount is typed in whole shillings on
/// the same pad as a meter reading; there are no cents anywhere in this system.
class RecordPaymentScreen extends StatefulWidget {
  const RecordPaymentScreen({super.key, required this.account});

  final Account account;

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  String _typed = '';
  PaymentChannel _channel = PaymentChannel.cash;
  final _reference = TextEditingController();

  @override
  void dispose() {
    _reference.dispose();
    super.dispose();
  }

  int? get _amount => _typed.isEmpty ? null : int.tryParse(_typed);

  void _press(String digit) {
    // Ten digits is a billion shillings — past any real payment and well past
    // what a mis-key should be able to commit.
    if (_typed.length >= 10) return;
    setState(() => _typed = (_typed + digit).replaceFirst(RegExp(r'^0+(?=\d)'), ''));
  }

  Future<void> _submit() async {
    final amount = _amount;
    if (amount == null || amount <= 0) return;

    final payments = context.read<PaymentsController>();
    final reference = _reference.text.trim();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Confirm payment', style: TextStyle(fontSize: 17)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${ugx(amount)} by ${_channel.label}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kuwe.ink),
            ),
            const SizedBox(height: 6),
            Text(
              'for ${widget.account.name} (${widget.account.accountNo})',
              style: const TextStyle(fontSize: 13, color: Kuwe.mutedDeep),
            ),
            const SizedBox(height: 10),
            // Said plainly, because this is the step that cannot be walked back
            // from the handset.
            const Text(
              'This is recorded immediately and cannot be undone from this phone.',
              style: TextStyle(fontSize: 12, color: Kuwe.muted),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Back')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 42)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Record'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final receipt = await payments.record(
      account: widget.account,
      amount: amount,
      channel: _channel,
      reference: reference.isEmpty ? null : reference,
    );

    if (!mounted) return;
    if (receipt == null) {
      // The controller holds the reason; the banner on the list explains it.
      Navigator.pop(context);
      return;
    }

    await Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => _ReceiptScreen(receipt: receipt)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final payments = context.watch<PaymentsController>();
    final amount = _amount;
    final account = widget.account;
    final remaining = amount == null ? null : account.balance - amount;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(account.name,
                style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
            Text(
              '${account.accountNo} · owes ${ugx(account.balance)}',
              style: const TextStyle(fontSize: 11.5, color: Kuwe.muted),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  amount == null ? '—' : ugx(amount),
                  style: const TextStyle(
                    fontSize: 38,
                    fontWeight: FontWeight.w700,
                    color: Kuwe.ink,
                  ),
                ),
                const SizedBox(height: 8),
                if (remaining != null)
                  Text(
                    remaining > 0
                        ? 'Leaves ${ugx(remaining)} owing'
                        : remaining == 0
                            ? 'Clears the account'
                            : 'Leaves ${ugx(-remaining)} in credit',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: remaining > 0 ? Kuwe.warnFg : Kuwe.okFg,
                    ),
                  )
                else
                  const Text(
                    'Type the amount received',
                    style: TextStyle(fontSize: 13, color: Kuwe.muted),
                  ),
                const SizedBox(height: 14),
                if (account.owes)
                  TextButton(
                    onPressed: () => setState(() => _typed = '${account.balance}'),
                    child: Text('Pay the full ${ugx(account.balance)}'),
                  ),
              ],
            ),
          ),
          _Channels(
            selected: _channel,
            onSelect: (channel) => setState(() => _channel = channel),
          ),
          if (_channel.wantsReference)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
              child: TextField(
                controller: _reference,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: '${_channel.label} transaction id (optional)',
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
            ),
          Keypad(
            keyHeight: 50,
            onDigit: _press,
            onBackspace: () {
              if (_typed.isEmpty) return;
              setState(() => _typed = _typed.substring(0, _typed.length - 1));
            },
            onClear: () => setState(() => _typed = ''),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
              child: FilledButton(
                onPressed:
                    (amount == null || amount <= 0 || payments.submitting) ? null : _submit,
                child: payments.submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Record payment'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Channels extends StatelessWidget {
  const _Channels({required this.selected, required this.onSelect});

  final PaymentChannel selected;
  final void Function(PaymentChannel) onSelect;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            for (final channel in PaymentChannel.values)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Material(
                    color: selected == channel ? Kuwe.brand600 : Colors.white,
                    borderRadius: BorderRadius.circular(9),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(9),
                      onTap: () => onSelect(channel),
                      child: Container(
                        height: 42,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(
                            color: selected == channel ? Kuwe.brand600 : Kuwe.line,
                          ),
                        ),
                        child: Text(
                          channel.label,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected == channel ? Colors.white : Kuwe.mutedDeep,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
}

/// Shown only after the server has confirmed. Nothing here is written by the
/// handset — if this screen is on show, the money is on the account.
class _ReceiptScreen extends StatelessWidget {
  const _ReceiptScreen({required this.receipt});

  final PaymentReceipt receipt;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Payment recorded')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Kuwe.line),
              ),
              child: Column(
                children: [
                  const Icon(Icons.check_circle, size: 40, color: Kuwe.okFg),
                  const SizedBox(height: 12),
                  Text(
                    ugx(receipt.amount),
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      color: Kuwe.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'received by ${receipt.channel.label}',
                    style: const TextStyle(fontSize: 13, color: Kuwe.mutedDeep),
                  ),
                  const SizedBox(height: 18),
                  const Divider(),
                  const SizedBox(height: 10),
                  _Line(label: 'Account', value: receipt.account.accountNo),
                  _Line(label: 'Name', value: receipt.account.name),
                  if (receipt.reference != null)
                    _Line(label: 'Reference', value: receipt.reference!),
                  _Line(label: 'Received', value: shortTime(receipt.receivedAt)),
                  const SizedBox(height: 8),
                  _Line(
                    label: receipt.balanceAfter >= 0 ? 'Balance now' : 'In credit',
                    value: ugx(receipt.balanceAfter.abs()),
                    bold: true,
                  ),
                ],
              ),
            ),
            const Spacer(),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value, this.bold = false});

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text(label, style: const TextStyle(fontSize: 13, color: Kuwe.muted)),
            const Spacer(),
            Text(
              value,
              style: TextStyle(
                fontSize: bold ? 15 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: Kuwe.ink,
              ),
            ),
          ],
        ),
      );
}
