import 'dart:collection';
import 'geo_point.dart';

/// Pure Dart deterministic URL builder for Google Maps Static and Street View Static APIs (§39).
class GoogleMapsStaticUrlBuilder {
  GoogleMapsStaticUrlBuilder._();

  static const String _host = 'maps.googleapis.com';
  static const String _streetViewPath = '/maps/api/streetview';
  static const String _staticMapPath = '/maps/api/staticmap';

  /// Builds a deterministic Google Street View Static API URL.
  ///
  /// Either [point] or [address] must be provided.
  /// Throws [ArgumentError] if neither is provided, or if parameters exceed domain limits (§6).
  static Uri buildStreetViewUrl({
    GeoPoint? point,
    String? address,
    int width = 600,
    int height = 400,
    int? fov,
    int? heading,
    int? pitch,
    String? apiKey,
  }) {
    if (point == null && (address == null || address.trim().isEmpty)) {
      throw ArgumentError(
        'Must provide either a valid GeoPoint or non-empty address for Street View Static URL.',
      );
    }
    if (width <= 0 || height <= 0) {
      throw ArgumentError(
        'Width and height must be positive integers (> 0). Received: ${width}x$height.',
      );
    }
    if (fov != null && (fov < 10 || fov > 120)) {
      throw ArgumentError.value(
        fov,
        'fov',
        'Field of view (fov) must be between 10 and 120 degrees.',
      );
    }
    if (heading != null && (heading < 0 || heading > 360)) {
      throw ArgumentError.value(
        heading,
        'heading',
        'Heading must be between 0 and 360 degrees.',
      );
    }
    if (pitch != null && (pitch < -90 || pitch > 90)) {
      throw ArgumentError.value(
        pitch,
        'pitch',
        'Pitch must be between -90 and 90 degrees.',
      );
    }

    final String locationStr = point != null
        ? '${point.latitude},${point.longitude}'
        : address!.trim();

    // Use SplayTreeMap for deterministic, sorted query parameter serialization
    final SplayTreeMap<String, String> params = SplayTreeMap<String, String>();
    if (fov != null) params['fov'] = fov.toString();
    if (heading != null) params['heading'] = heading.toString();
    if (apiKey != null && apiKey.trim().isNotEmpty)
      params['key'] = apiKey.trim();
    params['location'] = locationStr;
    if (pitch != null) params['pitch'] = pitch.toString();
    params['size'] = '${width}x$height';

    return Uri.https(_host, _streetViewPath, params);
  }

  /// Builds a deterministic Google Maps Static API URL.
  ///
  /// Either [center], [address], or [markers] must be provided to define the map view.
  /// Throws [ArgumentError] if view bounds are missing or parameters are invalid (§6).
  static Uri buildStaticMapUrl({
    GeoPoint? center,
    String? address,
    int width = 600,
    int height = 400,
    int? zoom,
    String? mapType,
    List<String>? markers,
    String? apiKey,
  }) {
    final bool hasCenter =
        center != null || (address != null && address.trim().isNotEmpty);
    final bool hasMarkers = markers != null && markers.isNotEmpty;

    if (!hasCenter && !hasMarkers) {
      throw ArgumentError(
        'Must provide center, address, or non-empty markers to define the Static Map view.',
      );
    }
    if (width <= 0 || height <= 0) {
      throw ArgumentError(
        'Width and height must be positive integers (> 0). Received: ${width}x$height.',
      );
    }
    if (zoom != null && (zoom < 0 || zoom > 21)) {
      throw ArgumentError.value(
        zoom,
        'zoom',
        'Zoom level must be an integer between 0 and 21.',
      );
    }
    if (mapType != null) {
      final Set<String> validMapTypes = <String>{
        'roadmap',
        'satellite',
        'terrain',
        'hybrid',
      };
      if (!validMapTypes.contains(mapType.toLowerCase())) {
        throw ArgumentError.value(
          mapType,
          'mapType',
          'Map type must be one of: roadmap, satellite, terrain, hybrid.',
        );
      }
    }

    // Use SplayTreeMap for deterministic canonical parameter ordering
    final SplayTreeMap<String, dynamic> params =
        SplayTreeMap<String, dynamic>();

    if (center != null) {
      params['center'] = '${center.latitude},${center.longitude}';
    } else if (address != null && address.trim().isNotEmpty) {
      params['center'] = address.trim();
    }

    if (apiKey != null && apiKey.trim().isNotEmpty) {
      params['key'] = apiKey.trim();
    }
    if (mapType != null) {
      params['maptype'] = mapType.toLowerCase();
    }
    if (markers != null && markers.isNotEmpty) {
      params['markers'] = markers;
    }
    params['size'] = '${width}x$height';
    if (zoom != null) {
      params['zoom'] = zoom.toString();
    }

    return Uri.https(_host, _staticMapPath, params);
  }
}
