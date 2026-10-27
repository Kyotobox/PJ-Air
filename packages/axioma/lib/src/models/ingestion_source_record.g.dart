// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ingestion_source_record.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$IngestionSourceRecordImpl _$$IngestionSourceRecordImplFromJson(
  Map<String, dynamic> json,
) => _$IngestionSourceRecordImpl(
  id: json['id'] as String,
  contentHash: json['contentHash'] as String,
  rawContent: json['rawContent'] as String,
  providerId: json['providerId'] as String,
  acquiredAt: DateTime.parse(json['acquiredAt'] as String),
  status: $enumDecode(_$IngestionSourceStatusEnumMap, json['status']),
  catalogPartId: json['catalogPartId'] as String?,
  errorLog: json['errorLog'] as String?,
  metadata: json['metadata'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$$IngestionSourceRecordImplToJson(
  _$IngestionSourceRecordImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'contentHash': instance.contentHash,
  'rawContent': instance.rawContent,
  'providerId': instance.providerId,
  'acquiredAt': instance.acquiredAt.toIso8601String(),
  'status': _$IngestionSourceStatusEnumMap[instance.status]!,
  'catalogPartId': instance.catalogPartId,
  'errorLog': instance.errorLog,
  'metadata': instance.metadata,
};

const _$IngestionSourceStatusEnumMap = {
  IngestionSourceStatus.pending: 'pending',
  IngestionSourceStatus.processed: 'processed',
  IngestionSourceStatus.error: 'error',
};
