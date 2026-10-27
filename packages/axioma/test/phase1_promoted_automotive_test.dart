import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Phase 1 Promoted Automotive Axioms Tests', () {
    test('BrandDictionary contains Automotive Whitelist', () {
      expect(BrandDictionary.whitelist, contains('TOYOTA'));
      expect(BrandDictionary.whitelist, contains('CHEVROLET'));
      expect(BrandDictionary.whitelist, contains('FORD'));
      expect(BrandDictionary.normalize('toyota'), equals('TOYOTA'));
    });

    test('PartBrandDictionary contains Automotive Aftermarket Brands', () {
      expect(PartBrandDictionary.whitelist, contains('BOSCH'));
      expect(PartBrandDictionary.whitelist, contains('DENSO'));
      expect(PartBrandDictionary.normalize('bosch'), equals('BOSCH'));
    });

    test('TaxonomyMatrix contains Category Rules', () {
      expect(PartCategory.level1, isNotEmpty);
    });

    test('VehicleEntity instantiates and serializes correctly', () {
      final VehicleEntity vehicle = const VehicleEntity(
        id: 'veh_01',
        make: 'TOYOTA',
        model: 'COROLLA',
        yearFrom: 2005,
        yearTo: 2010,
        canonicalSlug: 'toyota-corolla-2005-2010',
      );
      expect(vehicle.make, equals('TOYOTA'));
      final Map<String, dynamic> json = vehicle.toJson();
      expect(json['make'], equals('TOYOTA'));
    });
  });
}
