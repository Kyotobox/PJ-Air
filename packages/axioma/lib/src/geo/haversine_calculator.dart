import 'dart:math' as math;
import 'geo_point.dart';

/// Mean radius of the Earth in kilometers (WGS 84 approximation).
const double kEarthRadiusKm = 6371.0;

/// Mean radius of the Earth in meters.
const double kEarthRadiusMeters = 6371000.0;

double _degreesToRadians(double degrees) => degrees * (math.pi / 180.0);

/// Calculates the great-circle distance between two [GeoPoint]s using the Haversine formula in kilometers.
///
/// Guaranteed pure Dart calculation without UI dependencies (§39).
double calculateHaversineDistanceKm(GeoPoint p1, GeoPoint p2) {
  if (p1 == p2) return 0.0;

  final double dLat = _degreesToRadians(p2.latitude - p1.latitude);
  final double dLon = _degreesToRadians(p2.longitude - p1.longitude);

  final double lat1 = _degreesToRadians(p1.latitude);
  final double lat2 = _degreesToRadians(p2.latitude);

  final double a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) * math.cos(lat2) * math.sin(dLon / 2) * math.sin(dLon / 2);

  final double clampedA = a.clamp(0.0, 1.0);
  final double c =
      2 * math.atan2(math.sqrt(clampedA), math.sqrt(1.0 - clampedA));

  return kEarthRadiusKm * c;
}

/// Calculates the great-circle distance between two [GeoPoint]s using the Haversine formula in meters.
///
/// Guaranteed pure Dart calculation without UI dependencies (§39).
double calculateHaversineDistanceMeters(GeoPoint p1, GeoPoint p2) {
  if (p1 == p2) return 0.0;

  final double dLat = _degreesToRadians(p2.latitude - p1.latitude);
  final double dLon = _degreesToRadians(p2.longitude - p1.longitude);

  final double lat1 = _degreesToRadians(p1.latitude);
  final double lat2 = _degreesToRadians(p2.latitude);

  final double a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) * math.cos(lat2) * math.sin(dLon / 2) * math.sin(dLon / 2);

  final double clampedA = a.clamp(0.0, 1.0);
  final double c =
      2 * math.atan2(math.sqrt(clampedA), math.sqrt(1.0 - clampedA));

  return kEarthRadiusMeters * c;
}
