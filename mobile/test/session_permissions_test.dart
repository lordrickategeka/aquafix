import 'package:flutter_test/flutter_test.dart';
import 'package:kuwe_meter/data/kuwe_api.dart';

/// The permissions the server sends are what decides which tabs exist, so the
/// mapping from a permission name to a capability is a contract with
/// database/seed.js, not a detail of the UI. If a name is ever changed on the
/// server, this is where it should fail.
Session sessionWith(List<String> permissions) => Session.fromJson({
      'user': {'id': 1, 'email': 'someone@example.com'},
      'roles': const <String>[],
      'permissions': permissions,
    });

void main() {
  group('field permissions', () {
    test('a meter reader gets readings only', () {
      final session = sessionWith(['capture-readings']);

      expect(session.canCaptureReadings, isTrue);
      expect(session.canRecordPayments, isFalse);
      expect(session.canRegisterConsumers, isFalse);
      expect(session.hasFieldAccess, isTrue);
    });

    test('a cashier gets payments only', () {
      final session = sessionWith(['record-payments']);

      expect(session.canRecordPayments, isTrue);
      expect(session.canCaptureReadings, isFalse);
      expect(session.canRegisterConsumers, isFalse);
    });

    test('register-consumers alone is enough to use the app', () {
      // The role that will hold this on its own does not exist yet — a
      // technician, per the office. The app reads the permission rather than
      // the role, so creating that role is all it will take.
      final session = sessionWith(['register-consumers']);

      expect(session.canRegisterConsumers, isTrue);
      expect(session.canCaptureReadings, isFalse);
      expect(session.canRecordPayments, isFalse);
      expect(session.hasFieldAccess, isTrue);
    });

    test('an admin holding everything gets all three', () {
      final session = sessionWith([
        'manage-users',
        'manage-consumers',
        'register-consumers',
        'capture-readings',
        'run-billing',
        'record-payments',
      ]);

      expect(session.canCaptureReadings, isTrue);
      expect(session.canRecordPayments, isTrue);
      expect(session.canRegisterConsumers, isTrue);
    });

    test('an office account with no field permission is refused', () {
      // manage-consumers is the console's edit permission and deliberately
      // does not open the field app; run-billing is not a field job either.
      final session = sessionWith(['manage-consumers', 'run-billing']);

      expect(session.hasFieldAccess, isFalse);
    });

    test('no permissions at all is refused', () {
      expect(sessionWith(const []).hasFieldAccess, isFalse);
    });
  });
}
