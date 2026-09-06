import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/round_controller.dart';
import '../logic/session_controller.dart';
import '../theme.dart';
import 'widgets/server_dialog.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscured = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final session = context.read<SessionController>();
    final round = context.read<RoundController>();
    final ok = await session.login(_email.text.trim(), _password.text);

    // Pulling the round straight after sign-in means the reader leaves the
    // office with the walk already on the phone, which is the only moment
    // there is reliably a connection.
    if (ok && mounted) await round.download();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Align, because the Column stretches its children and
                    // would otherwise pull this into a full-width band.
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Kuwe.brand600,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        // The knockout, because the tile beneath is brand teal
                        // and the logo's own green would fight it.
                        child: Image.asset('assets/logo-white.png', width: 38, height: 38),
                      ),
                    ),
                    const SizedBox(height: 22),
                    const Text(
                      'Meter reader',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Kuwe.ink),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Sign in to download your round.',
                      style: TextStyle(fontSize: 14, color: Kuwe.mutedDeep),
                    ),
                    const SizedBox(height: 26),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? 'Enter your email' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscured,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        suffixIcon: IconButton(
                          icon: Icon(_obscured ? Icons.visibility_off : Icons.visibility,
                              color: Kuwe.muted),
                          onPressed: () => setState(() => _obscured = !_obscured),
                        ),
                      ),
                      validator: (value) =>
                          (value == null || value.isEmpty) ? 'Enter your password' : null,
                    ),
                    if (session.error != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: Kuwe.badBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          session.error!,
                          style: const TextStyle(color: Kuwe.badFg, fontSize: 13),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: session.busy ? null : _submit,
                      child: session.busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Sign in'),
                    ),
                    const SizedBox(height: 18),
                    // The office server's address changes between the test
                    // laptop and the real one, and a reader in the field is the
                    // person who discovers it is wrong.
                    TextButton(
                      onPressed: () => showServerDialog(context),
                      child: Text(
                        session.baseUrl,
                        style: const TextStyle(fontSize: 12, color: Kuwe.muted),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
