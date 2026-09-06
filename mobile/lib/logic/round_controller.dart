import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/kuwe_api.dart';
import '../data/local_db.dart';
import '../models/round.dart';
import 'reading_rules.dart';

enum RoundFilter { all, unread, read, flagged, pending }

class RoundController extends ChangeNotifier {
  RoundController({required this.api, required this.db});

  final KuweApi api;
  final LocalDb db;

  Cycle? cycle;
  List<RoundEntry> entries = const [];
  DateTime? syncedAt;

  bool loading = false;
  bool syncing = false;
  String? message;
  bool messageIsError = false;

  RoundFilter filter = RoundFilter.all;
  String search = '';

  /// Both sides of the progress line count the same population — the meters
  /// this reader still has to walk. A billed or unmetered account is not work,
  /// so counting it as read produced "2 of 1".
  int get readCount => entries.where((e) => !e.isLocked && e.isRead).length;
  int get totalCount => entries.where((e) => !e.isLocked).length;
  int get pendingCount => entries.where((e) => e.pending).length;
  bool get canCapture => cycle?.isOpen ?? false;

  /// The single definition of what each filter means. The chips label
  /// themselves with counts from this too, so a chip can never promise a
  /// number the list then fails to show.
  bool matches(RoundEntry entry, RoundFilter which) => switch (which) {
        RoundFilter.all => true,
        RoundFilter.unread => !entry.isRead && !entry.isLocked,
        RoundFilter.read => entry.isRead && !entry.isLocked,
        RoundFilter.flagged => entry.isRead && !entry.isLocked && entry.verdict.needsReview,
        RoundFilter.pending => entry.pending,
      };

  int countFor(RoundFilter which) => entries.where((e) => matches(e, which)).length;

  List<RoundEntry> get visible {
    final needle = search.trim().toLowerCase();
    return entries.where((entry) {
      if (!matches(entry, filter)) return false;
      if (needle.isEmpty) return true;

      return entry.name.toLowerCase().contains(needle) ||
          entry.accountNo.toLowerCase().contains(needle) ||
          (entry.meterNo?.toLowerCase().contains(needle) ?? false);
    }).toList();
  }

  /// Screen state comes from the handset's own database, never straight from a
  /// response. Whatever the network is doing, the list is whatever was last
  /// written down.
  Future<void> loadFromCache() async {
    cycle = await db.readCycle();
    entries = await db.readEntries();
    syncedAt = await db.readSyncedAt();
    notifyListeners();
  }

  Future<void> download() async {
    loading = true;
    message = null;
    notifyListeners();

    try {
      final payload = await api.round();
      if (payload.cycle == null) {
        message = 'No cycle is open. The office has not started a new round yet.';
        messageIsError = false;
      } else {
        await db.replaceRound(
          cycle: payload.cycle!,
          entries: payload.entries,
          syncedAt: payload.syncedAt,
        );
      }
      await loadFromCache();
    } on ApiException catch (e) {
      message = e.isOffline
          ? 'No connection — showing the round as last downloaded.'
          : e.message;
      messageIsError = !e.isOffline;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Writes a reading to the handset and nothing else. Sending it is a separate
  /// decision, because at the meter there is usually nothing to send over.
  Future<void> capture(RoundEntry entry, int value) async {
    final verdict = evaluateReading(
      previous: entry.previousValue,
      current: value,
      history: entry.usageHistory,
    );
    if (verdict.blocking) {
      throw ArgumentError(verdict.note ?? 'That reading cannot be saved.');
    }

    await db.saveLocalReading(entry.consumerId, value, verdict.flag.wire);
    entries = await db.readEntries();
    notifyListeners();
  }

  Future<void> sync() async {
    final cycleId = cycle?.id;
    if (cycleId == null) return;

    final pending = await db.readPending();
    if (pending.isEmpty) {
      message = 'Nothing waiting to send.';
      messageIsError = false;
      notifyListeners();
      return;
    }

    syncing = true;
    message = null;
    notifyListeners();

    try {
      final result = await api.submitReadings(cycleId, pending);

      for (final entry in pending) {
        final saved = result.saved[entry.consumerId];
        if (saved != null) {
          await db.markSynced(entry.consumerId, entry.currentValue!, saved.flag);
        }
      }
      for (final failure in result.failures) {
        await db.markFailed(failure.consumerId, failure.message);
      }

      final sent = result.saved.length;
      final rejected = result.failures.length;
      message = rejected == 0
          ? 'Sent $sent ${sent == 1 ? 'reading' : 'readings'}.'
          : 'Sent $sent, $rejected rejected — open Waiting to send to fix them.';
      messageIsError = rejected > 0;

      await loadFromCache();
    } on ApiException catch (e) {
      message = e.isOffline
          ? 'Still no connection. Your readings are safe on this phone.'
          : e.message;
      messageIsError = !e.isOffline;
    } finally {
      syncing = false;
      notifyListeners();
    }
  }

  void setFilter(RoundFilter value) {
    filter = value;
    notifyListeners();
  }

  void setSearch(String value) {
    search = value;
    notifyListeners();
  }

  void clearMessage() {
    message = null;
    notifyListeners();
  }
}
