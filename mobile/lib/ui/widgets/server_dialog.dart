import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../logic/session_controller.dart';
import '../../theme.dart';

/// Lets someone point the handset at a different office server without a
/// rebuild — the difference between the emulator, a laptop on the office wifi
/// and the real machine is one address, and it is always discovered late.
Future<void> showServerDialog(BuildContext context) async {
  final session = context.read<SessionController>();
  final controller = TextEditingController(text: session.baseUrl);

  final saved = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: Colors.white,
      title: const Text('Office server', style: TextStyle(fontSize: 17)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: controller,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(hintText: 'http://192.168.1.10:3000'),
          ),
          const SizedBox(height: 10),
          const Text(
            'The address of the billing console. Use 10.0.2.2 for an emulator '
            'running on this machine.',
            style: TextStyle(fontSize: 12, color: Kuwe.mutedDeep),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(88, 42)),
          onPressed: () => Navigator.pop(context, controller.text),
          child: const Text('Save'),
        ),
      ],
    ),
  );

  if (saved != null && saved.trim().isNotEmpty) {
    await session.setBaseUrl(saved);
  }
  controller.dispose();
}
