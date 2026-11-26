// 🎯 Cerbero / Watchdog Heartbeat Test Suite — Pure Dart (§4, §6, §39, §47)

import 'package:axioma/axioma.dart';
import 'package:test/test.dart';

void main() {
  group('CerberoHeartbeatDTO Canonical Contract Suite', () {
    test('Happy Path: CerberoHeartbeatDTO creation and alias parity', () {
      final hb = CerberoHeartbeatDTO.validated(
        traceId: 'TRC-1795644028908-CERBERO-01',
        nodeId: 'echo',
        role: 'EDGE_INGESTION_AND_PROBE',
        sequenceNumber: 1,
        cpuUsagePercent: 15.0,
        memoryUsageMb: 90.0,
      );

      expect(hb.nodeId, equals('echo'));
      final WatchdogHeartbeatDTO legacyAlias = hb;
      expect(legacyAlias.nodeId, equals('echo'));
    });

    test('Happy Path: Heartbeat creation, validation and JSON roundtrip', () {
      final now = DateTime.now().toUtc();
      final hb = WatchdogHeartbeatDTO.validated(
        traceId: 'TRC-1795644028908-ECHO-01',
        nodeId: 'echo',
        role: 'EDGE_INGESTION_AND_PROBE',
        timestamp: now,
        sequenceNumber: 42,
        cpuUsagePercent: 12.5,
        memoryUsageMb: 85.0,
        activeSessions: 3,
        status: NodeHealthStatus.healthy,
        metadata: {'platform': 'linux', 'pid': 1234},
      );

      expect(hb.schemaVersion, equals('1.0.0'));
      expect(hb.traceId, equals('TRC-1795644028908-ECHO-01'));
      expect(hb.nodeId, equals('echo'));
      expect(hb.role, equals('EDGE_INGESTION_AND_PROBE'));
      expect(hb.sequenceNumber, equals(42));
      expect(hb.cpuUsagePercent, equals(12.5));
      expect(hb.memoryUsageMb, equals(85.0));
      expect(hb.activeSessions, equals(3));
      expect(hb.status, equals(NodeHealthStatus.healthy));
      expect(hb.isHighCpuWarning, isFalse);
      expect(
        hb.isExpired(tolerance: const Duration(seconds: 10), now: now),
        isFalse,
      );

      final json = hb.toJson();
      expect(json['node_id'], equals('echo'));
      expect(json['status'], equals('HEALTHY'));
      expect(json['trace_id'], equals('TRC-1795644028908-ECHO-01'));

      final restored = WatchdogHeartbeatDTO.fromJson(json);
      expect(restored.nodeId, equals(hb.nodeId));
      expect(restored.traceId, equals(hb.traceId));
      expect(restored.sequenceNumber, equals(hb.sequenceNumber));
      expect(restored.status, equals(hb.status));
    });

    test('Happy Path: isHighCpuWarning triggers at >= 90% CPU', () {
      final hb = WatchdogHeartbeatDTO.validated(
        traceId: 'TRC-002',
        nodeId: 'scout',
        role: 'ARBITRAGE_ORACLE',
        sequenceNumber: 1,
        cpuUsagePercent: 92.4,
        memoryUsageMb: 250.0,
      );

      expect(hb.isHighCpuWarning, isTrue);
    });

    test('Happy Path: isExpired detects expired heartbeats', () {
      final past = DateTime.now().toUtc().subtract(const Duration(seconds: 30));
      final hb = WatchdogHeartbeatDTO.validated(
        traceId: 'TRC-003',
        nodeId: 'levita',
        role: 'RETAIL_COMMERCE',
        timestamp: past,
        sequenceNumber: 10,
        cpuUsagePercent: 5.0,
        memoryUsageMb: 120.0,
      );

      expect(hb.isExpired(tolerance: const Duration(seconds: 10)), isTrue);
    });

    test(
      'Sad Path (§6): Heartbeat rejects empty traceId, nodeId or invalid CPU',
      () {
        expect(
          () => WatchdogHeartbeatDTO.validated(
            traceId: '',
            nodeId: 'echo',
            role: 'PROBE',
            sequenceNumber: 0,
            cpuUsagePercent: 10.0,
            memoryUsageMb: 50.0,
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => WatchdogHeartbeatDTO.validated(
            traceId: 'TRC-1',
            nodeId: '',
            role: 'PROBE',
            sequenceNumber: 0,
            cpuUsagePercent: 10.0,
            memoryUsageMb: 50.0,
          ),
          throwsA(isA<ArgumentError>()),
        );

        expect(
          () => WatchdogHeartbeatDTO.validated(
            traceId: 'TRC-1',
            nodeId: 'echo',
            role: 'PROBE',
            sequenceNumber: 0,
            cpuUsagePercent: 105.0,
            memoryUsageMb: 50.0,
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });
}
