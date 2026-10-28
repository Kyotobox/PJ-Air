// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'vehicle_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

VehicleEntity _$VehicleEntityFromJson(Map<String, dynamic> json) {
  return _VehicleEntity.fromJson(json);
}

/// @nodoc
mixin _$VehicleEntity {
  String get id => throw _privateConstructorUsedError;
  String get make => throw _privateConstructorUsedError;
  String get model => throw _privateConstructorUsedError;
  int get yearFrom => throw _privateConstructorUsedError;
  int? get yearTo => throw _privateConstructorUsedError;
  double? get engineDisplacement => throw _privateConstructorUsedError;
  int? get cylinders => throw _privateConstructorUsedError;
  String? get subModel => throw _privateConstructorUsedError;
  String? get fuelType => throw _privateConstructorUsedError;
  String get canonicalSlug => throw _privateConstructorUsedError;

  /// Serializes this VehicleEntity to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of VehicleEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $VehicleEntityCopyWith<VehicleEntity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $VehicleEntityCopyWith<$Res> {
  factory $VehicleEntityCopyWith(
    VehicleEntity value,
    $Res Function(VehicleEntity) then,
  ) = _$VehicleEntityCopyWithImpl<$Res, VehicleEntity>;
  @useResult
  $Res call({
    String id,
    String make,
    String model,
    int yearFrom,
    int? yearTo,
    double? engineDisplacement,
    int? cylinders,
    String? subModel,
    String? fuelType,
    String canonicalSlug,
  });
}

/// @nodoc
class _$VehicleEntityCopyWithImpl<$Res, $Val extends VehicleEntity>
    implements $VehicleEntityCopyWith<$Res> {
  _$VehicleEntityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of VehicleEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? make = null,
    Object? model = null,
    Object? yearFrom = null,
    Object? yearTo = freezed,
    Object? engineDisplacement = freezed,
    Object? cylinders = freezed,
    Object? subModel = freezed,
    Object? fuelType = freezed,
    Object? canonicalSlug = null,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            make: null == make
                ? _value.make
                : make // ignore: cast_nullable_to_non_nullable
                      as String,
            model: null == model
                ? _value.model
                : model // ignore: cast_nullable_to_non_nullable
                      as String,
            yearFrom: null == yearFrom
                ? _value.yearFrom
                : yearFrom // ignore: cast_nullable_to_non_nullable
                      as int,
            yearTo: freezed == yearTo
                ? _value.yearTo
                : yearTo // ignore: cast_nullable_to_non_nullable
                      as int?,
            engineDisplacement: freezed == engineDisplacement
                ? _value.engineDisplacement
                : engineDisplacement // ignore: cast_nullable_to_non_nullable
                      as double?,
            cylinders: freezed == cylinders
                ? _value.cylinders
                : cylinders // ignore: cast_nullable_to_non_nullable
                      as int?,
            subModel: freezed == subModel
                ? _value.subModel
                : subModel // ignore: cast_nullable_to_non_nullable
                      as String?,
            fuelType: freezed == fuelType
                ? _value.fuelType
                : fuelType // ignore: cast_nullable_to_non_nullable
                      as String?,
            canonicalSlug: null == canonicalSlug
                ? _value.canonicalSlug
                : canonicalSlug // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$VehicleEntityImplCopyWith<$Res>
    implements $VehicleEntityCopyWith<$Res> {
  factory _$$VehicleEntityImplCopyWith(
    _$VehicleEntityImpl value,
    $Res Function(_$VehicleEntityImpl) then,
  ) = __$$VehicleEntityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String make,
    String model,
    int yearFrom,
    int? yearTo,
    double? engineDisplacement,
    int? cylinders,
    String? subModel,
    String? fuelType,
    String canonicalSlug,
  });
}

