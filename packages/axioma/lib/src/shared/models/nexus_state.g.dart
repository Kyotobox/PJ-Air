// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'nexus_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NexusState _$NexusStateFromJson(Map<String, dynamic> json) => NexusState(
  nodeId: json['nodeId'] as String,
  timestamp: DateTime.parse(json['timestamp'] as String),
  status: json['status'] as String? ?? 'IDLE',
  saturation: (json['saturation'] as num?)?.toDouble() ?? 0.0,
  schemaVersion: (json['schemaVersion'] as num?)?.toInt() ?? 2,
  integrityHash: json['integrityHash'] as String?,
  depth: (json['depth'] as num?)?.toDouble() ?? 0.0,
  drift: (json['drift'] as num?)?.toDouble() ?? 0.0,
  density: (json['density'] as num?)?.toInt() ?? 0,
  metadata: json['metadata'] as Map<String, dynamic>? ?? const {},
  activeCapabilities:
      (json['activeCapabilities'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const [],
);

Map<String, dynamic> _$NexusStateToJson(NexusState instance) =>
    <String, dynamic>{
      'nodeId': instance.nodeId,
      'timestamp': instance.timestamp.toIso8601String(),
      'status': instance.status,
      'saturation': instance.saturation,
      'schemaVersion': instance.schemaVersion,
      'integrityHash': instance.integrityHash,
      'depth': instance.depth,
      'drift': instance.drift,
      'density': instance.density,
      'metadata': instance.metadata,
      'activeCapabilities': instance.activeCapabilities,
    };
