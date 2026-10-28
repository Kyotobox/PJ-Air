import 'package:json_annotation/json_annotation.dart';
import '../../axiom_version.dart';

part 'nexus_state.g.dart';

/// NexusState: Modelo para el intercambio asíncrono de estados entre búnkeres (G27).
@AxiomVersion('2.0.1')
@JsonSerializable(explicitToJson: true)
class NexusState {
  final String nodeId;
  final DateTime timestamp;
  final String status;
  final double saturation;
  final int schemaVersion;
  final String? integrityHash;
  final double depth;
  final double drift;
  final int density;
  final Map<String, dynamic> metadata;
  final List<String> activeCapabilities;

  const NexusState({
    required this.nodeId,
    required this.timestamp,
    this.status = 'IDLE',
    this.saturation = 0.0,
    this.schemaVersion = 2,
    this.integrityHash,
    this.depth = 0.0,
    this.drift = 0.0,
    this.density = 0,
    this.metadata = const <String, dynamic>{},
    this.activeCapabilities = const <String>[],
  });

  factory NexusState.fromJson(Map<String, dynamic> json) =>
      _$NexusStateFromJson(json);

  Map<String, dynamic> toJson() => _$NexusStateToJson(this);
}
