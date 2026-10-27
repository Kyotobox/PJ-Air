import 'package:freezed_annotation/freezed_annotation.dart';

part 'asset_entity.freezed.dart';
part 'asset_entity.g.dart';

enum AssetStatus {
  @JsonValue('active')
  active,
  @JsonValue('maintenance')
  maintenance,
  @JsonValue('decommissioned')
  decommissioned,
}

@freezed
abstract class AssetEntity with _$AssetEntity {
  const factory AssetEntity({
    required String id,
    required String name,
    required String category,
    required AssetStatus status,
    required DateTime createdAt,
    String? description,
    Map<String, dynamic>? metadata,
  }) = _AssetEntity;

  factory AssetEntity.fromJson(Map<String, dynamic> json) =>
      _$AssetEntityFromJson(json);
}
