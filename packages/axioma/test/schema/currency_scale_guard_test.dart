import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

/// Implementación real en memoria del puerto [LlmPoolPort] (§4 Tolerancia Cero a Mocks).
/// Demuestra la extensibilidad y adherencia a contratos Pure Dart sin dependencias externas.
class InMemoryLlmPoolAdapter implements LlmPoolPort {
  final Map<String, List<String>> _keysByProvider;
  final Map<String, DateTime> _cooldowns = <String, DateTime>{};
  final Map<String, int> _providerIndices = <String, int>{};
  final Map<LlmTier, List<String>> _modelsByTier;

  InMemoryLlmPoolAdapter({
    required Map<String, List<String>> keysByProvider,
    Map<LlmTier, List<String>>? modelsByTier,
  }) : _keysByProvider = Map<String, List<String>>.from(keysByProvider),
       _modelsByTier =
           modelsByTier ??
           <LlmTier, List<String>>{
             LlmTier.tier1Fast: <String>[
               'gemini-2.0-flash',
               'claude-haiku-3-5',
             ],
             LlmTier.tier2Sota: <String>[
               'claude-opus-5-5',
               'claude-sonnet-5-5',
               'gemini-3.8-pro',
             ],
             LlmTier.tier3Deep: <String>['o3-pro', 'deepseek-r1'],
           };

  @override
  List<String> get registeredProviders =>
      List<String>.unmodifiable(_keysByProvider.keys);

  @override
  List<String> getAvailableModels({LlmTier? tier}) {
    if (tier != null) {
      return List<String>.unmodifiable(_modelsByTier[tier] ?? <String>[]);
    }
    return _modelsByTier.values.expand((List<String> m) => m).toList();
  }

  @override
  bool isTierAvailable(LlmTier tier, {DateTime? now}) {
    final DateTime current = now ?? DateTime.now();
    // Proveedores mapeados a tiers (ejemplo: tier 2 requiere anthropic o google pro)
    if (tier == LlmTier.tier2Sota) {
      final List<String> sotaKeys = _keysByProvider['anthropic'] ?? <String>[];
      return sotaKeys.any((String k) {
        final DateTime? cd = _cooldowns[k];
        return cd == null || current.isAfter(cd);
      });
    }
    // Tier 1
    final List<String> allKeys = _keysByProvider.values
        .expand((List<String> k) => k)
        .toList();
    return allKeys.any((String k) {
      final DateTime? cd = _cooldowns[k];
      return cd == null || current.isAfter(cd);
    });
  }

  @override
  Future<String> acquireKey({
    String? provider,
    LlmTier? tier,
    String? model,
    DateTime? now,
  }) async {
    final DateTime current = now ?? DateTime.now();
    final String targetProvider = provider ?? _keysByProvider.keys.first;
    final List<String> keys = _keysByProvider[targetProvider] ?? <String>[];

    if (keys.isEmpty) {
      throw LlmPoolExhaustedException(
        provider: targetProvider,
        tier: tier,
        totalKeys: 0,
      );
    }

    final int startIdx = _providerIndices[targetProvider] ?? 0;
    for (int i = 0; i < keys.length; i++) {
      final int idx = (startIdx + i) % keys.length;
      final String candidate = keys[idx];
      final DateTime? cd = _cooldowns[candidate];
      if (cd == null || current.isAfter(cd)) {
        _providerIndices[targetProvider] = (idx + 1) % keys.length;
        return candidate;
      }
    }

    throw LlmPoolExhaustedException(
      provider: targetProvider,
      tier: tier,
      totalKeys: keys.length,
    );
  }

  @override
  void reportSuccess(
    String key, {
    required String provider,
    String? model,
    int? tokensConsumed,
  }) {
    _cooldowns.remove(key);
  }

  @override
  void reportRateLimited(
    String key, {
    required String provider,
    Duration cooldown = const Duration(seconds: 60),
    DateTime? now,
  }) {
    final DateTime current = now ?? DateTime.now();
    _cooldowns[key] = current.add(cooldown);
  }

  @override
  void reportQuotaExhausted(
    String key, {
    required String provider,
    Duration cooldown = const Duration(hours: 24),
    DateTime? now,
  }) {
    final DateTime current = now ?? DateTime.now();
    _cooldowns[key] = current.add(cooldown);
  }

