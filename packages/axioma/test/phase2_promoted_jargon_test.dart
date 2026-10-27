import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('Phase 2 Promoted Axioms Unit Tests', () {
    test('JargonDictionary maps LATAM jargon to canonical category', () {
      expect(
        JargonDictionary.getCanonicalCategory('pila de araya'),
        equals('Bomba de Gasolina'),
      );
      expect(
        JargonDictionary.getCanonicalCategory('meseta'),
        equals('Brazo de Control'),
      );
      expect(
        JargonDictionary.getCanonicalCategory('tripoide'),
        equals('Junta Homocinetica'),
      );
      expect(
        JargonDictionary.getCanonicalCategory('muñon'),
        equals('Rotula de Suspension'),
      );
      expect(
        JargonDictionary.getCanonicalCategory('croche'),
        equals('Kit de Embrague'),
      );
      expect(
        JargonDictionary.getCanonicalCategory('rolinera'),
        equals('Rodamiento de Rueda'),
      );
    });

    test('GenerationMatrix resolves canonical year range', () {
      final Map<String, int>? range = GenerationMatrix.findYearRange(
        'TOYOTA',
        'COROLLA',
      );
      expect(range, isNotNull);
      expect(range!['year_start'], equals(1997));
      expect(range['year_end'], equals(2002));
    });

    test('EngineFamilyDictionary normalizes engine families', () {
      expect(
        EngineFamilyDictionary.normalizeFamily('1.6 8V ZETEC ROCAM'),
        equals('Zetec Rocam'),
      );
      expect(
        EngineFamilyDictionary.normalizeFamily('1.4 FIRE EVO'),
        equals('Fire EVO'),
      );
      expect(
        EngineFamilyDictionary.normalizeFamily('1.8 16V K4M'),
        equals('K4M'),
      );
    });

    test('ModelAliasDictionary resolves vehicle aliases (VE/CO)', () {
      final Map<String, String>? res = ModelAliasDictionary.resolveAlias(
        'Baby Camry',
      );
      expect(res, isNotNull);
      expect(res!['make'], equals('TOYOTA'));
      expect(res['model'], equals('COROLLA'));

      final Map<String, String>? kavak = ModelAliasDictionary.resolveAlias(
        'Kavak',
      );
      expect(kavak, isNotNull);
      expect(kavak!['make'], equals('TOYOTA'));
      expect(kavak['model'], equals('HILUX'));
    });

    test('CrossFitmentDto serializes to and from JSON', () {
      const CrossFitmentDto dto = CrossFitmentDto(
        sourcePartId: 10,
        inferredPartId: 20,
        canonicalMake: 'TOYOTA',
        canonicalModel: 'COROLLA',
        yearStart: 2005,
        yearEnd: 2010,
        confidence: 0.90,
        sourceOemRef: 'TOY-12345',
      );

      final Map<String, dynamic> json = dto.toJson();
      final CrossFitmentDto restored = CrossFitmentDto.fromJson(json);

      expect(restored.sourcePartId, equals(10));
      expect(restored.inferredPartId, equals(20));
      expect(restored.canonicalMake, equals('TOYOTA'));
      expect(restored.canonicalModel, equals('COROLLA'));
    });
  });
}
