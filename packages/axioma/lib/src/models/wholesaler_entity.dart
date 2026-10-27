import 'package:freezed_annotation/freezed_annotation.dart';

part 'wholesaler_entity.freezed.dart';
part 'wholesaler_entity.g.dart';

@freezed
abstract class WholesalerEntity with _$WholesalerEntity {
  const factory WholesalerEntity({
    required String id,
    required String name,
    required String currency,
    required String formula,
    Map<String, dynamic>? metadata,
  }) = _WholesalerEntity;

  factory WholesalerEntity.fromJson(Map<String, dynamic> json) =>
      _$WholesalerEntityFromJson(json);
}
