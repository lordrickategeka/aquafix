import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme.dart';

/// An on-screen pad rather than the system keyboard: the keys are twice the
/// size, there is nothing to dismiss, and the layout never shifts under a thumb
/// that is already moving. Shared by meter capture and payment entry, which are
/// both "type digits outdoors, one-handed, in a hurry".
class Keypad extends StatelessWidget {
  const Keypad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    required this.onClear,
    this.keyHeight = 58,
  });

  final void Function(String) onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onClear;
  final double keyHeight;

  @override
  Widget build(BuildContext context) {
    Widget key(String label, {VoidCallback? onTap, Widget? child}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () {
                  HapticFeedback.selectionClick();
                  (onTap ?? () => onDigit(label))();
                },
                child: SizedBox(
                  height: keyHeight,
                  child: Center(
                    child: child ??
                        Text(
                          label,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w600,
                            color: Kuwe.ink,
                          ),
                        ),
                  ),
                ),
              ),
            ),
          ),
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Column(
        children: [
          Row(children: [key('1'), key('2'), key('3')]),
          Row(children: [key('4'), key('5'), key('6')]),
          Row(children: [key('7'), key('8'), key('9')]),
          Row(children: [
            key(
              'C',
              onTap: onClear,
              child: const Text(
                'C',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600, color: Kuwe.mutedDeep),
              ),
            ),
            key('0'),
            key(
              '<',
              onTap: onBackspace,
              child: const Icon(Icons.backspace_outlined, size: 21, color: Kuwe.mutedDeep),
            ),
          ]),
        ],
      ),
    );
  }
}
