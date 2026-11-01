import 'geo_point.dart';

/// Pure Dart geographic bounding box defined by south-west and north-east coordinates.
class BoundingBox {
  /// The south-western corner of the bounding box.
  final GeoPoint southWest;

  /// The north-eastern corner of the bounding box.
  final GeoPoint northEast;

  /// Creates a [BoundingBox] with strict coordinate bounds validation (§6, §39).
  ///
  /// Throws [ArgumentError] if [southWest.latitude] is strictly greater than [northEast.latitude].
  BoundingBox({required this.southWest, required this.northEast}) {
    if (southWest.latitude > northEast.latitude) {
      throw ArgumentError.value(
        southWest.latitude,
        'southWest.latitude',
        'South-west latitude cannot be greater than north-east latitude (${northEast.latitude}).',
      );
    }
  }

  /// Returns `true` if [point] is contained inside this bounding box.
  bool contains(GeoPoint point) {
    final bool inLat =
        point.latitude >= southWest.latitude &&
        point.latitude <= northEast.latitude;
    final bool inLon = southWest.longitude <= northEast.longitude
        ? (point.longitude >= southWest.longitude &&
              point.longitude <= northEast.longitude)
        : (point.longitude >= southWest.longitude ||
              point.longitude <= northEast.longitude);
    return inLat && inLon;
  }

  /// Calculates the geographical center point of the bounding box.
  GeoPoint get center {
    final double midLat = (southWest.latitude + northEast.latitude) / 2.0;
    double midLon;
    if (southWest.longitude <= northEast.longitude) {
      midLon = (southWest.longitude + northEast.longitude) / 2.0;
    } else {
      midLon = (southWest.longitude + northEast.longitude + 360.0) / 2.0;
      if (midLon > 180.0) midLon -= 360.0;
    }
    return GeoPoint(midLat, midLon);
  }

  /// Deserializes a [BoundingBox] from a JSON map.
  factory BoundingBox.fromJson(Map<String, dynamic> json) {
    final dynamic sw = json['southWest'];
    final dynamic ne = json['northEast'];
    if (sw is! Map<String, dynamic> || ne is! Map<String, dynamic>) {
      throw ArgumentError(
        'BoundingBox JSON must contain "southWest" and "northEast" objects.',
      );
    }
    return BoundingBox(
      southWest: GeoPoint.fromJson(sw),
      northEast: GeoPoint.fromJson(ne),
    );
  }

  /// Serializes the bounding box to a standard JSON map.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'southWest': southWest.toJson(),
    'northEast': northEast.toJson(),
  };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BoundingBox &&
          runtimeType == other.runtimeType &&
          southWest == other.southWest &&
          northEast == other.northEast;

  @override
  int get hashCode => Object.hash(southWest, northEast);

  @override
  String toString() =>
      'BoundingBox(southWest: $southWest, northEast: $northEast)';
}
