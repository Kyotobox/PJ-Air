// 🧪 Suite de Certificación: BcvRateService (§4 Zero Mocks, §6 Sad Paths, §39 Pure Dart, §45 Offline-First)
// SPRINT N27: TASK-N27-04

import 'dart:io';

import 'package:test/test.dart';
import '../../lib/src/services/bcv_rate_service.dart';

void main() {
  group('BcvRateService — Pruebas Físicas de Verdad Atómica (§4, §6, §39, §45)', () {
    late HttpServer server;
    late String serverUrl;

    setUp(() async {
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      serverUrl = 'http://${server.address.address}:${server.port}';
    });

    tearDown(() async {
      await server.close(force: true);
    });

    // Fragmento HTML real representativo de la publicación oficial del Banco Central de Venezuela
    const String validBcvHtml = '''
    <!DOCTYPE html>
    <html>
      <head><title>Tipo de Cambio Oficial BCV</title></head>
      <body>
        <div id="dolar" class="row">
          <div class="col-sm-6"><span>USD</span></div>
          <div class="col-sm-6"><strong> 42,75230000 </strong></div>
        </div>
        <div id="euro" class="row">
          <div class="col-sm-6"><span>EUR</span></div>
          <div class="col-sm-6"><strong> 46,12890000 </strong></div>
        </div>
        <div id="yuan" class="row">
          <div class="col-sm-6"><span>CNY</span></div>
          <div class="col-sm-6"><strong> 5,98400000 </strong></div>
        </div>
      </body>
    </html>
    ''';

    // --- HAPPY PATHS ---

    test(
      'Happy Path 1: fetchAllRates extrae todas las divisas oficiales del HTML del BCV',
      () async {
        server.listen((HttpRequest request) async {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.html;
          request.response.write(validBcvHtml);
          await request.response.close();
        });

        final BcvRateService service = BcvRateService(baseUrl: serverUrl);
        final Map<String, BcvRate> rates = await service.fetchAllRates();
        service.close();

        expect(rates.containsKey('USD'), isTrue);
        expect(rates.containsKey('EUR'), isTrue);
        expect(rates.containsKey('CNY'), isTrue);

        expect(rates['USD']!.rate, closeTo(42.7523, 0.0001));
        expect(rates['EUR']!.rate, closeTo(46.1289, 0.0001));
        expect(rates['CNY']!.rate, closeTo(5.9840, 0.0001));
        expect(rates['USD']!.isStale, isFalse);
      },
    );

    test(
      'Happy Path 2: fetchRate retorna tasa específica y alimenta la caché en memoria (§45)',
      () async {
        server.listen((HttpRequest request) async {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.html;
          request.response.write(validBcvHtml);
          await request.response.close();
        });

        final BcvRateService service = BcvRateService(baseUrl: serverUrl);
        final BcvRate usd = await service.fetchRate(currency: 'USD');

        expect(usd.currency, equals('USD'));
        expect(usd.rate, closeTo(42.7523, 0.0001));
        expect(usd.isStale, isFalse);

        // Verificar que la caché interna contiene el valor
        expect(service.cachedRates.containsKey('USD'), isTrue);
        service.close();
      },
    );

    test(
      'Happy Path 3: BcvRate.convert calcula conversiones matemáticas exactas',
      () {
        final BcvRate rate = BcvRate(
          currency: 'USD',
          rate: 40.0,
          timestamp: DateTime.now().toUtc(),
          sourceUrl: 'https://bcv.org.ve',
        );

        // Divisa a Bolívares (10 USD * 40 = 400 Bs)
        expect(rate.convert(10.0, toBs: true), equals(400.0));

        // Bolívares a Divisa (200 Bs / 40 = 5 USD)
        expect(rate.convert(200.0, toBs: false), equals(5.0));
      },
    );

    test(
      'Happy Path 4: Fallo de red con fallbackToCache=true retorna tasa en caché como isStale (§45)',
      () async {
        // Iniciar con caché pre-poblada
        final BcvRate initial = BcvRate(
          currency: 'USD',
          rate: 41.50,
          timestamp: DateTime.now().subtract(const Duration(hours: 4)),
          sourceUrl: 'https://bcv.org.ve',
        );

        final int closedPort = server.port;
        await server.close(force: true); // Servidor cerrado = partición física

        final BcvRateService service = BcvRateService(
          baseUrl: 'http://127.0.0.1:$closedPort',
          initialCache: <String, BcvRate>{'USD': initial},
        );

        final BcvRate fallback = await service.fetchRate(
          currency: 'USD',
          fallbackToCache: true,
        );
        service.close();

        expect(fallback.currency, equals('USD'));
        expect(fallback.rate, equals(41.50));
        expect(fallback.isStale, isTrue); // Bandera de degradación segura (§45)
      },
    );

    // --- SAD PATHS (§6 Mandatorio con throwsA / isA<Exception>) ---

    test(
      'Sad Path 1: Monto negativo en convert lanza ArgumentError (throwsA) (§6)',
      () {
        final BcvRate rate = BcvRate(
          currency: 'USD',
          rate: 40.0,
          timestamp: DateTime.now().toUtc(),
          sourceUrl: 'https://bcv.org.ve',
        );

        expect(() => rate.convert(-50.0), throwsA(isA<ArgumentError>()));
      },
    );

    test(
      'Sad Path 2: Moneda no disponible lanza BcvRateNotFoundException (throwsA) (§6)',
      () async {
        server.listen((HttpRequest request) async {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.html;
          request.response.write(validBcvHtml);
          await request.response.close();
        });

        final BcvRateService service = BcvRateService(baseUrl: serverUrl);

        expect(
          () => service.fetchRate(currency: 'JPY', fallbackToCache: false),
          throwsA(isA<BcvRateNotFoundException>()),
        );
        service.close();
      },
    );

    test(
      'Sad Path 3: HTML malformado o sin tasas oficiales lanza BcvParseException (throwsA) (§6)',
      () async {
        server.listen((HttpRequest request) async {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.html;
          request.response.write(
            '<html><body><p>El sistema se encuentra en mantenimiento.</p></body></html>',
          );
          await request.response.close();
        });

        final BcvRateService service = BcvRateService(baseUrl: serverUrl);

        expect(
          () => service.fetchAllRates(),
          throwsA(isA<BcvParseException>()),
        );
        service.close();
      },
    );

    test(
      'Sad Path 4: HTTP 500 del servidor lanza BcvNetworkException (throwsA) (§6)',
      () async {
        server.listen((HttpRequest request) async {
          request.response.statusCode = HttpStatus.internalServerError;
          await request.response.close();
        });

        final BcvRateService service = BcvRateService(baseUrl: serverUrl);

        expect(
          () => service.fetchRate(currency: 'USD', fallbackToCache: false),
          throwsA(isA<BcvNetworkException>()),
        );
        service.close();
      },
    );

    test(
      'Sad Path 5: Servidor caído sin caché previa lanza BcvNetworkException (throwsA) (§6, §45)',
      () async {
        final int closedPort = server.port;
        await server.close(force: true);

        final BcvRateService service = BcvRateService(
          baseUrl: 'http://127.0.0.1:$closedPort',
        );

        expect(
          () => service.fetchRate(currency: 'USD', fallbackToCache: false),
          throwsA(isA<BcvNetworkException>()),
        );
        service.close();
      },
    );
  });
}
