/// CatalogUpdateResult — Resultado inmutable de la ejecución del algoritmo Update Delta.
class CatalogUpdateResult {
  final String catalogIdNew;
  final String catalogIdSuperseded;
  final int recordsMaintained;
  final int recordsDeprecated;
  final int recordsAdded;
  final String generatedAt;

  const CatalogUpdateResult({
    required this.catalogIdNew,
    required this.catalogIdSuperseded,
    required this.recordsMaintained,
    required this.recordsDeprecated,
    required this.recordsAdded,
    required this.generatedAt,
  });

  factory CatalogUpdateResult.fromJson(Map<String, dynamic> json) =>
      CatalogUpdateResult(
        catalogIdNew: json['catalog_id_new'] as String,
        catalogIdSuperseded: json['catalog_id_superseded'] as String,
        recordsMaintained: (json['records_maintained'] as num).toInt(),
        recordsDeprecated: (json['records_deprecated'] as num).toInt(),
        recordsAdded: (json['records_added'] as num).toInt(),
        generatedAt: json['generated_at'] as String,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'catalog_id_new': catalogIdNew,
    'catalog_id_superseded': catalogIdSuperseded,
    'records_maintained': recordsMaintained,
    'records_deprecated': recordsDeprecated,
    'records_added': recordsAdded,
    'generated_at': generatedAt,
  };
}
