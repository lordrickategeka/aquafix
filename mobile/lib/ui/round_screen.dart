import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../logic/round_controller.dart';
import '../models/round.dart';
import '../theme.dart';
import 'capture_screen.dart';
import 'format.dart';

/// The round list, without a Scaffold of its own: HomeScreen owns the app bar,
/// the send button and the tab bar so a cashier-and-reader sees one chrome
/// rather than two stacked on top of each other.
class RoundBody extends StatefulWidget {
  const RoundBody({super.key});

  @override
  State<RoundBody> createState() => _RoundBodyState();
}

class _RoundBodyState extends State<RoundBody> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final round = context.watch<RoundController>();
    final cycle = round.cycle;

    return Column(
      children: [
        _ProgressBar(round: round),
        if (round.message != null) _Banner(round: round),
        if (cycle != null && !cycle.isOpen)
          _Notice(
            // Names the period and says which kind of locked it is. A reader
            // who has been told "sync failed" three times deserves the reason.
            text: '${round.lockedReason ?? 'This cycle is locked.'} Meters can '
                'still be opened to look up an account.',
            tone: Kuwe.warnBg,
            fg: Kuwe.warnFg,
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: TextField(
            controller: _search,
            onChanged: round.setSearch,
            decoration: InputDecoration(
              hintText: 'Name, account or meter no',
              prefixIcon: const Icon(Icons.search, size: 20, color: Kuwe.muted),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              suffixIcon: round.search.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _search.clear();
                        round.setSearch('');
                      },
                    ),
            ),
          ),
        ),
        _Filters(round: round),
        Expanded(child: _List(round: round)),
      ],
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.round});

  final RoundController round;

  @override
  Widget build(BuildContext context) {
    final total = round.totalCount;
    final done = round.readCount;
    final fraction = total == 0 ? 0.0 : done / total;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '$done of $total read',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Kuwe.ink),
              ),
              const Spacer(),
              Text(
                'Synced ${shortTime(round.syncedAt)}',
                style: const TextStyle(fontSize: 11.5, color: Kuwe.muted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 6,
              backgroundColor: Kuwe.brand100,
              valueColor: const AlwaysStoppedAnimation(Kuwe.brand500),
            ),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.round});

  final RoundController round;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: round.messageIsError ? Kuwe.badBg : Kuwe.infoBg,
      child: InkWell(
        onTap: round.clearMessage,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  round.message!,
                  style: TextStyle(
                    fontSize: 12.5,
                    color: round.messageIsError ? Kuwe.badFg : Kuwe.infoFg,
                  ),
                ),
              ),
              const Icon(Icons.close, size: 16, color: Kuwe.mutedDeep),
            ],
          ),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, required this.tone, required this.fg});

  final String text;
  final Color tone;
  final Color fg;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        color: tone,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Text(text, style: TextStyle(fontSize: 12.5, color: fg)),
      );
}

class _Filters extends StatelessWidget {
  const _Filters({required this.round});

  final RoundController round;

  @override
  Widget build(BuildContext context) {
    const labels = {
      RoundFilter.all: 'All',
      RoundFilter.unread: 'To read',
      RoundFilter.read: 'Read',
      RoundFilter.flagged: 'Check',
      RoundFilter.pending: 'Waiting',
    };

    return SizedBox(
      height: 46,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          for (final entry in labels.entries)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                selected: round.filter == entry.key,
                onSelected: (_) => round.setFilter(entry.key),
                showCheckmark: false,
                backgroundColor: Colors.white,
                selectedColor: Kuwe.brand600,
                side: BorderSide(
                  color: round.filter == entry.key ? Kuwe.brand600 : Kuwe.line,
                ),
                label: Text(
                  '${entry.value} ${round.countFor(entry.key)}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: round.filter == entry.key ? Colors.white : Kuwe.mutedDeep,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.round});

  final RoundController round;

  @override
  Widget build(BuildContext context) {
    final rows = round.visible;

    if (round.entries.isEmpty) {
      return _Empty(
        icon: Icons.cloud_download_outlined,
        title: round.loading ? 'Downloading…' : 'No round on this phone',
        body: 'Tap the download button while you have a connection.',
      );
    }
    if (rows.isEmpty) {
      return const _Empty(
        icon: Icons.search_off,
        title: 'Nothing here',
        body: 'No meters match this filter.',
      );
    }

    return RefreshIndicator(
      onRefresh: round.download,
      color: Kuwe.brand600,
      child: ListView.separated(
        padding: const EdgeInsets.only(bottom: 96),
        itemCount: rows.length,
        separatorBuilder: (_, _) => const Divider(height: 1, color: Kuwe.lineSoft),
        itemBuilder: (context, index) => _Row(entry: rows[index], round: round),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.round});

  final RoundEntry entry;
  final RoundController round;

  @override
  Widget build(BuildContext context) {
    final verdict = entry.verdict;

    return Material(
      color: Colors.white,
      child: InkWell(
        // Always open: a meter that cannot be captured can still be looked
        // up, and being asked "what do I owe?" at the gate does not stop
        // happening because the office locked the cycle. CaptureScreen decides
        // whether that is a keypad or a read-only profile.
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => CaptureScreen(consumerId: entry.consumerId)),
        ),
        child: Opacity(
          opacity: entry.isLocked ? 0.55 : 1,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _StatusDot(entry: entry),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14.5, fontWeight: FontWeight.w600, color: Kuwe.ink),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          entry.accountNo,
                          if (entry.meterNo != null) entry.meterNo,
                          if (entry.zoneName != null) entry.zoneName,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: Kuwe.muted),
                      ),
                      if (entry.failure != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          entry.failure!,
                          style: const TextStyle(fontSize: 11.5, color: Kuwe.badFg),
                        ),
                      ] else if (entry.billedInvoiceNo != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Billed ${entry.billedInvoiceNo}',
                          style: const TextStyle(fontSize: 11.5, color: Kuwe.mutedDeep),
                        ),
                      ] else if (!entry.isMetered) ...[
                        const SizedBox(height: 6),
                        const Text(
                          'Unmetered — flat rate',
                          style: TextStyle(fontSize: 11.5, color: Kuwe.mutedDeep),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      entry.isRead ? '${entry.currentValue}' : 'was ${entry.previousValue}',
                      style: TextStyle(
                        fontSize: entry.isRead ? 16 : 12.5,
                        fontWeight: entry.isRead ? FontWeight.w700 : FontWeight.w400,
                        color: entry.isRead ? Kuwe.ink : Kuwe.muted,
                      ),
                    ),
                    if (entry.isRead) ...[
                      const SizedBox(height: 2),
                      Text(
                        '+${entry.usage} m³',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: verdict.needsReview ? Kuwe.warnFg : Kuwe.mutedDeep,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.entry});

  final RoundEntry entry;

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final IconData? icon;

    if (entry.pending) {
      color = Kuwe.warnFg;
      icon = Icons.schedule;
    } else if (entry.isRead) {
      color = entry.verdict.needsReview ? Kuwe.warnFg : Kuwe.okFg;
      icon = entry.verdict.needsReview ? Icons.priority_high : Icons.check;
    } else {
      color = Kuwe.muted;
      icon = null;
    }

    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(9),
      ),
      child: icon == null
          ? null
          : Icon(icon, size: 17, color: color),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 38, color: Kuwe.muted),
              const SizedBox(height: 14),
              Text(title,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600, color: Kuwe.ink)),
              const SizedBox(height: 6),
              Text(
                body,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Kuwe.mutedDeep),
              ),
            ],
          ),
        ),
      );
}
