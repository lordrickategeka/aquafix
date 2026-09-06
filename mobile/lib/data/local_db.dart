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
      version: 2,
      // v2 added the two columns the meter profile reads. Migrated with ALTER
      // rather than a rebuild: a handset upgrading mid-walk may be holding
      // unsent readings, and dropping the table would throw away the morning.
      // Both are backfilled by the next download.
      onUpgrade: (db, from, to) async {
        if (from < 2) {
          await db.execute('ALTER TABLE entries ADD COLUMN category TEXT');
          await db.execute("ALTER TABLE entries ADD COLUMN consumption TEXT NOT NULL DEFAULT '[]'");
        }
      },
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
            category TEXT,
            balance INTEGER NOT NULL DEFAULT 0,
            is_metered INTEGER NOT NULL DEFAULT 1,
            previous_value INTEGER NOT NULL DEFAULT 0,
            usage_history TEXT NOT NULL DEFAULT '[]',
            consumption TEXT NOT NULL DEFAULT '[]',
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

  /// For a rejection nothing can fix — the cycle closed, or the account has
  /// already been billed. The typed value is put back to whatever the server
  /// last confirmed and the row stops being pending, because there is nothing
  /// left to send.
  ///
  /// This is the whole point of keeping synced_value beside current_value: a
  /// refused edit must not leave the handset showing a number the office does
  /// not have. A reader quoting that number at a gate would be quoting a
  /// reading that was never accepted.
  Future<void> revertToSynced(int consumerId, String message) async {
    final rows = await _db.query(
      'entries',
      columns: ['synced_value'],
      where: 'consumer_id = ?',
      whereArgs: [consumerId],
      limit: 1,
    );
    final synced = rows.isEmpty ? null : rows.first['synced_value'] as int?;

    await _db.update(
      'entries',
      {'current_value': synced, 'pending': 0, 'failure': message},
      where: 'consumer_id = ?',
      whereArgs: [consumerId],
    );
  }

  /// The office locked or closed the cycle while this handset was away. Stored
  /// so every screen locks at once, without waiting for a fresh download the
  /// reader may not be able to make.
  Future<void> updateCycleStatus(String status) async {
    await _db.update('cycle', {'status': status});
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
        'category': entry.category,
        'balance': entry.balance,
        'is_metered': entry.isMetered ? 1 : 0,
        'previous_value': entry.previousValue,
        'usage_history': jsonEncode(entry.usageHistory),
        'consumption': jsonEncode([for (final row in entry.consumption) row.toJson()]),
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
        category: row['category'] as String?,
        balance: (row['balance'] as num?)?.toInt() ?? 0,
        isMetered: (row['is_metered'] as int? ?? 1) == 1,
        previousValue: (row['previous_value'] as num?)?.toInt() ?? 0,
        usageHistory: (jsonDecode(row['usage_history'] as String? ?? '[]') as List)
            .map((value) => (value as num).toInt())
            .toList(),
        consumption: (jsonDecode(row['consumption'] as String? ?? '[]') as List)
            .map((row) => ConsumptionRow.fromJson(row as Map<String, dynamic>))
            .toList(),
        currentValue: (row['current_value'] as num?)?.toInt(),
        syncedValue: (row['synced_value'] as num?)?.toInt(),
        flag: row['flag'] as String?,
        billedInvoiceNo: row['billed_invoice_no'] as String?,
        pending: (row['pending'] as int? ?? 0) == 1,
        failure: row['failure'] as String?,
      );
}
