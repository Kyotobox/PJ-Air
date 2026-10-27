import 'package:freezed_annotation/freezed_annotation.dart';

part 'ingestion_source_record.freezed.dart';
part 'ingestion_source_record.g.dart';

enum IngestionSourceStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('processed')
  processed,
  @JsonValue('error')
  error,
}

@freezed
abstract class IngestionSourceRecord with _$IngestionSourceRecord {
  const factory IngestionSourceRecord({
    required String id,
    required String contentHash,
    required String rawContent,
    required String providerId,
    required DateTime acquiredAt,
    required IngestionSourceStatus status,
    String? catalogPartId,
    String? errorLog,
    Map<String, dynamic>? metadata,
  }) = _IngestionSourceRecord;

  factory IngestionSourceRecord.fromJson(Map<String, dynamic> json) =>
      _$IngestionSourceRecordFromJson(json);
}
