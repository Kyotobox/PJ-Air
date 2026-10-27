// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'catalog_part.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CatalogPart _$CatalogPartFromJson(Map<String, dynamic> json) {
  return _CatalogPart.fromJson(json);
}

/// @nodoc
mixin _$CatalogPart {
  String get id => throw _privateConstructorUsedError;
  String get sku => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get brand => throw _privateConstructorUsedError;
  double? get price => throw _privateConstructorUsedError;
  String get categoryId => throw _privateConstructorUsedError;
  CatalogPartStatus get status => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  List<FitmentEntity> get fitments => throw _privateConstructorUsedError;
  List<String> get tags => throw _privateConstructorUsedError;
  String? get code2 => throw _privateConstructorUsedError;
  String? get description2 => throw _privateConstructorUsedError;
  String? get sourceHash => throw _privateConstructorUsedError;
  String? get fitmentHash => throw _privateConstructorUsedError;
  DateTime? get lastCertifiedAt => throw _privateConstructorUsedError;
  List<String>? get crossReferences => throw _privateConstructorUsedError;
  Map<String, dynamic>? get techSpecs => throw _privateConstructorUsedError;
  String? get imageRef => throw _privateConstructorUsedError;
  String? get wholesalerId => throw _privateConstructorUsedError;
  String? get originalRaw => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this CatalogPart to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CatalogPart
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CatalogPartCopyWith<CatalogPart> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CatalogPartCopyWith<$Res> {
  factory $CatalogPartCopyWith(
    CatalogPart value,
    $Res Function(CatalogPart) then,
  ) = _$CatalogPartCopyWithImpl<$Res, CatalogPart>;
  @useResult
  $Res call({
    String id,
    String sku,
    String name,
    String brand,
    double? price,
    String categoryId,
    CatalogPartStatus status,
    DateTime createdAt,
    List<FitmentEntity> fitments,
    List<String> tags,
    String? code2,
    String? description2,
    String? sourceHash,
    String? fitmentHash,
    DateTime? lastCertifiedAt,
    List<String>? crossReferences,
    Map<String, dynamic>? techSpecs,
    String? imageRef,
    String? wholesalerId,
    String? originalRaw,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class _$CatalogPartCopyWithImpl<$Res, $Val extends CatalogPart>
    implements $CatalogPartCopyWith<$Res> {
  _$CatalogPartCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CatalogPart
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sku = null,
    Object? name = null,
    Object? brand = null,
    Object? price = freezed,
    Object? categoryId = null,
    Object? status = null,
    Object? createdAt = null,
    Object? fitments = null,
    Object? tags = null,
    Object? code2 = freezed,
    Object? description2 = freezed,
    Object? sourceHash = freezed,
    Object? fitmentHash = freezed,
    Object? lastCertifiedAt = freezed,
    Object? crossReferences = freezed,
    Object? techSpecs = freezed,
    Object? imageRef = freezed,
    Object? wholesalerId = freezed,
    Object? originalRaw = freezed,
    Object? metadata = freezed,
  }) {
    return _then(
      _value.copyWith(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        sku: null == sku
            ? _value.sku
            : sku // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        brand: null == brand
            ? _value.brand
            : brand // ignore: cast_nullable_to_non_nullable
                  as String,
        price: freezed == price
            ? _value.price
            : price // ignore: cast_nullable_to_non_nullable
                  as double?,
        categoryId: null == categoryId
            ? _value.categoryId
            : categoryId // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as CatalogPartStatus,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        fitments: null == fitments
            ? _value.fitments
            : fitments // ignore: cast_nullable_to_non_nullable
                  as List<FitmentEntity>,
        tags: null == tags
            ? _value.tags
            : tags // ignore: cast_nullable_to_non_nullable
                  as List<String>,
        code2: freezed == code2
            ? _value.code2
            : code2 // ignore: cast_nullable_to_non_nullable
                  as String?,
        description2: freezed == description2
            ? _value.description2
            : description2 // ignore: cast_nullable_to_non_nullable
                  as String?,
        sourceHash: freezed == sourceHash
            ? _value.sourceHash
            : sourceHash // ignore: cast_nullable_to_non_nullable
                  as String?,
        fitmentHash: freezed == fitmentHash
            ? _value.fitmentHash
            : fitmentHash // ignore: cast_nullable_to_non_nullable
                  as String?,
        lastCertifiedAt: freezed == lastCertifiedAt
            ? _value.lastCertifiedAt
            : lastCertifiedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        crossReferences: freezed == crossReferences
            ? _value.crossReferences
            : crossReferences // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
        techSpecs: freezed == techSpecs
            ? _value.techSpecs
            : techSpecs // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        imageRef: freezed == imageRef
            ? _value.imageRef
            : imageRef // ignore: cast_nullable_to_non_nullable
                  as String?,
        wholesalerId: freezed == wholesalerId
            ? _value.wholesalerId
            : wholesalerId // ignore: cast_nullable_to_non_nullable
                  as String?,
        originalRaw: freezed == originalRaw
            ? _value.originalRaw
            : originalRaw // ignore: cast_nullable_to_non_nullable
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
abstract class _$$CatalogPartImplCopyWith<$Res>
    implements $CatalogPartCopyWith<$Res> {
  factory _$$CatalogPartImplCopyWith(
    _$CatalogPartImpl value,
    $Res Function(_$CatalogPartImpl) then,
  ) = __$$CatalogPartImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String sku,
    String name,
    String brand,
    double? price,
    String categoryId,
    CatalogPartStatus status,
    DateTime createdAt,
    List<FitmentEntity> fitments,
    List<String> tags,
    String? code2,
    String? description2,
    String? sourceHash,
    String? fitmentHash,
    DateTime? lastCertifiedAt,
    List<String>? crossReferences,
    Map<String, dynamic>? techSpecs,
    String? imageRef,
    String? wholesalerId,
    String? originalRaw,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class __$$CatalogPartImplCopyWithImpl<$Res>
    extends _$CatalogPartCopyWithImpl<$Res, _$CatalogPartImpl>
    implements _$$CatalogPartImplCopyWith<$Res> {
  __$$CatalogPartImplCopyWithImpl(
    _$CatalogPartImpl _value,
    $Res Function(_$CatalogPartImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CatalogPart
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? sku = null,
    Object? name = null,
    Object? brand = null,
    Object? price = freezed,
    Object? categoryId = null,
    Object? status = null,
    Object? createdAt = null,
    Object? fitments = null,
    Object? tags = null,
    Object? code2 = freezed,
    Object? description2 = freezed,
    Object? sourceHash = freezed,
    Object? fitmentHash = freezed,
    Object? lastCertifiedAt = freezed,
    Object? crossReferences = freezed,
    Object? techSpecs = freezed,
    Object? imageRef = freezed,
    Object? wholesalerId = freezed,
    Object? originalRaw = freezed,
    Object? metadata = freezed,
  }) {
    return _then(
      _$CatalogPartImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        sku: null == sku
            ? _value.sku
            : sku // ignore: cast_nullable_to_non_nullable
                  as String,
        name: null == name
            ? _value.name
            : name // ignore: cast_nullable_to_non_nullable
                  as String,
        brand: null == brand
            ? _value.brand
            : brand // ignore: cast_nullable_to_non_nullable
                  as String,
        price: freezed == price
            ? _value.price
            : price // ignore: cast_nullable_to_non_nullable
                  as double?,
        categoryId: null == categoryId
            ? _value.categoryId
            : categoryId // ignore: cast_nullable_to_non_nullable
                  as String,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as CatalogPartStatus,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        fitments: null == fitments
            ? _value._fitments
            : fitments // ignore: cast_nullable_to_non_nullable
                  as List<FitmentEntity>,
        tags: null == tags
            ? _value._tags
            : tags // ignore: cast_nullable_to_non_nullable
                  as List<String>,
        code2: freezed == code2
            ? _value.code2
            : code2 // ignore: cast_nullable_to_non_nullable
                  as String?,
        description2: freezed == description2
            ? _value.description2
            : description2 // ignore: cast_nullable_to_non_nullable
                  as String?,
        sourceHash: freezed == sourceHash
            ? _value.sourceHash
            : sourceHash // ignore: cast_nullable_to_non_nullable
                  as String?,
        fitmentHash: freezed == fitmentHash
            ? _value.fitmentHash
            : fitmentHash // ignore: cast_nullable_to_non_nullable
                  as String?,
        lastCertifiedAt: freezed == lastCertifiedAt
            ? _value.lastCertifiedAt
            : lastCertifiedAt // ignore: cast_nullable_to_non_nullable
                  as DateTime?,
        crossReferences: freezed == crossReferences
            ? _value._crossReferences
            : crossReferences // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
        techSpecs: freezed == techSpecs
            ? _value._techSpecs
            : techSpecs // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
        imageRef: freezed == imageRef
            ? _value.imageRef
            : imageRef // ignore: cast_nullable_to_non_nullable
                  as String?,
        wholesalerId: freezed == wholesalerId
            ? _value.wholesalerId
            : wholesalerId // ignore: cast_nullable_to_non_nullable
                  as String?,
        originalRaw: freezed == originalRaw
            ? _value.originalRaw
            : originalRaw // ignore: cast_nullable_to_non_nullable
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
class _$CatalogPartImpl implements _CatalogPart {
  const _$CatalogPartImpl({
    required this.id,
    required this.sku,
    required this.name,
    required this.brand,
    required this.price,
    required this.categoryId,
    required this.status,
    required this.createdAt,
    required List<FitmentEntity> fitments,
    required List<String> tags,
    this.code2,
    this.description2,
    this.sourceHash,
    this.fitmentHash,
    this.lastCertifiedAt,
    List<String>? crossReferences,
    Map<String, dynamic>? techSpecs,
    this.imageRef,
    this.wholesalerId,
    this.originalRaw,
    Map<String, dynamic>? metadata,
  }) : _fitments = fitments,
       _tags = tags,
       _crossReferences = crossReferences,
       _techSpecs = techSpecs,
       _metadata = metadata;

  factory _$CatalogPartImpl.fromJson(Map<String, dynamic> json) =>
      _$$CatalogPartImplFromJson(json);

  @override
  final String id;
  @override
  final String sku;
  @override
  final String name;
  @override
  final String brand;
  @override
  final double? price;
  @override
  final String categoryId;
  @override
  final CatalogPartStatus status;
  @override
  final DateTime createdAt;
  final List<FitmentEntity> _fitments;
  @override
  List<FitmentEntity> get fitments {
    if (_fitments is EqualUnmodifiableListView) return _fitments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_fitments);
  }

  final List<String> _tags;
  @override
  List<String> get tags {
    if (_tags is EqualUnmodifiableListView) return _tags;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tags);
  }

  @override
  final String? code2;
  @override
  final String? description2;
  @override
  final String? sourceHash;
  @override
  final String? fitmentHash;
  @override
  final DateTime? lastCertifiedAt;
  final List<String>? _crossReferences;
  @override
  List<String>? get crossReferences {
    final value = _crossReferences;
    if (value == null) return null;
    if (_crossReferences is EqualUnmodifiableListView) return _crossReferences;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  final Map<String, dynamic>? _techSpecs;
  @override
  Map<String, dynamic>? get techSpecs {
    final value = _techSpecs;
    if (value == null) return null;
    if (_techSpecs is EqualUnmodifiableMapView) return _techSpecs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  final String? imageRef;
  @override
  final String? wholesalerId;
  @override
  final String? originalRaw;
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
    return 'CatalogPart(id: $id, sku: $sku, name: $name, brand: $brand, price: $price, categoryId: $categoryId, status: $status, createdAt: $createdAt, fitments: $fitments, tags: $tags, code2: $code2, description2: $description2, sourceHash: $sourceHash, fitmentHash: $fitmentHash, lastCertifiedAt: $lastCertifiedAt, crossReferences: $crossReferences, techSpecs: $techSpecs, imageRef: $imageRef, wholesalerId: $wholesalerId, originalRaw: $originalRaw, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CatalogPartImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.brand, brand) || other.brand == brand) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.categoryId, categoryId) ||
                other.categoryId == categoryId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            const DeepCollectionEquality().equals(other._fitments, _fitments) &&
            const DeepCollectionEquality().equals(other._tags, _tags) &&
            (identical(other.code2, code2) || other.code2 == code2) &&
            (identical(other.description2, description2) ||
                other.description2 == description2) &&
            (identical(other.sourceHash, sourceHash) ||
                other.sourceHash == sourceHash) &&
            (identical(other.fitmentHash, fitmentHash) ||
                other.fitmentHash == fitmentHash) &&
            (identical(other.lastCertifiedAt, lastCertifiedAt) ||
                other.lastCertifiedAt == lastCertifiedAt) &&
            const DeepCollectionEquality().equals(
              other._crossReferences,
              _crossReferences,
            ) &&
            const DeepCollectionEquality().equals(
              other._techSpecs,
              _techSpecs,
            ) &&
            (identical(other.imageRef, imageRef) ||
                other.imageRef == imageRef) &&
            (identical(other.wholesalerId, wholesalerId) ||
                other.wholesalerId == wholesalerId) &&
            (identical(other.originalRaw, originalRaw) ||
                other.originalRaw == originalRaw) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
    runtimeType,
    id,
    sku,
    name,
    brand,
    price,
    categoryId,
    status,
    createdAt,
    const DeepCollectionEquality().hash(_fitments),
    const DeepCollectionEquality().hash(_tags),
    code2,
    description2,
    sourceHash,
    fitmentHash,
    lastCertifiedAt,
    const DeepCollectionEquality().hash(_crossReferences),
    const DeepCollectionEquality().hash(_techSpecs),
    imageRef,
    wholesalerId,
    originalRaw,
    const DeepCollectionEquality().hash(_metadata),
  ]);

  /// Create a copy of CatalogPart
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CatalogPartImplCopyWith<_$CatalogPartImpl> get copyWith =>
      __$$CatalogPartImplCopyWithImpl<_$CatalogPartImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CatalogPartImplToJson(this);
  }
}

abstract class _CatalogPart implements CatalogPart {
  const factory _CatalogPart({
    required String id,
    required String sku,
    required String name,
    required String brand,
    required double? price,
    required String categoryId,
    required CatalogPartStatus status,
    required DateTime createdAt,
    required List<FitmentEntity> fitments,
    required List<String> tags,
    String? code2,
    String? description2,
    String? sourceHash,
    String? fitmentHash,
    DateTime? lastCertifiedAt,
    List<String>? crossReferences,
    Map<String, dynamic>? techSpecs,
    String? imageRef,
    String? wholesalerId,
    String? originalRaw,
    Map<String, dynamic>? metadata,
  }) = _$CatalogPartImpl;

  factory _CatalogPart.fromJson(Map<String, dynamic> json) =
      _$CatalogPartImpl.fromJson;

  @override
  String get id;
  @override
  String get sku;
  @override
  String get name;
  @override
  String get brand;
  @override
  double? get price;
  @override
  String get categoryId;
  @override
  CatalogPartStatus get status;
  @override
  DateTime get createdAt;
  @override
  List<FitmentEntity> get fitments;
  @override
  List<String> get tags;
  @override
  String? get code2;
  @override
  String? get description2;
  @override
  String? get sourceHash;
  @override
  String? get fitmentHash;
  @override
  DateTime? get lastCertifiedAt;
  @override
  List<String>? get crossReferences;
  @override
  Map<String, dynamic>? get techSpecs;
  @override
  String? get imageRef;
  @override
  String? get wholesalerId;
  @override
  String? get originalRaw;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of CatalogPart
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CatalogPartImplCopyWith<_$CatalogPartImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
