import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/kuwe_api.dart';
import '../data/local_db.dart';
import '../models/round.dart';
import 'capture_lock.dart';
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
  /// Whether readings may be captured at all. The cached cycle is the handset's
  /// only source for this between downloads, so [sync] writes any status change
  /// the server reports straight into it.
  bool get canCapture => cycle?.isOpen ?? false;

  /// Why capture is closed, for a screen to say out loud. Null while it is open.
  String? get lockedReason => cycleBlockReason(cycle);

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
  ///
  /// Refuses anything the server would refuse. The screens hide the keypad in
  /// these cases already, but the guard belongs here as well: a value written
  /// locally that the server will reject leaves the handset showing a reading
  /// the office does not have, which is the one thing this app must never do.
  Future<void> capture(RoundEntry entry, int value) async {
    final blocked = captureBlockReason(entry: entry, cycle: cycle);
    if (blocked != null) throw ArgumentError(blocked);

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
      /* A rejection is one of two different things.

         Settled — the cycle closed, or the meter has already been billed —
         means nothing the reader types will ever be accepted. The typed value
         is put back to what the office holds, because leaving it would show a
         reading that was never saved, and the row stops being pending, because
         there is nothing left to send.

         Anything else is the reader's to fix, so it stays pending with the
         server's own words attached. */
      var reverted = 0;
      for (final failure in result.failures) {
        if (failure.isSettled) {
          await db.revertToSynced(failure.consumerId, failure.message);
          reverted++;
        } else {
          await db.markFailed(failure.consumerId, failure.message);
        }
      }

      // The office may have locked the cycle while this handset was away. Learn
      // it here rather than waiting for a download the reader may not manage.
      if (result.cycleStatus != null) await _applyCycleStatus(result.cycleStatus!);

      final sent = result.saved.length;
      final rejected = result.failures.length;
      message = switch ((rejected, reverted)) {
        (0, _) => 'Sent $sent ${sent == 1 ? 'reading' : 'readings'}.',
        // Said plainly: these were not saved and are no longer on the phone
        // either, so nobody goes looking for them in Waiting to send.
        (_, final r) when r == rejected =>
          'Sent $sent. $r ${r == 1 ? 'meter is' : 'meters are'} already settled — '
              'those readings were not saved and have been put back.',
        (_, 0) => 'Sent $sent, $rejected rejected — open Waiting to send to fix them.',
        (_, final r) =>
          'Sent $sent, ${rejected - r} to fix in Waiting to send, $r already settled '
              'and put back.',
      };
      messageIsError = rejected > 0;

      await loadFromCache();
    } on ApiException catch (e) {
      /* The server refuses the whole request, before looking at a single
         reading, when the cycle is no longer open — which is the usual way
         this happens: the round was downloaded while it was open and the
         office locked it during the walk. Every reading in the outbox is
         refused for that one reason, so they all go back to what the office
         holds. Leaving them would show the reader numbers that were never
         saved. */
      final closedAs = e.fieldErrors['cycle_status'];
      if (closedAs != null) {
        for (final entry in pending) {
          await db.revertToSynced(entry.consumerId, e.message);
        }
        await _applyCycleStatus(closedAs);
        await loadFromCache();

        final n = pending.length;
        message = 'The office has locked this round. ${n == 1 ? 'Your reading was' : 'Your $n readings were'} '
            'not saved and ${n == 1 ? 'has' : 'have'} been put back to what the office holds.';
        messageIsError = true;
        return;
      }

      message = e.isOffline
          ? 'Still no connection. Your readings are safe on this phone.'
          : e.message;
      messageIsError = !e.isOffline;
    } finally {
      syncing = false;
      notifyListeners();
    }
  }

  /// Stores a cycle status the server just reported, so every screen locks at
  /// once. Only written when it actually differs — this runs on every sync.
  Future<void> _applyCycleStatus(String status) async {
    if (cycle == null || cycle!.status == status) return;
    await db.updateCycleStatus(status);
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
