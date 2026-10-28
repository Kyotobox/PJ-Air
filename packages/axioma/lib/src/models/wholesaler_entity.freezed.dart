// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'wholesaler_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

WholesalerEntity _$WholesalerEntityFromJson(Map<String, dynamic> json) {
  return _WholesalerEntity.fromJson(json);
}

/// @nodoc
mixin _$WholesalerEntity {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String get formula => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this WholesalerEntity to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WholesalerEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WholesalerEntityCopyWith<WholesalerEntity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WholesalerEntityCopyWith<$Res> {
  factory $WholesalerEntityCopyWith(
    WholesalerEntity value,
    $Res Function(WholesalerEntity) then,
  ) = _$WholesalerEntityCopyWithImpl<$Res, WholesalerEntity>;
  @useResult
  $Res call({
    String id,
    String name,
    String currency,
    String formula,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class _$WholesalerEntityCopyWithImpl<$Res, $Val extends WholesalerEntity>
    implements $WholesalerEntityCopyWith<$Res> {
  _$WholesalerEntityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WholesalerEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? currency = null,
    Object? formula = null,
    Object? metadata = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            name: null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                      as String,
            currency: null == currency
                ? _value.currency
                : currency // ignore: cast_nullable_to_non_nullable
                      as String,
            formula: null == formula
                ? _value.formula
                : formula // ignore: cast_nullable_to_non_nullable
                      as String,
            metadata: freezed == metadata
                ? _value.metadata
                : metadata // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WholesalerEntityImplCopyWith<$Res>
    implements $WholesalerEntityCopyWith<$Res> {
  factory _$$WholesalerEntityImplCopyWith(
    _$WholesalerEntityImpl value,
    $Res Function(_$WholesalerEntityImpl) then,
  ) = __$$WholesalerEntityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String name,
    String currency,
    String formula,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class __$$WholesalerEntityImplCopyWithImpl<$Res>
    extends _$WholesalerEntityCopyWithImpl<$Res, _$WholesalerEntityImpl>
    implements _$$WholesalerEntityImplCopyWith<$Res> {
  __$$WholesalerEntityImplCopyWithImpl(
    _$WholesalerEntityImpl _value,
    $Res Function(_$WholesalerEntityImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WholesalerEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? currency = null,
    Object? formula = null,
    Object? metadata = freezed,
  }) {
    return _then(
      _$WholesalerEntityImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        currency: null == currency
            ? _value.currency
            : currency // ignore: cast_nullable_to_non_nullable
                  as String,
        formula: null == formula
            ? _value.formula
            : formula // ignore: cast_nullable_to_non_nullable
                  as String,
        metadata: freezed == metadata
            ? _value._metadata
            : metadata // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WholesalerEntityImpl implements _WholesalerEntity {
  const _$WholesalerEntityImpl({
    required this.id,
    required this.name,
    required this.currency,
    required this.formula,
    final Map<String, dynamic>? metadata,
  }) : _metadata = metadata;

  factory _$WholesalerEntityImpl.fromJson(Map<String, dynamic> json) =>
      _$$WholesalerEntityImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String currency;
  @override
  final String formula;
  final Map<String, dynamic>? _metadata;
  @override
  Map<String, dynamic>? get metadata {
    final value = _metadata;
    if (value == null) return null;
    if (_metadata is EqualUnmodifiableMapView) return _metadata;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  String toString() {
    return 'WholesalerEntity(id: $id, name: $name, currency: $currency, formula: $formula, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WholesalerEntityImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.formula, formula) || other.formula == formula) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    name,
    currency,
    formula,
    const DeepCollectionEquality().hash(_metadata),
  );

  /// Create a copy of WholesalerEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WholesalerEntityImplCopyWith<_$WholesalerEntityImpl> get copyWith =>
      __$$WholesalerEntityImplCopyWithImpl<_$WholesalerEntityImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WholesalerEntityImplToJson(this);
  }
}

abstract class _WholesalerEntity implements WholesalerEntity {
  const factory _WholesalerEntity({
    required final String id,
    required final String name,
    required final String currency,
    required final String formula,
    final Map<String, dynamic>? metadata,
  }) = _$WholesalerEntityImpl;

  factory _WholesalerEntity.fromJson(Map<String, dynamic> json) =
      _$WholesalerEntityImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String get currency;
  @override
  String get formula;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of WholesalerEntity
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WholesalerEntityImplCopyWith<_$WholesalerEntityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
