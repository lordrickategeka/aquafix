import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../logic/registration_controller.dart';
import '../models/registration.dart';
import '../theme.dart';

/// Enrolling a new connection from the field.
///
/// The account number is the whole point of this screen: it is assigned by the
/// office, and until the server has answered there is nothing to tell the
/// person standing in front of you. So the form submits online or not at all,
/// and the confirmation shows the number in the largest type on the screen —
/// it is what the new customer writes down.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _meterNo = TextEditingController();
  final _openingReading = TextEditingController();

  ZoneOption? _zone;
  String _category = 'domestic';
  bool _isMetered = true;

  /// Bumped on reset, and mixed into the dropdowns' keys. A FormField seeds
  /// itself from initialValue once and then keeps its own state, so clearing
  /// the fields is not enough to make a dropdown stop showing the zone that was
  /// just registered — a new key is. Getting this wrong would leave the
  /// previous household's zone sitting in the form for the next one.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<RegistrationController>().loadOptions();
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _meterNo.dispose();
    _openingReading.dispose();
    super.dispose();
  }

  /// A kiosk is billed at a flat rate, so it has no meter to record. The server
  /// enforces this too; mirroring it here keeps the form from asking for a
  /// number that would be thrown away.
  bool get _meterApplies => _isMetered && _category != 'kiosk';

  void _reset() {
    _form.currentState?.reset();
    _name.clear();
    _phone.clear();
    _address.clear();
    _meterNo.clear();
    _openingReading.clear();
    setState(() {
      _zone = null;
      _category = 'domestic';
      _isMetered = true;
      _generation++;
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_form.currentState?.validate() ?? false)) return;

    final zone = _zone;
    if (zone == null) return;

    final registration = context.read<RegistrationController>();
    final name = _name.text.trim();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Register this connection?', style: TextStyle(fontSize: 17)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              name,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Kuwe.ink),
            ),
            const SizedBox(height: 6),
            Text(
              '${categoryLabel(_category)} · ${zone.name}'
              '${_meterApplies ? ' · meter ${_meterNo.text.trim()}' : ' · unmetered'}',
              style: const TextStyle(fontSize: 13, color: Kuwe.mutedDeep),
            ),
            const SizedBox(height: 10),
            const Text(
              'This opens an account at the office and cannot be undone from '
              'this phone.',
              style: TextStyle(fontSize: 12, color: Kuwe.muted),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Back')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 42)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Register'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final consumer = await registration.register(
      name: name,
      zoneId: zone.id,
      category: _category,
      isMetered: _meterApplies,
      phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      address: _address.text.trim().isEmpty ? null : _address.text.trim(),
      meterNo: _meterApplies ? _meterNo.text.trim() : null,
      openingReading: int.tryParse(_openingReading.text.trim()) ?? 0,
      zoneName: zone.name,
    );

    if (!mounted) return;
    // On failure the controller holds the reason — the banner above the form
    // and the messages under each box explain it, and what was typed is left
    // alone so it can be corrected rather than typed again.
    if (consumer == null) return;

    _reset();
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _RegisteredScreen(consumer: consumer)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final registration = context.watch<RegistrationController>();
    final options = registration.options;
    final fieldErrors = registration.fieldErrors;

    if (registration.loadingOptions && options == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (options == null) {
      return _Retry(
        message: registration.error ?? 'Could not load the registration form.',
        onRetry: () => registration.loadOptions(force: true),
      );
    }

    final categories = options.categories.isEmpty
        ? const ['domestic', 'institutional', 'commercial', 'kiosk']
        : options.categories;

    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
        children: [
          if (registration.error != null)
            _Banner(message: registration.error!, onDismiss: registration.clearError),

          _Field(
            label: 'Name',
            child: TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                hintText: 'Household or business name',
                errorText: fieldErrors['name'],
              ),
              validator: (value) =>
                  (value == null || value.trim().isEmpty) ? 'A name is required' : null,
            ),
          ),

          _Field(
            label: 'Zone',
            child: DropdownButtonFormField<ZoneOption>(
              key: ValueKey('zone-$_generation'),
              initialValue: _zone,
              isExpanded: true,
              decoration: InputDecoration(
                hintText: 'Which zone is it in?',
                errorText: fieldErrors['zone_id'],
              ),
              items: [
                for (final zone in options.zones)
                  DropdownMenuItem(
                    value: zone,
                    child: Text('${zone.name}${zone.code.isEmpty ? '' : ' · ${zone.code}'}'),
                  ),
              ],
              onChanged: (zone) => setState(() => _zone = zone),
              validator: (value) => value == null ? 'Pick a zone' : null,
            ),
          ),

          _Field(
            label: 'Category',
            child: DropdownButtonFormField<String>(
              key: ValueKey('category-$_generation'),
              initialValue: categories.contains(_category) ? _category : categories.first,
              isExpanded: true,
              decoration: InputDecoration(errorText: fieldErrors['category']),
              items: [
                for (final category in categories)
                  DropdownMenuItem(value: category, child: Text(categoryLabel(category))),
              ],
              onChanged: (value) => setState(() => _category = value ?? 'domestic'),
            ),
          ),

          _Field(
            label: 'Phone',
            optional: true,
            child: TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                hintText: '07…',
                errorText: fieldErrors['phone'],
              ),
            ),
          ),

          _Field(
            label: 'Address or landmark',
            optional: true,
            child: TextFormField(
              controller: _address,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'How the reader will find it',
                errorText: fieldErrors['address'],
              ),
            ),
          ),

          if (_category != 'kiosk')
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Kuwe.line),
              ),
              child: SwitchListTile(
                value: _isMetered,
                onChanged: (value) => setState(() => _isMetered = value),
                activeThumbColor: Kuwe.brand600,
                title: const Text('Metered', style: TextStyle(fontSize: 14.5)),
                subtitle: Text(
                  _isMetered
                      ? 'Billed on what the dial shows'
                      // Not a rare case: meters go missing, and an account with
                      // no meter still has to be billable.
                      : 'No meter fitted — billed at the flat rate for its category',
                  style: const TextStyle(fontSize: 12, color: Kuwe.muted),
                ),
              ),
            ),

          if (_meterApplies) ...[
            _Field(
              label: 'Meter number',
              child: TextFormField(
                controller: _meterNo,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'As stamped on the meter',
                  errorText: fieldErrors['meter_no'],
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'A metered connection needs a meter number'
                    : null,
              ),
            ),
            _Field(
              label: 'Opening reading',
              optional: true,
              child: TextFormField(
                controller: _openingReading,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  hintText: '0',
                  helperText: 'What the dial shows today. The first bill measures from it.',
                  helperMaxLines: 2,
                  errorText: fieldErrors['opening_reading'],
                ),
              ),
            ),
          ],

          const SizedBox(height: 6),
          FilledButton(
            onPressed: registration.submitting ? null : _submit,
            child: registration.submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Register connection'),
          ),
          const SizedBox(height: 10),
          const Text(
            'Registration needs a connection to the office. The account number '
            'comes back from there — it cannot be issued on this phone.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, color: Kuwe.muted),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child, this.optional = false});

  final String label;
  final Widget child;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 6),
            child: Row(
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Kuwe.mutedDeep,
                  ),
                ),
                if (optional)
                  const Text(
                    '  optional',
                    style: TextStyle(fontSize: 11, color: Kuwe.muted),
                  ),
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.onDismiss});

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
      decoration: BoxDecoration(
        color: Kuwe.badBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 12.5, color: Kuwe.badFg, height: 1.35),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: Kuwe.badFg),
            onPressed: onDismiss,
          ),
        ],
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 34, color: Kuwe.muted),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13.5, color: Kuwe.mutedDeep, height: 1.4),
            ),
            const SizedBox(height: 18),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(160, 46)),
              onPressed: onRetry,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

