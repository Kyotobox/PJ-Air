import 'dart:convert';
import 'dart:io';

/// Módulo de Cuarentena y Registro de Excepciones de Compatibilidad.
///
/// Registra las combinaciones marca:modelo extraídas de las descripciones o metadatos
/// que no han sido reconocidas por la Golden SSOT para su posterior análisis nocturno.
class QuarantineService {
  final String filePath;

  QuarantineService({
    this.filePath = 'vault/runtime/quarantine_exceptions.json',
  });

  /// Registra una excepción de compatibilidad rechazada por la Golden SSOT.
  /// Evita duplicados basándose en partId (SKU), make y model.
  void register({
    required String partId,
    required String make,
    required String model,
    required String description,
    String? category,
  }) {
    try {
      final File file = File(filePath);
      List<dynamic> exceptions = <dynamic>[];

      if (file.existsSync()) {
        final String content = file.readAsStringSync().trim();
        if (content.isNotEmpty) {
          try {
            exceptions = jsonDecode(content) as List<dynamic>;
          } catch (_) {
            // Si el archivo está corrupto, inicializamos vacío
            exceptions = <dynamic>[];
          }
        }
      } else {
        // Asegurar que el directorio padre existe
        file.parent.createSync(recursive: true);
      }

      final String normalizedPartId = partId.trim();
      final String normalizedMake = make.toUpperCase().trim();
      final String normalizedModel = model.toLowerCase().trim();

      // Buscar duplicado exacto
      final bool exists = exceptions.any((item) {
        if (item is Map) {
          final String itemPart = (item['partId'] ?? '').toString().trim();
          final String itemMake = (item['make'] ?? '')
              .toString()
              .toUpperCase()
              .trim();
          final String itemModel = (item['model'] ?? '')
              .toString()
              .toLowerCase()
              .trim();
          return itemPart == normalizedPartId &&
              itemMake == normalizedMake &&
              itemModel == normalizedModel;
        }
        return false;
      });

      if (!exists) {
        exceptions.add(<String, String?>{
          'partId': normalizedPartId,
          'make': normalizedMake,
          'model': normalizedModel,
          'description': description.trim(),
          'category': category?.trim(),
          'timestamp': DateTime.now().toUtc().toIso8601String(),
        });
        // Escribir con formato JSON indentado
        const JsonEncoder encoder = JsonEncoder.withIndent('  ');
        file.writeAsStringSync(encoder.convert(exceptions));
      }
    } catch (_) {
      // Registrar silenciosamente en producción, o propagar en test
    }
  }

  /// Limpia todas las excepciones registradas (ej. para pruebas o reinicio).
  void clear() {
    try {
      final File file = File(filePath);
      if (file.existsSync()) {
        file.deleteSync();
      }
    } catch (_) {}
  }
}
