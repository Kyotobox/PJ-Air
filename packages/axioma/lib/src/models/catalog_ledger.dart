/// CatalogLedger — Modelo inmutable con serialización JSON universal
/// para la trazabilidad de catálogos ingestados en la flota.
class CatalogLedger {
  final String catalogId;
  final String sourceName;
  final String providerOrBrand;
  final String fileHash;
  final String versionLabel;
  final int recordsCount;
  final DateTime ingestedAt;

  const CatalogLedger({
    required this.catalogId,
    required this.sourceName,
    required this.providerOrBrand,
    required this.fileHash,
    required this.versionLabel,
    required this.recordsCount,
    required this.ingestedAt,
  });

  factory CatalogLedger.fromJson(Map<String, dynamic> json) {
    return CatalogLedger(
      catalogId: json['catalog_id'] as String,
      sourceName: json['source_name'] as String,
      providerOrBrand: json['provider_or_brand'] as String,
      fileHash: json['file_hash'] as String,
      versionLabel: json['version_label'] as String,
      recordsCount: (json['records_count'] as num).toInt(),
      ingestedAt: DateTime.parse(json['ingested_at'] as String),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'catalog_id': catalogId,
    'source_name': sourceName,
    'provider_or_brand': providerOrBrand,
    'file_hash': fileHash,
    'version_label': versionLabel,
    'records_count': recordsCount,
    'ingested_at': ingestedAt.toIso8601String(),
  };
}