/// What the new customer is shown and told. The account number is the one
/// thing on here they have to keep.
class _RegisteredScreen extends StatelessWidget {
  const _RegisteredScreen({required this.consumer});

  final RegisteredConsumer consumer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Registered', style: TextStyle(fontSize: 16))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        children: [
          const Icon(Icons.check_circle, size: 44, color: Kuwe.okFg),
          const SizedBox(height: 14),
          Text(
            consumer.name,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Kuwe.ink),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: BoxDecoration(
              color: Kuwe.brand50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Kuwe.brand200),
            ),
            child: Column(
              children: [
                const Text(
                  'ACCOUNT NUMBER',
                  style: TextStyle(
                    fontSize: 10.5,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w700,
                    color: Kuwe.brand700,
                  ),
                ),
                const SizedBox(height: 6),
                SelectableText(
                  consumer.accountNo,
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    color: Kuwe.brand700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _Row(label: 'Category', value: categoryLabel(consumer.category)),
          if (consumer.zoneName != null) _Row(label: 'Zone', value: consumer.zoneName!),
          _Row(
            label: 'Meter',
            value: consumer.isMetered ? (consumer.meterNo ?? '—') : 'Unmetered (flat rate)',
          ),
          if (consumer.isMetered)
            _Row(label: 'Opening reading', value: '${consumer.openingReading} m³'),
          if (consumer.phone != null) _Row(label: 'Phone', value: consumer.phone!),
          _Row(label: 'Status', value: categoryLabel(consumer.status)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Kuwe.infoBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              // Said plainly so nobody promises a bill that is not coming yet:
              // the account exists, but it is not on a round until the office
              // puts it on one.
              'The account is open at the office. It joins a billing cycle when '
              'the office adds it to one — no bill is due yet.',
              style: TextStyle(fontSize: 12.5, color: Kuwe.infoFg, height: 1.4),
            ),
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Register another'),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 128,
            child: Text(label, style: const TextStyle(fontSize: 13, color: Kuwe.muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Kuwe.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