  @override
  Future<LlmPoolResponse> execute(LlmPoolRequest request) async {
    // Verificación de Piso Cognitivo (§53)
    if (request.requiredTier == LlmTier.tier2Sota &&
        !isTierAvailable(LlmTier.tier2Sota)) {
      throw LlmTierFloorUnmetException(
        requiredTier: request.requiredTier,
        availableTier: LlmTier.tier1Fast,
      );
    }

    final String provider =
        request.preferredProvider ?? _keysByProvider.keys.first;
    final String key = await acquireKey(
      provider: provider,
      tier: request.requiredTier,
    );

    return LlmPoolResponse(
      requestId: request.id,
      idempotencyKey: request.idempotencyKey,
      provider: provider,
      modelUsed:
          request.preferredModel ?? _modelsByTier[request.requiredTier]!.first,
      modelTier: request.requiredTier,
      keyId: key,
      latencyMs: 120.0,
      inputTokens: 50,
      outputTokens: 100,
      totalTokens: 150,
      rawText: 'Respuesta determinista para prompt: ${request.prompt}',
      status: LlmPoolStatus.success,
    );
  }

  @override
  LlmPoolHealthReport getHealthReport({DateTime? now}) {
    final DateTime current = now ?? DateTime.now();
    int total = 0;
    int available = 0;
    int inCooldown = 0;
    final Map<String, int> counts = <String, int>{};

    for (final MapEntry<String, List<String>> entry
        in _keysByProvider.entries) {
      counts[entry.key] = entry.value.length;
      total += entry.value.length;
      for (final String k in entry.value) {
        final DateTime? cd = _cooldowns[k];
        if (cd != null && cd.isAfter(current)) {
          inCooldown++;
        } else {
          available++;
        }
      }
    }

    return LlmPoolHealthReport(
      timestamp: current,
      totalKeys: total,
      availableKeys: available,
      cooldownKeys: inCooldown,
      keysPerProvider: counts,
      tierAvailability: <LlmTier, bool>{
        LlmTier.tier1Fast: isTierAvailable(LlmTier.tier1Fast, now: current),
        LlmTier.tier2Sota: isTierAvailable(LlmTier.tier2Sota, now: current),
        LlmTier.tier3Deep: isTierAvailable(LlmTier.tier3Deep, now: current),
      },
    );
  }
}

