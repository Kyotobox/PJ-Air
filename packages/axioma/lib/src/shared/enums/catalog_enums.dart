import 'package:json_annotation/json_annotation.dart';

enum CatalogPartStatus {
  @JsonValue('extracted')
  extracted,
  @JsonValue('pending_review')
  pendingReview,
  @JsonValue('nominal')
  nominal,
  @JsonValue('discarded')
  discarded,
}

enum IngestionSourceStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('processed')
  processed,
  @JsonValue('error')
  error,
  @JsonValue('quarantined')
  quarantined,
}
