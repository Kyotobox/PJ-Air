import 'dart:io';

import 'package:axioma/src/car/ast_signature_extractor.dart';
import 'package:axioma/src/car/car_engine.dart';
import 'package:test/test.dart';

void main() {
  group('AstSignatureExtractor & CarEngine - Happy Paths', () {
    const AstSignatureExtractor extractor = AstSignatureExtractor();
    const CarEngine engine = CarEngine();

    test('Happy Path 1: Extracción determinista de firma AST y persistencia en banned_patterns.json', () async {
      const String defectiveCode = '''
void processData(dynamic raw) {
  final User user = raw as User;
  print(user.name);
}
''';

      const String fixedCode = '''
void processData(dynamic raw) {
  if (raw is User) {
    print(raw.name);
  }
}
''';

      final AstPatternRule rule = extractor.extractFromDiff(
        defectiveCode: defectiveCode,
        fixedCode: fixedCode,
        defectClusterId: 'DEF-104',
      );

      expect(rule.id, equals('CAR-DEF-104-UNSAFE-CAST'));
      expect(rule.nodeType, equals('AsExpression'));
      expect(rule.severity, equals(CarRuleSeverity.warn));
      expect(rule.promotionStatus, equals(CarPromotionStatus.observation));
      expect(rule.quarantineDays, equals(7));

      // Persistencia física
      final Directory tempDir = await Directory.systemTemp.createTemp(
        'car_banned_test_',
      );
      final String bannedFile = '${tempDir.path}/banned_patterns.json';

      try {
        await extractor.persistRule(rule, filePath: bannedFile);
        expect(await File(bannedFile).exists(), isTrue);

        final List<AstPatternRule> loaded =
            await AstSignatureExtractor.loadRules(filePath: bannedFile);
        expect(loaded.length, equals(1));
        expect(loaded.first.id, equals('CAR-DEF-104-UNSAFE-CAST'));
        expect(loaded.first.severity, equals(CarRuleSeverity.warn));
      } finally {
        if (await tempDir.exists()) {
          await tempDir.delete(recursive: true);
        }
      }
    });

    test(
      'Happy Path 2: Soporte de supresión auditable con motivo explícito',
      () {
        final AstPatternRule rule = AstPatternRule(
          id: 'CAR-DEF-104-UNSAFE-CAST',
          nodeType: 'AsExpression',
          pattern: r'\bas\s+[A-Z]\w+',
          severity: CarRuleSeverity.warn,
          description: 'Casteo inseguro detectado',
          createdAt: DateTime.now(),
        );

        const String codeWithSuppression = '''
void legacyBridge(dynamic item) {
  // axioma-ignore: CAR-DEF-104-UNSAFE-CAST reason: Interop con C-FFI requiere casteo estricto validado por puntero
  final Entity entity = item as Entity;
  print(entity.id);
}
''';

        final CarScanResult result = engine.scanSource(
          sourceCode: codeWithSuppression,
          filePath: 'lib/src/legacy_bridge.dart',
          rules: <AstPatternRule>[rule],
        );

        // La infracción debe ser suprimida y registrada en la bitácora
        expect(result.isClean, isTrue);
        expect(result.violations, isEmpty);
        expect(result.suppressions.length, equals(1));
        expect(
          result.suppressions.first.ruleId,
          equals('CAR-DEF-104-UNSAFE-CAST'),
        );
        expect(
          result.suppressions.first.reason,
          contains('Interop con C-FFI requiere casteo estricto'),
        );
      },
    );
  });

  group('AstSignatureExtractor & CarEngine - Sad Paths', () {
    const AstSignatureExtractor extractor = AstSignatureExtractor();
    const CarEngine engine = CarEngine();

    test('Sad Path 1: Rechazo de promoción a ERROR cuando la tasa de falsos positivos excede 1%', () {
      final AstPatternRule rule = AstPatternRule(
        id: 'CAR-DEF-205-BLIND-FIRST',
        nodeType: 'PropertyAccess',
        pattern: r'\.first\b(?!\w)',
        severity: CarRuleSeverity.warn,
        description: 'Acceso ciego .first',
        createdAt: DateTime.now(),
      );

      // Simulamos un corpus de 100 archivos donde 5 contienen .first (5% > 1%)
      final List<String> corpus = <String>[];
      for (int i = 0; i < 95; i++) {
        corpus.add('final item = list.firstOrNull;');
      }
      for (int i = 0; i < 5; i++) {
        corpus.add(
          'final item = list.first;',
        ); // 5 falsos positivos en código legítimo
      }

      final CarPromotionEvaluation evaluation = engine.evaluatePromotion(
        rule: rule,
        historicalCorpus: corpus,
        thresholdRate: 0.01,
      );

      expect(evaluation.falsePositiveRate, closeTo(0.05, 0.001));
      expect(evaluation.promotionVetoed, isTrue);
      expect(evaluation.promotedToError, isFalse);
      expect(evaluation.refinementTicket, isNotNull);
      expect(evaluation.refinementTicket, contains('TICKET-CAR-REFINEMENT'));
      expect(evaluation.refinementTicket, contains('5.00% > 1.0%'));
    });

    test(
      'Sad Path 2: Rechazo de supresión cuando falta el motivo o está vacío',
      () {
        final AstPatternRule rule = AstPatternRule(
          id: 'CAR-DEF-104-UNSAFE-CAST',
          nodeType: 'AsExpression',
          pattern: r'\bas\s+[A-Z]\w+',
          severity: CarRuleSeverity.warn,
          description: 'Casteo inseguro detectado',
          createdAt: DateTime.now(),
        );

        const String codeWithInvalidSuppression = '''
void invalidIgnore(dynamic item) {
  // axioma-ignore: CAR-DEF-104-UNSAFE-CAST
  final Entity entity = item as Entity;
}
''';

        final CarScanResult result = engine.scanSource(
          sourceCode: codeWithInvalidSuppression,
          filePath: 'lib/src/invalid.dart',
          rules: <AstPatternRule>[rule],
        );

        // Sin motivo válido, la directiva no debe suprimir el reporte
        expect(result.isClean, isFalse);
        expect(result.violations.length, equals(1));
        expect(result.suppressions, isEmpty);
      },
    );

    test('Sad Path 3: Extracción sobre acceso ciego .first reemplazado por .firstOrNull', () {
      const String defective = 'final el = items.first;';
      const String fixed = 'final el = items.firstOrNull;';

      final AstPatternRule rule = extractor.extractFromDiff(
        defectiveCode: defective,
        fixedCode: fixed,
        defectClusterId: 'DEF-301',
      );

      expect(rule.id, equals('CAR-DEF-301-BLIND-FIRST'));
      expect(rule.nodeType, equals('PropertyAccess'));
      expect(rule.pattern, equals(r'\.first\b(?!\w)'));
    });
  });
}
