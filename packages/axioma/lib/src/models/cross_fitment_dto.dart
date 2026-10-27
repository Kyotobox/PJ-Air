/// CrossFitmentDto representa una compatibilidad implícita o equivalencia relacional entre partes por códigos OEM.
class CrossFitmentDto {
  final int sourcePartId;
  final int inferredPartId;
  final String canonicalMake;
  final String canonicalModel;
  final int? yearStart;
  final int? yearEnd;
  final double confidence;
  final String? sourceOemRef;

  const CrossFitmentDto({
    required this.sourcePartId,
    required this.inferredPartId,
    required this.canonicalMake,
    required this.canonicalModel,
    this.yearStart,
    this.yearEnd,
    this.confidence = 0.85,
    this.sourceOemRef,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'source_part_id': sourcePartId,
    'inferred_part_id': inferredPartId,
    'canonical_make': canonicalMake,
    'canonical_model': canonicalModel,
    'year_start': yearStart,
    'year_end': yearEnd,
    'confidence': confidence,
    'source_oem_ref': sourceOemRef,
  };

  factory CrossFitmentDto.fromJson(Map<String, dynamic> json) =>
      CrossFitmentDto(
        sourcePartId: json['source_part_id'] as int,
        inferredPartId: json['inferred_part_id'] as int,
        canonicalMake: json['canonical_make'] as String,
        canonicalModel: json['canonical_model'] as String,
        yearStart: json['year_start'] as int?,
        yearEnd: json['year_end'] as int?,
        confidence: (json['confidence'] as num?)?.toDouble() ?? 0.85,
        sourceOemRef: json['source_oem_ref'] as String?,
      );
}
