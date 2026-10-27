// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'asset_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

AssetEntity _$AssetEntityFromJson(Map<String, dynamic> json) {
  return _AssetEntity.fromJson(json);
}

/// @nodoc
mixin _$AssetEntity {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get category => throw _privateConstructorUsedError;
  AssetStatus get status => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this AssetEntity to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AssetEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AssetEntityCopyWith<AssetEntity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AssetEntityCopyWith<$Res> {
  factory $AssetEntityCopyWith(
    AssetEntity value,
    $Res Function(AssetEntity) then,
  ) = _$AssetEntityCopyWithImpl<$Res, AssetEntity>;
  @useResult
  $Res call({
    String id,
    String name,
    String category,
    AssetStatus status,
    DateTime createdAt,
    String? description,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class _$AssetEntityCopyWithImpl<$Res, $Val extends AssetEntity>
    implements $AssetEntityCopyWith<$Res> {
  _$AssetEntityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AssetEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? category = null,
    Object? status = null,
    Object? createdAt = null,
    Object? description = freezed,
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
        category: null == category
            ? _value.category
            : category // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as AssetStatus,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        metadata: freezed == metadata
            ? _value.metadata
            : metadata // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
      ) as $Val,
    );
  }
}

/// @nodoc
abstract class _$$AssetEntityImplCopyWith<$Res>
    implements $AssetEntityCopyWith<$Res> {
  factory _$$AssetEntityImplCopyWith(
    _$AssetEntityImpl value,
    $Res Function(_$AssetEntityImpl) then,
  ) = __$$AssetEntityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String name,
    String category,
    AssetStatus status,
    DateTime createdAt,
    String? description,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class __$$AssetEntityImplCopyWithImpl<$Res>
    extends _$AssetEntityCopyWithImpl<$Res, _$AssetEntityImpl>
    implements _$$AssetEntityImplCopyWith<$Res> {
  __$$AssetEntityImplCopyWithImpl(
    _$AssetEntityImpl _value,
    $Res Function(_$AssetEntityImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AssetEntity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? category = null,
    Object? status = null,
    Object? createdAt = null,
    Object? description = freezed,
    Object? metadata = freezed,
  }) {
    return _then(
      _$AssetEntityImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        category: null == category
            ? _value.category
            : category // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as AssetStatus,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
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
class _$AssetEntityImpl implements _AssetEntity {
  const _$AssetEntityImpl({
    required this.id,
    required this.name,
    required this.category,
    required this.status,
    required this.createdAt,
    this.description,
    Map<String, dynamic>? metadata,
  }) : _metadata = metadata;

  factory _$AssetEntityImpl.fromJson(Map<String, dynamic> json) =>
      _$$AssetEntityImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String category;
  @override
  final AssetStatus status;
  @override
  final DateTime createdAt;
  @override
  final String? description;
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
    return 'AssetEntity(id: $id, name: $name, category: $category, status: $status, createdAt: $createdAt, description: $description, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AssetEntityImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.description, description) ||
                other.description == description) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    name,
    category,
    status,
    createdAt,
    description,
    const DeepCollectionEquality().hash(_metadata),
  );

  /// Create a copy of AssetEntity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AssetEntityImplCopyWith<_$AssetEntityImpl> get copyWith =>
      __$$AssetEntityImplCopyWithImpl<_$AssetEntityImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AssetEntityImplToJson(this);
  }
}

abstract class _AssetEntity implements AssetEntity {
  const factory _AssetEntity({
    required String id,
    required String name,
    required String category,
    required AssetStatus status,
    required DateTime createdAt,
    String? description,
    Map<String, dynamic>? metadata,
  }) = _$AssetEntityImpl;

  factory _AssetEntity.fromJson(Map<String, dynamic> json) =
      _$AssetEntityImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String get category;
  @override
  AssetStatus get status;
  @override
  DateTime get createdAt;
  @override
  String? get description;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of AssetEntity
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AssetEntityImplCopyWith<_$AssetEntityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
