import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.fieldErrors = const {}});

  final String message;
  final int? statusCode;

  /// Per-field messages from the server's validator, keyed by field name — see
  /// fail() in src/lib/api-response.js. A form can put these against the box
  /// that caused them; without them a 422 reads only as "Validation failed",
  /// which tells the person holding the phone nothing they can act on.
  final Map<String, String> fieldErrors;

  bool get isAuthFailure => statusCode == 401;

  /// The office has taken the permission away since sign-in.
  bool get isForbidden => statusCode == 403;

  /// No response at all — the usual state of affairs on a walk. Distinguished
  /// from a rejection so the app can retry silently instead of alarming anyone.
  bool get isOffline => statusCode == null;

  @override
  String toString() => message;
}

/// Talks to the Next.js console. The token goes in an Authorization header
/// because the web session lives in an httpOnly cookie a handset cannot hold;
/// see getSessionUser() in the server's src/lib/auth.js.
class ApiClient {
  ApiClient(this._dio);

  static const _tokenKey = 'kuwe.token';
  static const _baseUrlKey = 'kuwe.baseUrl';

  /// Where a fresh install points. 10.0.2.2 is the host machine as seen from
  /// the Android emulator; a real handset is pointed at the office server
  /// through the address on the sign-in screen.
  ///
  /// Overridable at build time so a build can be aimed somewhere else without
  /// anyone tapping it in:
  ///   flutter run --dart-define=KUWE_BASE_URL=http://10.0.2.2:3001
  static const defaultBaseUrl = String.fromEnvironment(
    'KUWE_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  final Dio _dio;
  final _storage = const FlutterSecureStorage();
  String? _token;

  static Future<ApiClient> create() async {
    final prefs = await SharedPreferences.getInstance();
    final baseUrl = prefs.getString(_baseUrlKey) ?? defaultBaseUrl;

    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 30),
      // We read the status ourselves so a 401 or 422 arrives as a response to
      // interpret rather than an exception to unwrap.
      validateStatus: (_) => true,
    ));

    final client = ApiClient(dio);
    client._token = await client._storage.read(key: _tokenKey);
    return client;
  }

  String get baseUrl => _dio.options.baseUrl;
  bool get hasToken => _token != null;

  Future<void> setBaseUrl(String url) async {
    final trimmed = url.trim().replaceAll(RegExp(r'/+$'), '');
    _dio.options.baseUrl = trimmed;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, trimmed);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _storage.delete(key: _tokenKey);
    } else {
      await _storage.write(key: _tokenKey, value: token);
    }
  }

  Options get _options => Options(
        headers: {
          if (_token != null) 'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await _dio.get(path, queryParameters: query, options: _options);
      return _unwrap(response);
    } on DioException catch (error) {
      throw ApiException(_describe(error));
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    try {
      final response = await _dio.post(path, data: body, options: _options);
      return _unwrap(response);
    } on DioException catch (error) {
      throw ApiException(_describe(error));
    }
  }

  /// The console answers { data } on success and { error } on failure — see
  /// src/lib/api-response.js — so both shapes are handled in one place.
  Map<String, dynamic> _unwrap(Response response) {
    final status = response.statusCode ?? 0;
    final body = response.data;

    if (status >= 200 && status < 300) {
      if (body is Map && body['data'] is Map) {
        return Map<String, dynamic>.from(body['data'] as Map);
      }
      return body is Map ? Map<String, dynamic>.from(body) : <String, dynamic>{};
    }

    final message = body is Map && body['error'] is String
        ? body['error'] as String
        : 'Request failed ($status)';

    final errors = body is Map ? body['errors'] : null;
    throw ApiException(
      message,
      statusCode: status,
      fieldErrors: errors is Map
          ? {
              for (final entry in errors.entries)
                entry.key.toString(): entry.value.toString(),
            }
          : const {},
    );
  }

  String _describe(DioException error) => switch (error.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout =>
          'The server did not answer in time.',
        DioExceptionType.connectionError => 'No connection to the server.',
        _ => 'Could not reach the server.',
      };
}