/// @nodoc
class __$$VehicleEntityImplCopyWithImpl<$Res>
    extends _$VehicleEntityCopyWithImpl<$Res, _$VehicleEntityImpl>
    implements _$$VehicleEntityImplCopyWith<$Res> {
  __$$VehicleEntityImplCopyWithImpl(
    _$VehicleEntityImpl _value,
    $Res Function(_$VehicleEntityImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of VehicleEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? make = null,
    Object? model = null,
    Object? yearFrom = null,
    Object? yearTo = freezed,
    Object? engineDisplacement = freezed,
    Object? cylinders = freezed,
    Object? subModel = freezed,
    Object? fuelType = freezed,
    Object? canonicalSlug = null,
  }) {
    return _then(
      _$VehicleEntityImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        make: null == make
            ? _value.make
            : make // ignore: cast_nullable_to_non_nullable
                  as String,
        model: null == model
            ? _value.model
            : model // ignore: cast_nullable_to_non_nullable
                  as String,
        yearFrom: null == yearFrom
            ? _value.yearFrom
            : yearFrom // ignore: cast_nullable_to_non_nullable
                  as int,
        yearTo: freezed == yearTo
            ? _value.yearTo
            : yearTo // ignore: cast_nullable_to_non_nullable
                  as int?,
        engineDisplacement: freezed == engineDisplacement
            ? _value.engineDisplacement
            : engineDisplacement // ignore: cast_nullable_to_non_nullable
                  as double?,
        cylinders: freezed == cylinders
            ? _value.cylinders
            : cylinders // ignore: cast_nullable_to_non_nullable
                  as int?,
        subModel: freezed == subModel
            ? _value.subModel
            : subModel // ignore: cast_nullable_to_non_nullable
                  as String?,
        fuelType: freezed == fuelType
            ? _value.fuelType
            : fuelType // ignore: cast_nullable_to_non_nullable
                  as String?,
        canonicalSlug: null == canonicalSlug
            ? _value.canonicalSlug
            : canonicalSlug // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$VehicleEntityImpl implements _VehicleEntity {
  const _$VehicleEntityImpl({
    required this.id,
    required this.make,
    required this.model,
    required this.yearFrom,
    this.yearTo,
    this.engineDisplacement,
    this.cylinders,
    this.subModel,
    this.fuelType,
    required this.canonicalSlug,
  });

  factory _$VehicleEntityImpl.fromJson(Map<String, dynamic> json) =>
      _$$VehicleEntityImplFromJson(json);

  @override
  final String id;
  @override
  final String make;
  @override
  final String model;
  @override
  final int yearFrom;
  @override
  final int? yearTo;
  @override
  final double? engineDisplacement;
  @override
  final int? cylinders;
  @override
  final String? subModel;
  @override
  final String? fuelType;
  @override
  final String canonicalSlug;

  @override
  String toString() {
    return 'VehicleEntity(id: $id, make: $make, model: $model, yearFrom: $yearFrom, yearTo: $yearTo, engineDisplacement: $engineDisplacement, cylinders: $cylinders, subModel: $subModel, fuelType: $fuelType, canonicalSlug: $canonicalSlug)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$VehicleEntityImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.make, make) || other.make == make) &&
            (identical(other.model, model) || other.model == model) &&
            (identical(other.yearFrom, yearFrom) ||
                other.yearFrom == yearFrom) &&
            (identical(other.yearTo, yearTo) || other.yearTo == yearTo) &&
            (identical(other.engineDisplacement, engineDisplacement) ||
                other.engineDisplacement == engineDisplacement) &&
            (identical(other.cylinders, cylinders) ||
                other.cylinders == cylinders) &&
            (identical(other.subModel, subModel) ||
                other.subModel == subModel) &&
            (identical(other.fuelType, fuelType) ||
                other.fuelType == fuelType) &&
            (identical(other.canonicalSlug, canonicalSlug) ||
                other.canonicalSlug == canonicalSlug));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    make,
    model,
    yearFrom,
    yearTo,
    engineDisplacement,
    cylinders,
    subModel,
    fuelType,
    canonicalSlug,
  );

  /// Create a copy of VehicleEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$VehicleEntityImplCopyWith<_$VehicleEntityImpl> get copyWith =>
      __$$VehicleEntityImplCopyWithImpl<_$VehicleEntityImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$VehicleEntityImplToJson(this);
  }
}

abstract class _VehicleEntity implements VehicleEntity {
  const factory _VehicleEntity({
    required final String id,
    required final String make,
    required final String model,
    required final int yearFrom,
    final int? yearTo,
    final double? engineDisplacement,
    final int? cylinders,
    final String? subModel,
    final String? fuelType,
    required final String canonicalSlug,
  }) = _$VehicleEntityImpl;

  factory _VehicleEntity.fromJson(Map<String, dynamic> json) =
      _$VehicleEntityImpl.fromJson;

  @override
  String get id;
  @override
  String get make;
  @override
  String get model;
  @override
  int get yearFrom;
  @override
  int? get yearTo;
  @override
  double? get engineDisplacement;
  @override
  int? get cylinders;
  @override
  String? get subModel;
  @override
  String? get fuelType;
  @override
  String get canonicalSlug;

  /// Create a copy of VehicleEntity
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$VehicleEntityImplCopyWith<_$VehicleEntityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
