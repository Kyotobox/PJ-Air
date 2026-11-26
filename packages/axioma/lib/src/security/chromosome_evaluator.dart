import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

/// Excepción formal ante alteraciones en la superficie pública de Axioma sin bump de versión (§4, §6, §43, §58)
class AxiomSurfaceDriftException implements Exception {
  final String message;
  final String? file;
  final String? expectedSignature;
  final String? actualSignature;

  AxiomSurfaceDriftException(
    this.message, {
    this.file,
    this.expectedSignature,
    this.actualSignature,
  });

  @override
  String toString() =>
      'AxiomSurfaceDriftException: $message ${file != null ? '($file)' : ''} '
      '${expectedSignature != null ? '[expected: $expectedSignature, actual: $actualSignature]' : ''}';
}

/// Evaluador de Cromosomas y Granularidad de ADN de Axioma (§43, §48, §58)
/// Desacopla la firma criptográfica a la superficie pública exportada.
class AxiomChromosomeEvaluator {
  const AxiomChromosomeEvaluator();

  /// Extrae la lista de archivos exportados públicamente desde axioma.dart y barriles
  List<String> extractExportedPaths(String axiomaLibPath) {
    final barrelFile = File(p.join(axiomaLibPath, 'axioma.dart'));
    if (!barrelFile.existsSync()) return const [];

    final exportedPaths = <String>{barrelFile.path};
    final exportRegex = RegExp(
      r"export\s+['"
      "]([^'"
      "]+)['"
      "]",
    );

    final lines = barrelFile.readAsLinesSync();
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      final match = exportRegex.firstMatch(trimmed);
      if (match != null) {
        final relExport = match.group(1)!;
        final resolved = p.normalize(p.join(axiomaLibPath, relExport));
        if (File(resolved).existsSync()) {
          exportedPaths.add(resolved);
        }
      }
    }

    final sorted = exportedPaths.toList()..sort();
    return sorted;
  }

  /// Calcula el ADN de la superficie pública exportada de Axioma
  Future<String> calculateExportedSurfaceDNA({
    required String axiomaBasePath,
  }) async {
    final axiomaLib = Directory(p.join(axiomaBasePath, 'lib'));
    if (!axiomaLib.existsSync()) return '';

    final exportedFiles = extractExportedPaths(axiomaLib.path);
    if (exportedFiles.isEmpty) return '';

    final hashes = <String>[];
    for (final filePath in exportedFiles) {
      final file = File(filePath);
      if (file.existsSync()) {
        final bytes = await file.readAsBytes();
        final fileHash = sha256.convert(bytes).toString();
        final rel = p.relative(filePath, from: axiomaBasePath);
        hashes.add('$rel:$fileHash');
      }
    }

    if (hashes.isEmpty) return '';

    return sha256
        .convert(utf8.encode(hashes.join('|')))
        .toString()
        .toUpperCase();
  }

  /// Verifica la integridad de la superficie pública con detección de drift espurio
  Future<bool> verifySurfaceIntegrity({
    required String axiomaBasePath,
    required String expectedSignature,
    String currentVersion = '5.6.2',
    String? declaredVersion,
  }) async {
    final currentDNA = await calculateExportedSurfaceDNA(
      axiomaBasePath: axiomaBasePath,
    );
    final expected = expectedSignature.trim().toUpperCase();

    if (currentDNA != expected) {
      // Si la firma no coincide y no hubo bump de versión, lanza excepción tipada (§6, §43, §58)
      if (declaredVersion != null && currentVersion == declaredVersion) {
        throw AxiomSurfaceDriftException(
          'Se detectó alteración en la superficie pública exportada de packages/axioma sin el correspondiente bump de versión SemVer (§43, §58).',
          file: 'packages/axioma/lib/axioma.dart',
          expectedSignature: expected,
          actualSignature: currentDNA,
        );
      }
      return false;
    }

    return true;
  }
}
