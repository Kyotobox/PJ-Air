import 'dart:math' as math;
import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('TASK-N32-01: Geo Pure Domain Primitives (§39)', () {
    group('GeoPoint', () {
      test(
        'Happy Path: Instantiates valid coordinates and serializes correctly',
        () {
          final point = GeoPoint(10.4806, -66.9036);
          expect(point.latitude, closeTo(10.4806, 0.0001));
          expect(point.longitude, closeTo(-66.9036, 0.0001));

          final json = point.toJson();
          expect(json['latitude'], 10.4806);
          expect(json['longitude'], -66.9036);

          final restored = GeoPoint.fromJson(json);
          expect(restored, equals(point));
          expect(restored.hashCode, equals(point.hashCode));
          expect(point.toString(), contains('10.4806'));
        },
      );

      test(
        'Happy Path: Handles boundary coordinates (Poles and Anti-meridian)',
        () {
          final northPole = GeoPoint(90.0, 0.0);
          final southPole = GeoPoint(-90.0, 0.0);
          final eastBound = GeoPoint(0.0, 180.0);
          final westBound = GeoPoint(0.0, -180.0);

          expect(northPole.latitude, 90.0);
          expect(southPole.latitude, -90.0);
          expect(eastBound.longitude, 180.0);
          expect(westBound.longitude, -180.0);
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError when latitude exceeds limits',
        () {
          expect(() => GeoPoint(90.0001, 0.0), throwsA(isA<ArgumentError>()));
          expect(() => GeoPoint(-90.0001, 0.0), throwsA(isA<ArgumentError>()));
          expect(() => GeoPoint(150.0, 0.0), throwsA(isA<ArgumentError>()));
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError when longitude exceeds limits',
        () {
          expect(() => GeoPoint(0.0, 180.0001), throwsA(isA<ArgumentError>()));
          expect(() => GeoPoint(0.0, -180.0001), throwsA(isA<ArgumentError>()));
          expect(() => GeoPoint(0.0, 360.0), throwsA(isA<ArgumentError>()));
        },
      );

      test('Sad Path (§6): Throws ArgumentError on NaN or Infinite values', () {
        expect(() => GeoPoint(double.nan, 0.0), throwsA(isA<ArgumentError>()));
        expect(
          () => GeoPoint(0.0, double.infinity),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GeoPoint(double.negativeInfinity, 0.0),
          throwsA(isA<ArgumentError>()),
        );
      });

      test(
        'Sad Path (§6): Throws ArgumentError on missing JSON attributes',
        () {
          expect(
            () => GeoPoint.fromJson({'latitude': 10.0}),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => GeoPoint.fromJson({'longitude': -66.0}),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });

    group('BoundingBox', () {
      test(
        'Happy Path: Creates valid bounding box and verifies containment & center',
        () {
          final sw = GeoPoint(10.0, -67.0);
          final ne = GeoPoint(11.0, -66.0);
          final bbox = BoundingBox(southWest: sw, northEast: ne);

          expect(bbox.contains(GeoPoint(10.5, -66.5)), isTrue);
          expect(bbox.contains(GeoPoint(12.0, -66.5)), isFalse);
          expect(bbox.contains(GeoPoint(10.5, -68.0)), isFalse);

          final center = bbox.center;
          expect(center.latitude, closeTo(10.5, 0.0001));
          expect(center.longitude, closeTo(-66.5, 0.0001));

          final json = bbox.toJson();
          final restored = BoundingBox.fromJson(json);
          expect(restored, equals(bbox));
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError if southWest latitude > northEast latitude',
        () {
          final sw = GeoPoint(15.0, -67.0);
          final ne = GeoPoint(10.0, -66.0);
          expect(
            () => BoundingBox(southWest: sw, northEast: ne),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on malformed BoundingBox JSON',
        () {
          expect(() => BoundingBox.fromJson({}), throwsA(isA<ArgumentError>()));
        },
      );
    });

    group('Haversine Distance Calculator', () {
      test('Happy Path: Distance between identical points is strictly 0', () {
        final p = GeoPoint(10.4806, -66.9036);
        expect(calculateHaversineDistanceKm(p, p), 0.0);
        expect(calculateHaversineDistanceMeters(p, p), 0.0);
      });

      test(
        'Happy Path: Calculates exact known distances (London to Paris)',
        () {
          final london = GeoPoint(51.5074, -0.1278);
          final paris = GeoPoint(48.8566, 2.3522);

          final distanceKm = calculateHaversineDistanceKm(london, paris);
          final distanceMeters = calculateHaversineDistanceMeters(
            london,
            paris,
          );

          // London to Paris is ~343.5 km
          expect(distanceKm, closeTo(343.5, 5.0));
          expect(distanceMeters, closeTo(343500.0, 5000.0));
        },
      );

      test('Happy Path: Calculates distance for antipodal coordinates', () {
        final p1 = GeoPoint(0.0, 0.0);
        final p2 = GeoPoint(0.0, 180.0);
        final distance = calculateHaversineDistanceKm(p1, p2);
        // Half circumference of Earth is pi * 6371 ~ 20015 km
        expect(distance, closeTo(math.pi * kEarthRadiusKm, 10.0));
      });
    });

    group('AddressNormalizer', () {
      test(
        'Happy Path: Normalizes addresses removing escapes, extra spaces and uppercase',
        () {
          const raw =
              '  av.  francisco\tde\\nmiranda,\r\n\tedif.  galipán,\t\tpiso 3  ';
          final normalized = AddressNormalizer.normalize(raw);
          expect(
            normalized,
            equals('AV. FRANCISCO DE MIRANDA, EDIF. GALIPÁN, PISO 3'),
          );
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on empty or whitespace-only strings',
        () {
          expect(
            () => AddressNormalizer.normalize(''),
            throwsA(isA<ArgumentError>()),
          );
          expect(
            () => AddressNormalizer.normalize('    \t\n  '),
            throwsA(isA<ArgumentError>()),
          );
        },
      );

      test(
        'Sad Path (§6): Throws ArgumentError on string with only control characters',
        () {
          expect(
            () => AddressNormalizer.normalize('\x00\x01\x1F'),
            throwsA(isA<ArgumentError>()),
          );
        },
      );
    });
  });

  group('TASK-N32-02: Google Maps Static & Street View URL Builder (§39)', () {
    test(
      'Happy Path: Builds deterministic Street View URL with coordinates',
      () {
        final point = GeoPoint(10.4806, -66.9036);
        final uri = GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
          point: point,
          width: 800,
          height: 600,
          fov: 90,
          heading: 180,
          pitch: 10,
          apiKey: 'TEST_API_KEY',
        );

        expect(uri.scheme, equals('https'));
        expect(uri.host, equals('maps.googleapis.com'));
        expect(uri.path, equals('/maps/api/streetview'));
        expect(uri.queryParameters['location'], equals('10.4806,-66.9036'));
        expect(uri.queryParameters['size'], equals('800x600'));
        expect(uri.queryParameters['fov'], equals('90'));
        expect(uri.queryParameters['heading'], equals('180'));
        expect(uri.queryParameters['pitch'], equals('10'));
        expect(uri.queryParameters['key'], equals('TEST_API_KEY'));
      },
    );

    test(
      'Happy Path: Builds deterministic Street View URL with address string',
      () {
        final uri = GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
          address: 'Times Square, New York, NY',
          width: 640,
          height: 360,
        );

        expect(
          uri.queryParameters['location'],
          equals('Times Square, New York, NY'),
        );
        expect(uri.queryParameters['size'], equals('640x360'));
        expect(uri.queryParameters.containsKey('key'), isFalse);
      },
    );

    test(
      'Happy Path: Builds deterministic Static Map URL with center and zoom',
      () {
        final center = GeoPoint(40.7128, -74.0060);
        final uri = GoogleMapsStaticUrlBuilder.buildStaticMapUrl(
          center: center,
          zoom: 14,
          width: 600,
          height: 400,
          mapType: 'satellite',
          apiKey: 'STATIC_KEY',
        );

        expect(uri.path, equals('/maps/api/staticmap'));
        expect(uri.queryParameters['center'], equals('40.7128,-74.006'));
        expect(uri.queryParameters['zoom'], equals('14'));
        expect(uri.queryParameters['maptype'], equals('satellite'));
        expect(uri.queryParameters['size'], equals('600x400'));
        expect(uri.queryParameters['key'], equals('STATIC_KEY'));
      },
    );

    test(
      'Sad Path (§6): Throws ArgumentError when no location or address provided for Street View',
      () {
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            width: 600,
            height: 400,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(address: '   '),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path (§6): Throws ArgumentError when no view parameters provided for Static Map',
      () {
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStaticMapUrl(
            width: 600,
            height: 400,
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'Sad Path (§6): Throws ArgumentError on invalid size or boundary parameters',
      () {
        final point = GeoPoint(0.0, 0.0);
        // Non-positive dimensions
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            width: 0,
            height: 400,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            width: 600,
            height: -10,
          ),
          throwsA(isA<ArgumentError>()),
        );

        // FOV outside 10-120
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            fov: 5,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            fov: 150,
          ),
          throwsA(isA<ArgumentError>()),
        );

        // Heading outside 0-360
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            heading: -1,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            heading: 400,
          ),
          throwsA(isA<ArgumentError>()),
        );

        // Pitch outside -90 to 90
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            pitch: -95,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStreetViewUrl(
            point: point,
            pitch: 95,
          ),
          throwsA(isA<ArgumentError>()),
        );

        // Zoom outside 0-21
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStaticMapUrl(
            center: point,
            zoom: -1,
          ),
          throwsA(isA<ArgumentError>()),
        );
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStaticMapUrl(
            center: point,
            zoom: 25,
          ),
          throwsA(isA<ArgumentError>()),
        );

        // Invalid map type
        expect(
          () => GoogleMapsStaticUrlBuilder.buildStaticMapUrl(
            center: point,
            mapType: 'invalid_type',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
