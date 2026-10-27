import 'package:freezed_annotation/freezed_annotation.dart';

part 'vehicle_entity.freezed.dart';
part 'vehicle_entity.g.dart';

@freezed
abstract class VehicleEntity with _$VehicleEntity {
  const factory VehicleEntity({
    required String id,
    required String make,
    required String model,
    required int yearFrom,
    int? yearTo,
    double? engineDisplacement,
    int? cylinders,
    String? subModel,
    String? fuelType,
    required String canonicalSlug,
  }) = _VehicleEntity;

  factory VehicleEntity.fromJson(Map<String, dynamic> json) =>
      _$VehicleEntityFromJson(json);
}
