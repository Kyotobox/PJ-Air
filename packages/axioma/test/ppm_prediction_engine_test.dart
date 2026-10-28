import 'package:test/test.dart';
import 'package:axioma/axioma.dart';

void main() {
  group('PpmPredictionEngine (CMMI Nivel 5)', () {
    late PpmPredictionEngine engine;

    setUp(() {
      engine = PpmPredictionEngine();
    });

    test('Happy Path: Predicción nominal para ticket válido', () {
      const PpmTicketProfile profile = PpmTicketProfile(
        filesCount: 2,
        promptTokens: 4000,
        zone: TaskRiskZone.green,
      );

      final PpmPredictionResult result = engine.predict(profile);

      expect(result.failureProbability, inInclusiveRange(0.0, 1.0));
      expect(result.expectedDurationSeconds, greaterThan(0.0));
      expect(result.expectedTokenConsumption, greaterThan(4000));
      expect(result.durationConfidenceInterval.lowerBound, greaterThan(0.0));
      expect(
        result.durationConfidenceInterval.upperBound,
        greaterThan(result.durationConfidenceInterval.lowerBound),
      );
      expect(
        result.failureConfidenceInterval.lowerBound,
        inInclusiveRange(0.0, 1.0),
      );
      expect(
        result.failureConfidenceInterval.upperBound,
        greaterThanOrEqualTo(result.failureConfidenceInterval.lowerBound),
      );
      expect(result.exceedsRiskThreshold(0.80), isFalse);
    });

    test('Happy Path: Riesgo escalado en Zona ROJA con múltiples archivos', () {
      const PpmTicketProfile lowRiskProfile = PpmTicketProfile(
        filesCount: 1,
        promptTokens: 1000,
        zone: TaskRiskZone.green,
      );
      const PpmTicketProfile highRiskProfile = PpmTicketProfile(
        filesCount: 6,
        promptTokens: 12000,
        zone: TaskRiskZone.red,
        historicalDefectDensity: 3,
      );

      final PpmPredictionResult lowRes = engine.predict(lowRiskProfile);
      final PpmPredictionResult highRes = engine.predict(highRiskProfile);

      expect(
        highRes.failureProbability,
        greaterThan(lowRes.failureProbability),
      );
      expect(
        highRes.expectedDurationSeconds,
        greaterThan(lowRes.expectedDurationSeconds),
      );
      expect(highRes.exceedsRiskThreshold(0.35), isTrue);
    });

    test(
      'Happy Path: Calibración estadística exitosa con observaciones reales',
      () {
        expect(engine.isCalibrated, isFalse);

        final List<ExecutionTelemetryRecord> observations =
            <ExecutionTelemetryRecord>[
              const ExecutionTelemetryRecord(
                sprintId: 'G217',
                taskId: 'TASK-G217-01',
                filesChanged: 2,
                promptTokens: 3500,
                zone: TaskRiskZone.green,
                durationSeconds: 24.5,
                failed: false,
              ),
              const ExecutionTelemetryRecord(
                sprintId: 'G218',
                taskId: 'TASK-G218-02',
                filesChanged: 4,
                promptTokens: 8200,
                zone: TaskRiskZone.amber,
                durationSeconds: 52.0,
                failed: false,
              ),
              const ExecutionTelemetryRecord(
                sprintId: 'G219',
                taskId: 'TASK-G219-01',
                filesChanged: 3,
                promptTokens: 6000,
                zone: TaskRiskZone.amber,
                durationSeconds: 38.0,
                failed: true,
              ),
              const ExecutionTelemetryRecord(
                sprintId: 'G219',
                taskId: 'TASK-G219-03',
                filesChanged: 1,
                promptTokens: 2500,
                zone: TaskRiskZone.green,
                durationSeconds: 14.0,
                failed: false,
              ),
            ];

        engine.calibrate(observations);

        expect(engine.isCalibrated, isTrue);

        final PpmPredictionResult calibratedResult = engine.predict(
          const PpmTicketProfile(filesCount: 2, promptTokens: 4000),
        );

        expect(calibratedResult.failureProbability, inInclusiveRange(0.0, 1.0));
        expect(calibratedResult.expectedDurationSeconds, greaterThan(0.0));
      },
    );

    test('Sad Path: Validación de archivos <= 0 lanza ArgumentError', () {
      expect(
        () => engine.predict(
          const PpmTicketProfile(filesCount: 0, promptTokens: 1000),
        ),
        throwsA(isA<ArgumentError>()),
      );
      expect(
        () => engine.predict(
          const PpmTicketProfile(filesCount: -2, promptTokens: 1000),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('Sad Path: Validación de tokens negativos lanza ArgumentError', () {
      expect(
        () => engine.predict(
          const PpmTicketProfile(filesCount: 1, promptTokens: -50),
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'Sad Path: Validación de densidad de defectos negativa lanza ArgumentError',
      () {
        expect(
          () => engine.predict(
            const PpmTicketProfile(
              filesCount: 1,
              promptTokens: 1000,
              historicalDefectDensity: -1,
            ),
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test('Sad Path: Muestra de calibración menor a 3 lanza StateError', () {
      final List<ExecutionTelemetryRecord> insufficient =
          <ExecutionTelemetryRecord>[
            const ExecutionTelemetryRecord(
              sprintId: 'G219',
              taskId: 'TASK-G219-01',
              filesChanged: 2,
              promptTokens: 3000,
              zone: TaskRiskZone.green,
              durationSeconds: 20.0,
              failed: false,
            ),
          ];

      expect(() => engine.calibrate(insufficient), throwsA(isA<StateError>()));
    });

    test('Sad Path: Muestra con varianza nula lanza StateError', () {
      final List<ExecutionTelemetryRecord> degenerate =
          <ExecutionTelemetryRecord>[
            const ExecutionTelemetryRecord(
              sprintId: 'G219',
              taskId: 'TASK-01',
              filesChanged: 2,
              promptTokens: 3000,
              zone: TaskRiskZone.green,
              durationSeconds: 25.0,
              failed: false,
            ),
            const ExecutionTelemetryRecord(
              sprintId: 'G219',
              taskId: 'TASK-02',
              filesChanged: 2,
              promptTokens: 3000,
              zone: TaskRiskZone.green,
              durationSeconds: 25.0,
              failed: false,
            ),
            const ExecutionTelemetryRecord(
              sprintId: 'G219',
              taskId: 'TASK-03',
              filesChanged: 2,
              promptTokens: 3000,
              zone: TaskRiskZone.green,
              durationSeconds: 25.0,
              failed: false,
            ),
          ];

      expect(() => engine.calibrate(degenerate), throwsA(isA<StateError>()));
    });
  });
}