void main() {
  group('TASK-N122-02: CurrencyScaleGuard Pure Dart (§4, §6, §39, §56)', () {
    test(
      'Happy Path: Valida precios nominales dentro de umbrales verosímiles',
      () {
        final ScaleValidationResult usdResult =
            CurrencyScaleGuard.validateScale(
              price: 150.0,
              declaredCurrency: 'USD',
            );
        expect(usdResult.isValid, isTrue);
        expect(usdResult.cents, equals(15000));
        expect(usdResult.scale, equals(2));

        final ScaleValidationResult copResult =
            CurrencyScaleGuard.validateScale(
              price: 450000.0,
              declaredCurrency: 'COP',
            );
        expect(copResult.isValid, isTrue);
        expect(copResult.cents, equals(45000000));

        final ScaleValidationResult jpyResult =
            CurrencyScaleGuard.validateScale(
              price: 5000.0,
              declaredCurrency: 'JPY',
            );
        expect(jpyResult.isValid, isTrue);
        expect(jpyResult.scale, equals(0));
        expect(jpyResult.cents, equals(5000));
      },
    );

    test(
      'Happy Path: enforceValidPrice normaliza y retorna el valor válido',
      () {
        final double price = CurrencyScaleGuard.enforceValidPrice(
          price: 25.99,
          declaredCurrency: 'USD',
        );
        expect(price, equals(25.99));
      },
    );

    test(
      'Happy Path: Conversión determinista a céntimos (toCents y fromCents)',
      () {
        final int centsUsd = CurrencyScaleGuard.toCents(
          price: 25.99,
          declaredCurrency: 'USD',
        );
        expect(centsUsd, equals(2599));

        final double restoredUsd = CurrencyScaleGuard.fromCents(
          cents: 2599,
          declaredCurrency: 'USD',
        );
        expect(restoredUsd, equals(25.99));

        // JPY sin decimales (escala 0)
        final int centsJpy = CurrencyScaleGuard.toCents(
          price: 1250.0,
          declaredCurrency: 'JPY',
        );
        expect(centsJpy, equals(1250));
        expect(
          CurrencyScaleGuard.fromCents(cents: 1250, declaredCurrency: 'JPY'),
          equals(1250.0),
        );
      },
    );

    test('Happy Path: allowZero permite valor cero explícito', () {
      final ScaleValidationResult zeroResult = CurrencyScaleGuard.validateScale(
        price: 0.0,
        declaredCurrency: 'USD',
        allowZero: true,
      );
      expect(zeroResult.isValid, isTrue);
      expect(zeroResult.cents, equals(0));
    });

    test('Happy Path: Funciones auxiliares de escala, redondeo y formateo', () {
      expect(CurrencyScaleGuard.getScale('USD'), equals(2));
      expect(CurrencyScaleGuard.getScale('JPY'), equals(0));
      expect(CurrencyScaleGuard.getScale('UNKNOWN'), equals(2));

      expect(CurrencyScaleGuard.roundToScale(25.991, 'USD'), equals(25.99));
      expect(CurrencyScaleGuard.roundToScale(25.996, 'USD'), equals(26.0));

      expect(CurrencyScaleGuard.formatCents(2599, 'USD'), equals('25.99 USD'));
      expect(CurrencyScaleGuard.formatCents(5000, 'JPY'), equals('5000 JPY'));

      expect(
        CurrencyScaleGuard.enforceValidCents(
          cents: 2599,
          declaredCurrency: 'USD',
        ),
        equals(2599),
      );
    });

    test(
      '[SAD PATH §6] Desbordamiento de magnitud arroja CurrencyScaleException',
      () {
        final ScaleValidationResult overflow = CurrencyScaleGuard.validateScale(
          price: 1500000.0,
          declaredCurrency: 'USD',
        );
        expect(overflow.isValid, isFalse);
        expect(overflow.reason, equals('CURRENCY_MAGNITUDE_OVERFLOW'));

        expect(
          () => CurrencyScaleGuard.enforceValidPrice(
            price: 9999999.0,
            declaredCurrency: 'USD',
          ),
          throwsA(
            isA<CurrencyScaleException>().having(
              (CurrencyScaleException e) => e.reason,
              'reason',
              equals('CURRENCY_MAGNITUDE_OVERFLOW'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Subdesbordamiento de magnitud arroja CurrencyScaleException',
      () {
        final ScaleValidationResult underflow =
            CurrencyScaleGuard.validateScale(
              price: 0.005,
              declaredCurrency: 'USD',
            );
        expect(underflow.isValid, isFalse);
        expect(underflow.reason, equals('CURRENCY_MAGNITUDE_UNDERFLOW'));

        expect(
          () => CurrencyScaleGuard.enforceValidPrice(
            price: 0.001,
            declaredCurrency: 'USD',
          ),
          throwsA(
            isA<CurrencyScaleException>().having(
              (CurrencyScaleException e) => e.reason,
              'reason',
              equals('CURRENCY_MAGNITUDE_UNDERFLOW'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Violación estricta de precisión (sub-céntimos) es detectada y rechazada',
      () {
        // 10.999 tiene 3 decimales, viola escala 2 en USD
        final ScaleValidationResult precisionRes =
            CurrencyScaleGuard.validatePrecision(
              price: 10.999,
              declaredCurrency: 'USD',
            );
        expect(precisionRes.isValid, isFalse);
        expect(precisionRes.reason, equals('CURRENCY_PRECISION_OVERFLOW'));

        expect(
          () => CurrencyScaleGuard.toCents(
            price: 10.999,
            declaredCurrency: 'USD',
            strictScale: true,
          ),
          throwsA(
            isA<CurrencyScaleException>().having(
              (CurrencyScaleException e) => e.reason,
              'reason',
              equals('CURRENCY_PRECISION_OVERFLOW'),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Precios negativos o nulos sin flag arrojan ArgumentError',
      () {
        expect(
          () => CurrencyScaleGuard.validateScale(
            price: -50.0,
            declaredCurrency: 'USD',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => CurrencyScaleGuard.validateScale(
            price: 0.0,
            declaredCurrency: 'USD',
            allowZero: false,
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => CurrencyScaleGuard.validateScale(
            price: double.nan,
            declaredCurrency: 'USD',
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      '[SAD PATH §6] enforceValidCents valida límites enteros estrictos',
      () {
        expect(
          () => CurrencyScaleGuard.enforceValidCents(
            cents: -10,
            declaredCurrency: 'USD',
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => CurrencyScaleGuard.enforceValidCents(
            cents: 99999999999,
            declaredCurrency: 'USD',
          ),
          throwsA(
            isA<CurrencyScaleException>().having(
              (CurrencyScaleException e) => e.reason,
              'reason',
              equals('CURRENCY_MAGNITUDE_OVERFLOW'),
            ),
          ),
        );
      },
    );
  });

  group('TASK-N122-02: LlmPoolPort & Abstract LLM Contracts (§39, §47, §53)', () {
    late InMemoryLlmPoolAdapter pool;

    setUp(() {
      pool = InMemoryLlmPoolAdapter(
        keysByProvider: <String, List<String>>{
          'anthropic': <String>['sk-ant-key-1', 'sk-ant-key-2'],
          'google': <String>['ai-key-1', 'ai-key-2'],
        },
      );
    });

    test(
      'Happy Path: LlmPoolRequest serialización y constructores especializados',
      () {
        final LlmPoolRequest req = LlmPoolRequest(
          id: 'REQ-001',
          sourceNode: 'Smart',
          prompt: 'Validar arquitectura',
          taskType: LlmTaskType.reasoning,
          requiredTier: LlmTier.tier1Fast,
          temperature: 0.2,
        );

        final Map<String, dynamic> json = req.toJson();
        expect(json['id'], equals('REQ-001'));
        expect(json['source_node'], equals('Smart'));
        expect(json['required_tier'], equals('TIER_1_FAST'));

        final LlmPoolRequest restored = LlmPoolRequest.fromJson(json);
        expect(restored.id, equals('REQ-001'));
        expect(restored.requiredTier, equals(LlmTier.tier1Fast));
        expect(restored.temperature, equals(0.2));

        // Constructor especializado para el Consejo (§53)
        final LlmPoolRequest councilReq = LlmPoolRequest.council(
          id: 'REQ-COUNCIL-01',
          sourceNode: 'conext_core',
          prompt: 'Dictamen de salida de cuarentena',
        );
        expect(councilReq.requiredTier, equals(LlmTier.tier2Sota));
        expect(councilReq.taskType, equals(LlmTaskType.governanceCouncil));
      },
    );

    test('Happy Path: LlmTier jerarquía, parsing y piso cognitivo', () {
      expect(LlmTier.tier2Sota.meetsFloor(LlmTier.tier1Fast), isTrue);
      expect(LlmTier.tier1Fast.meetsFloor(LlmTier.tier2Sota), isFalse);
      expect(LlmTier.tier2Sota.isTier2OrHigher, isTrue);
      expect(LlmTier.tier1Fast.isTier2OrHigher, isFalse);

      expect(LlmTier.fromString('tier2'), equals(LlmTier.tier2Sota));
      expect(LlmTier.fromString('sota'), equals(LlmTier.tier2Sota));
      expect(LlmTier.fromString('fast'), equals(LlmTier.tier1Fast));
      expect(LlmTier.fromString('deep'), equals(LlmTier.tier3Deep));
    });

    test(
      'Happy Path: Ejecución, rotación y reporte de salud a través del puerto',
      () async {
        expect(pool.registeredProviders, contains('anthropic'));
        expect(pool.isTierAvailable(LlmTier.tier2Sota), isTrue);

        final String key1 = await pool.acquireKey(provider: 'anthropic');
        final String key2 = await pool.acquireKey(provider: 'anthropic');
        expect(key1, isNot(equals(key2))); // Round-robin activo

        final LlmPoolResponse resp = await pool.execute(
          LlmPoolRequest.council(
            id: 'REQ-C1',
            sourceNode: 'Smart',
            prompt: 'Evaluar salud de la flota',
          ),
        );

        expect(resp.status, equals(LlmPoolStatus.success));
        expect(resp.modelTier, equals(LlmTier.tier2Sota));

        final LlmPoolHealthReport health = pool.getHealthReport();
        expect(health.totalKeys, equals(4));
        expect(health.availableKeys, equals(4));
        expect(health.cooldownKeys, equals(0));
      },
    );

    test('Happy Path: LlmPoolResponse serialización y deserialización', () {
      const LlmPoolResponse resp = LlmPoolResponse(
        requestId: 'REQ-99',
        idempotencyKey: 'IDEM-99',
        provider: 'anthropic',
        modelUsed: 'claude-opus-5-5',
        modelTier: LlmTier.tier2Sota,
        latencyMs: 340.5,
        inputTokens: 120,
        outputTokens: 250,
        totalTokens: 370,
        rawText: 'Análisis arquitectónico satisfactorio.',
      );

      final Map<String, dynamic> json = resp.toJson();
      final LlmPoolResponse restored = LlmPoolResponse.fromJson(json);

      expect(restored.requestId, equals('REQ-99'));
      expect(restored.modelTier, equals(LlmTier.tier2Sota));
      expect(restored.totalTokens, equals(370));
    });

    test(
      '[SAD PATH §6] Solicitud malformada arroja LlmPoolValidationException',
      () {
        expect(
          () => LlmPoolRequest(
            id: '',
            sourceNode: 'Smart',
            prompt: 'Valid prompt',
          ),
          throwsA(
            isA<LlmPoolValidationException>().having(
              (LlmPoolValidationException e) => e.field,
              'field',
              equals('id'),
            ),
          ),
        );

        expect(
          () => LlmPoolRequest(
            id: 'REQ-1',
            sourceNode: '',
            prompt: 'Valid prompt',
          ),
          throwsA(
            isA<LlmPoolValidationException>().having(
              (LlmPoolValidationException e) => e.field,
              'field',
              equals('sourceNode'),
            ),
          ),
        );

        expect(
          () => LlmPoolRequest(id: 'REQ-1', sourceNode: 'Smart', prompt: '   '),
          throwsA(
            isA<LlmPoolValidationException>().having(
              (LlmPoolValidationException e) => e.field,
              'field',
              equals('prompt'),
            ),
          ),
        );

        expect(
          () => LlmPoolRequest(
            id: 'REQ-1',
            sourceNode: 'Smart',
            prompt: 'Valid',
            temperature: 3.5, // Fuera de rango [0.0, 2.0]
          ),
          throwsA(
            isA<LlmPoolValidationException>().having(
              (LlmPoolValidationException e) => e.field,
              'field',
              equals('temperature'),
            ),
          ),
        );

        expect(
          () => LlmTier.fromString('TIER_DESCONOCIDO_99'),
          throwsA(isA<LlmPoolValidationException>()),
        );
      },
    );

    test(
      '[SAD PATH §53] Violación de Piso Cognitivo arroja LlmTierFloorUnmetException',
      () async {
        // Agotar todas las claves Tier 2
        pool.reportQuotaExhausted('sk-ant-key-1', provider: 'anthropic');
        pool.reportQuotaExhausted('sk-ant-key-2', provider: 'anthropic');

        expect(pool.isTierAvailable(LlmTier.tier2Sota), isFalse);

        final LlmPoolRequest councilReq = LlmPoolRequest.council(
          id: 'REQ-FAIL-FLOOR',
          sourceNode: 'Smart',
          prompt: 'Petición que requiere Tier 2',
        );

        // Debe operar en fail-closed sin degradar a Tier 1 (§53)
        expect(
          () => pool.execute(councilReq),
          throwsA(
            isA<LlmTierFloorUnmetException>().having(
              (LlmTierFloorUnmetException e) => e.requiredTier,
              'requiredTier',
              equals(LlmTier.tier2Sota),
            ),
          ),
        );
      },
    );

    test(
      '[SAD PATH §6] Pool agotado por cooldown arroja LlmPoolExhaustedException',
      () async {
        pool.reportRateLimited('ai-key-1', provider: 'google');
        pool.reportRateLimited('ai-key-2', provider: 'google');

        expect(
          () => pool.acquireKey(provider: 'google'),
          throwsA(
            isA<LlmPoolExhaustedException>().having(
              (LlmPoolExhaustedException e) => e.provider,
              'provider',
              equals('google'),
            ),
          ),
        );
      },
    );
  });
}
