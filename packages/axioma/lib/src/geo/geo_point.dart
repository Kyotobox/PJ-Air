/// Pure Dart immutable representation of a geographic coordinate point (WGS 84).
class GeoPoint {
  /// Latitude in degrees (-90.0 to 90.0).
  final double latitude;

  /// Longitude in degrees (-180.0 to 180.0).
  final double longitude;

  /// Creates a [GeoPoint] with strict domain boundary validation (§6, §39).
  ///
  /// Throws [ArgumentError] if [latitude] or [longitude] is NaN, infinite,
  /// or out of their respective valid geographic ranges.
  GeoPoint(this.latitude, this.longitude) {
    if (latitude.isNaN ||
        latitude.isInfinite ||
        latitude < -90.0 ||
        latitude > 90.0) {
      throw ArgumentError.value(
        latitude,
        'latitude',
        'Latitude must be a valid number between -90.0 and 90.0 degrees.',
      );
    }
    if (longitude.isNaN ||
        longitude.isInfinite ||
        longitude < -180.0 ||
        longitude > 180.0) {
      throw ArgumentError.value(
        longitude,
        'longitude',
        'Longitude must be a valid number between -180.0 and 180.0 degrees.',
      );
    }
  }

  /// Deserializes a [GeoPoint] from JSON map.
  factory GeoPoint.fromJson(Map<String, dynamic> json) {
    final double? lat = (json['latitude'] as num?)?.toDouble();
    final double? lon = (json['longitude'] as num?)?.toDouble();

    if (lat == null) {
      throw ArgumentError(
        'Missing required field "latitude" in GeoPoint JSON.',
      );
    }
    if (lon == null) {
      throw ArgumentError(
        'Missing required field "longitude" in GeoPoint JSON.',
      );
    }

    return GeoPoint(lat, lon);
  }

  /// Serializes the point to standard JSON map.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'latitude': latitude,
    'longitude': longitude,
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GeoPoint &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude;

  @override
  int get hashCode => Object.hash(latitude, longitude);

  @override
  String toString() => 'GeoPoint(lat: $latitude, lon: $longitude)';
}
