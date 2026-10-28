// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ingestion_source_record.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

IngestionSourceRecord _$IngestionSourceRecordFromJson(
  Map<String, dynamic> json,
) {
  return _IngestionSourceRecord.fromJson(json);
}

/// @nodoc
mixin _$IngestionSourceRecord {
  String get id => throw _privateConstructorUsedError;
  String get contentHash => throw _privateConstructorUsedError;
  String get rawContent => throw _privateConstructorUsedError;
  String get providerId => throw _privateConstructorUsedError;
  DateTime get acquiredAt => throw _privateConstructorUsedError;
  IngestionSourceStatus get status => throw _privateConstructorUsedError;
  String? get catalogPartId => throw _privateConstructorUsedError;
  String? get errorLog => throw _privateConstructorUsedError;
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;

  /// Serializes this IngestionSourceRecord to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of IngestionSourceRecord
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $IngestionSourceRecordCopyWith<IngestionSourceRecord> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $IngestionSourceRecordCopyWith<$Res> {
  factory $IngestionSourceRecordCopyWith(
    IngestionSourceRecord value,
    $Res Function(IngestionSourceRecord) then,
  ) = _$IngestionSourceRecordCopyWithImpl<$Res, IngestionSourceRecord>;
  @useResult
  $Res call({
    String id,
    String contentHash,
    String rawContent,
    String providerId,
    DateTime acquiredAt,
    IngestionSourceStatus status,
    String? catalogPartId,
    String? errorLog,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class _$IngestionSourceRecordCopyWithImpl<
  $Res,
  $Val extends IngestionSourceRecord
>
    implements $IngestionSourceRecordCopyWith<$Res> {
  _$IngestionSourceRecordCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of IngestionSourceRecord
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? contentHash = null,
    Object? rawContent = null,
    Object? providerId = null,
    Object? acquiredAt = null,
    Object? status = null,
    Object? catalogPartId = freezed,
    Object? errorLog = freezed,
    Object? metadata = freezed,
  }) {
    return _then(
      _value.copyWith(
            id: null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                      as String,
            contentHash: null == contentHash
                ? _value.contentHash
                : contentHash // ignore: cast_nullable_to_non_nullable
                      as String,
            rawContent: null == rawContent
                ? _value.rawContent
                : rawContent // ignore: cast_nullable_to_non_nullable
                      as String,
            providerId: null == providerId
                ? _value.providerId
                : providerId // ignore: cast_nullable_to_non_nullable
                      as String,
            acquiredAt: null == acquiredAt
                ? _value.acquiredAt
                : acquiredAt // ignore: cast_nullable_to_non_nullable
                      as DateTime,
            status: null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                      as IngestionSourceStatus,
            catalogPartId: freezed == catalogPartId
                ? _value.catalogPartId
                : catalogPartId // ignore: cast_nullable_to_non_nullable
                      as String?,
            errorLog: freezed == errorLog
                ? _value.errorLog
                : errorLog // ignore: cast_nullable_to_non_nullable
                      as String?,
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
abstract class _$$IngestionSourceRecordImplCopyWith<$Res>
    implements $IngestionSourceRecordCopyWith<$Res> {
  factory _$$IngestionSourceRecordImplCopyWith(
    _$IngestionSourceRecordImpl value,
    $Res Function(_$IngestionSourceRecordImpl) then,
  ) = __$$IngestionSourceRecordImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String contentHash,
    String rawContent,
    String providerId,
    DateTime acquiredAt,
    IngestionSourceStatus status,
    String? catalogPartId,
    String? errorLog,
    Map<String, dynamic>? metadata,
  });
}

/// @nodoc
class __$$IngestionSourceRecordImplCopyWithImpl<$Res>
    extends
        _$IngestionSourceRecordCopyWithImpl<$Res, _$IngestionSourceRecordImpl>
    implements _$$IngestionSourceRecordImplCopyWith<$Res> {
  __$$IngestionSourceRecordImplCopyWithImpl(
    _$IngestionSourceRecordImpl _value,
    $Res Function(_$IngestionSourceRecordImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of IngestionSourceRecord
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? contentHash = null,
    Object? rawContent = null,
    Object? providerId = null,
    Object? acquiredAt = null,
    Object? status = null,
    Object? catalogPartId = freezed,
    Object? errorLog = freezed,
    Object? metadata = freezed,
  }) {
    return _then(
      _$IngestionSourceRecordImpl(
        id: null == id
            ? _value.id
            : id // ignore: cast_nullable_to_non_nullable
                  as String,
        contentHash: null == contentHash
            ? _value.contentHash
            : contentHash // ignore: cast_nullable_to_non_nullable
                  as String,
        rawContent: null == rawContent
            ? _value.rawContent
            : rawContent // ignore: cast_nullable_to_non_nullable
                  as String,
        providerId: null == providerId
            ? _value.providerId
            : providerId // ignore: cast_nullable_to_non_nullable
                  as String,
        acquiredAt: null == acquiredAt
            ? _value.acquiredAt
            : acquiredAt // ignore: cast_nullable_to_non_nullable
                  as DateTime,
        status: null == status
            ? _value.status
            : status // ignore: cast_nullable_to_non_nullable
                  as IngestionSourceStatus,
        catalogPartId: freezed == catalogPartId
            ? _value.catalogPartId
            : catalogPartId // ignore: cast_nullable_to_non_nullable
                  as String?,
        errorLog: freezed == errorLog
            ? _value.errorLog
            : errorLog // ignore: cast_nullable_to_non_nullable
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
class _$IngestionSourceRecordImpl implements _IngestionSourceRecord {
  const _$IngestionSourceRecordImpl({
    required this.id,
    required this.contentHash,
    required this.rawContent,
    required this.providerId,
    required this.acquiredAt,
    required this.status,
    this.catalogPartId,
    this.errorLog,
    final Map<String, dynamic>? metadata,
  }) : _metadata = metadata;

  factory _$IngestionSourceRecordImpl.fromJson(Map<String, dynamic> json) =>
      _$$IngestionSourceRecordImplFromJson(json);

  @override
  final String id;
  @override
  final String contentHash;
  @override
  final String rawContent;
  @override
  final String providerId;
  @override
  final DateTime acquiredAt;
  @override
  final IngestionSourceStatus status;
  @override
  final String? catalogPartId;
  @override
  final String? errorLog;
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
    return 'IngestionSourceRecord(id: $id, contentHash: $contentHash, rawContent: $rawContent, providerId: $providerId, acquiredAt: $acquiredAt, status: $status, catalogPartId: $catalogPartId, errorLog: $errorLog, metadata: $metadata)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$IngestionSourceRecordImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.contentHash, contentHash) ||
                other.contentHash == contentHash) &&
            (identical(other.rawContent, rawContent) ||
                other.rawContent == rawContent) &&
            (identical(other.providerId, providerId) ||
                other.providerId == providerId) &&
            (identical(other.acquiredAt, acquiredAt) ||
                other.acquiredAt == acquiredAt) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.catalogPartId, catalogPartId) ||
                other.catalogPartId == catalogPartId) &&
            (identical(other.errorLog, errorLog) ||
                other.errorLog == errorLog) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    contentHash,
    rawContent,
    providerId,
    acquiredAt,
    status,
    catalogPartId,
    errorLog,
    const DeepCollectionEquality().hash(_metadata),
  );

  /// Create a copy of IngestionSourceRecord
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$IngestionSourceRecordImplCopyWith<_$IngestionSourceRecordImpl>
  get copyWith =>
      __$$IngestionSourceRecordImplCopyWithImpl<_$IngestionSourceRecordImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$IngestionSourceRecordImplToJson(this);
  }
}

abstract class _IngestionSourceRecord implements IngestionSourceRecord {
  const factory _IngestionSourceRecord({
    required final String id,
    required final String contentHash,
    required final String rawContent,
    required final String providerId,
    required final DateTime acquiredAt,
    required final IngestionSourceStatus status,
    final String? catalogPartId,
    final String? errorLog,
    final Map<String, dynamic>? metadata,
  }) = _$IngestionSourceRecordImpl;

  factory _IngestionSourceRecord.fromJson(Map<String, dynamic> json) =
      _$IngestionSourceRecordImpl.fromJson;

  @override
  String get id;
  @override
  String get contentHash;
  @override
  String get rawContent;
  @override
  String get providerId;
  @override
  DateTime get acquiredAt;
  @override
  IngestionSourceStatus get status;
  @override
  String? get catalogPartId;
  @override
  String? get errorLog;
  @override
  Map<String, dynamic>? get metadata;

  /// Create a copy of IngestionSourceRecord
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$IngestionSourceRecordImplCopyWith<_$IngestionSourceRecordImpl>
  get copyWith => throw _privateConstructorUsedError;
}
