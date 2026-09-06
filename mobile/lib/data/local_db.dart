import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../models/round.dart';

/// The handset's copy of the round.
///
/// There is deliberately no separate outbox table: a reading waiting to sync is
/// just a row with pending = 1. Two tables would mean two truths, and the one
/// thing this app cannot afford is showing a reader a number that is not the
/// number it will send.
class LocalDb {
  LocalDb._(this._db);

  final Database _db;

  static Future<LocalDb> open() async {
    final path = p.join(await getDatabasesPath(), 'kuwe_meter.db');
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, _) async {
        await db.execute('''
          CREATE TABLE cycle (
            id INTEGER PRIMARY KEY,
            period TEXT NOT NULL,
            status TEXT NOT NULL,
            reading_start TEXT,
            reading_end TEXT,
            synced_at TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE entries (
            consumer_id INTEGER PRIMARY KEY,
            account_no TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            meter_no TEXT,
            zone_name TEXT,
            balance INTEGER NOT NULL DEFAULT 0,
            is_metered INTEGER NOT NULL DEFAULT 1,
            previous_value INTEGER NOT NULL DEFAULT 0,
            usage_history TEXT NOT NULL DEFAULT '[]',
            current_value INTEGER,
            synced_value INTEGER,
            flag TEXT,
            billed_invoice_no TEXT,
            pending INTEGER NOT NULL DEFAULT 0,
            failure TEXT
          )
        ''');
        await db.execute('CREATE INDEX entries_pending ON entries (pending)');
      },
    );
    return LocalDb._(db);
  }

  Future<Cycle?> readCycle() async {
    final rows = await _db.query('cycle', limit: 1);
    if (rows.isEmpty) return null;
    final row = rows.first;
    return Cycle(
      id: row['id'] as int,
      period: row['period'] as String,
      status: row['status'] as String,
      readingStart: row['reading_start'] as String?,
      readingEnd: row['reading_end'] as String?,
    );
  }

  Future<DateTime?> readSyncedAt() async {
    final rows = await _db.query('cycle', columns: ['synced_at'], limit: 1);
    final value = rows.isEmpty ? null : rows.first['synced_at'] as String?;
    return value == null ? null : DateTime.tryParse(value);
  }

  /// Replaces the cached round with what the server just sent — except for
  /// rows still holding an unsent reading, which would otherwise be silently
  /// discarded along with the walk that produced them.
  Future<void> replaceRound({
    required Cycle cycle,
    required List<RoundEntry> entries,
    required String syncedAt,
  }) async {
    final pendingRows = await _db.query('entries', where: 'pending = 1');
    final pendingByConsumer = {
      for (final row in pendingRows) row['consumer_id'] as int: row,
    };

    await _db.transaction((txn) async {
      final existing = await txn.query('cycle', limit: 1);
      final changedCycle = existing.isNotEmpty && existing.first['id'] != cycle.id;
      if (changedCycle) await txn.delete('entries');

      await txn.delete('cycle');
      await txn.insert('cycle', {
        ...cycle.toJson(),
        'synced_at': syncedAt,
      });

      for (final entry in entries) {
        final held = pendingByConsumer[entry.consumerId];
        final row = _toRow(entry);

        if (held != null && !changedCycle) {
          row['current_value'] = held['current_value'];
          row['pending'] = 1;
          row['failure'] = held['failure'];
        }

        await txn.insert(
          'entries',
          row,
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  Future<List<RoundEntry>> readEntries() async {
    final rows = await _db.query('entries', orderBy: 'account_no ASC');
    return rows.map(_fromRow).toList();
  }

  Future<List<RoundEntry>> readPending() async {
    final rows = await _db.query('entries', where: 'pending = 1', orderBy: 'account_no ASC');
    return rows.map(_fromRow).toList();
  }

  Future<int> countPending() async {
    final rows = await _db.rawQuery('SELECT COUNT(*) AS n FROM entries WHERE pending = 1');
    return (rows.first['n'] as num).toInt();
  }

  Future<void> saveLocalReading(int consumerId, int value, String flag) async {
    await _db.update(
      'entries',
      {'current_value': value, 'flag': flag, 'pending': 1, 'failure': null},
      where: 'consumer_id = ?',
      whereArgs: [consumerId],
    );
  }

  Future<void> markSynced(int consumerId, int value, String? flag) async {
    await _db.update(
      'entries',
      {'synced_value': value, 'flag': flag, 'pending': 0, 'failure': null},
      where: 'consumer_id = ?',
      whereArgs: [consumerId],
    );
  }

  /// A rejected reading keeps pending = 1. The reader has to see it and decide;
  /// dropping it would quietly lose a meter that was genuinely visited.
  Future<void> markFailed(int consumerId, String message) async {
    await _db.update(
      'entries',
      {'failure': message},
      where: 'consumer_id = ?',
      whereArgs: [consumerId],
    );
  }

  Future<void> clear() async {
    await _db.delete('entries');
    await _db.delete('cycle');
  }

  Map<String, Object?> _toRow(RoundEntry entry) => {
        'consumer_id': entry.consumerId,
        'account_no': entry.accountNo,
        'name': entry.name,
        'phone': entry.phone,
        'address': entry.address,
        'meter_no': entry.meterNo,
        'zone_name': entry.zoneName,
        'balance': entry.balance,
        'is_metered': entry.isMetered ? 1 : 0,
        'previous_value': entry.previousValue,
        'usage_history': jsonEncode(entry.usageHistory),
        'current_value': entry.currentValue,
        'synced_value': entry.syncedValue,
        'flag': entry.flag,
        'billed_invoice_no': entry.billedInvoiceNo,
        'pending': entry.pending ? 1 : 0,
        'failure': entry.failure,
      };

  RoundEntry _fromRow(Map<String, Object?> row) => RoundEntry(
        consumerId: row['consumer_id'] as int,
        accountNo: row['account_no'] as String,
        name: row['name'] as String,
        phone: row['phone'] as String?,
        address: row['address'] as String?,
        meterNo: row['meter_no'] as String?,
        zoneName: row['zone_name'] as String?,
        balance: (row['balance'] as num?)?.toInt() ?? 0,
        isMetered: (row['is_metered'] as int? ?? 1) == 1,
        previousValue: (row['previous_value'] as num?)?.toInt() ?? 0,
        usageHistory: (jsonDecode(row['usage_history'] as String? ?? '[]') as List)
            .map((value) => (value as num).toInt())
            .toList(),
        currentValue: (row['current_value'] as num?)?.toInt(),
        syncedValue: (row['synced_value'] as num?)?.toInt(),
        flag: row['flag'] as String?,
        billedInvoiceNo: row['billed_invoice_no'] as String?,
        pending: (row['pending'] as int? ?? 0) == 1,
        failure: row['failure'] as String?,
      );
}
