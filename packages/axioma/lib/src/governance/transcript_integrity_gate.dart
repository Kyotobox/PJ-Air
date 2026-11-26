// packages/axioma/lib/src/governance/transcript_integrity_gate.dart
// (§4, §6, §39, §48, §50, §60.7)
//
// Validador determinista Pure Dart de Integridad de Transcripts con Cuarentena Atómica y Excepción Tipada.
library;

import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import '../platform_guard.dart';

/// Catálogo de tipos de corrupción o degradación física de un transcript (§6, §60.7).
enum TranscriptCorruptionType {
  /// El archivo existe pero tiene 0 bytes o solo espacios en blanco.
  empty,

  /// El archivo fue truncado abruptamente al final (última línea incompleta / JSON cortado).
  truncated,

  /// Una o más líneas intermedias contienen JSON sintácticamente inválido o caracteres corruptos.
  invalidJsonl,

  /// El checksum SHA-256 computado no coincide con el hash criptográfico esperado.
  checksumMismatch,

  /// El archivo transcript no existe físicamente en disco.
  notFound,

  /// Error del sistema de archivos al acceder o leer el archivo.
  ioError,
}

/// Excepción tipada de gobernanza arrojada ante fallas de integridad de transcripts (§4, §6, §60.7).
class TranscriptIntegrityException implements Exception {
  final String message;
  final String transcriptPath;
  final TranscriptCorruptionType corruptionType;
  final String? quarantinedPath;
  final String? expectedChecksum;
  final String? actualChecksum;
  final int? invalidLineNumber;
  final int exitCode;

  const TranscriptIntegrityException(
    this.message, {
    required this.transcriptPath,
    required this.corruptionType,
    this.quarantinedPath,
    this.expectedChecksum,
    this.actualChecksum,
    this.invalidLineNumber,
    this.exitCode = 1,
  });

  @override
  String toString() =>
      'TranscriptIntegrityException(type: ${corruptionType.name}, exitCode: $exitCode): $message '
      '[File: $transcriptPath'
      '${invalidLineNumber != null ? ', Line: $invalidLineNumber' : ''}'
      '${actualChecksum != null ? ', SHA256: $actualChecksum' : ''}'
      '${expectedChecksum != null ? ', Expected: $expectedChecksum' : ''}'
      '${quarantinedPath != null ? ', Quarantined: $quarantinedPath' : ''}]';
}

/// Resultado sellado de la evaluación de integridad de transcript (§39, Pure Dart).
sealed class TranscriptIntegrityResult {
  final String transcriptPath;
  final bool isValid;
  final int lineCount;
  final int byteSize;
  final String sha256Checksum;

  const TranscriptIntegrityResult({
    required this.transcriptPath,
    required this.isValid,
    required this.lineCount,
    required this.byteSize,
    required this.sha256Checksum,
  });
}

/// Transcripción con integridad física y sintáctica certificada (§4, SSSoT Física).
final class TranscriptIntegrityValid extends TranscriptIntegrityResult {
  const TranscriptIntegrityValid({
    required super.transcriptPath,
    required super.lineCount,
    required super.byteSize,
    required super.sha256Checksum,
  }) : super(isValid: true);

  @override
  String toString() =>
      'TranscriptIntegrityValid(path: $transcriptPath, lines: $lineCount, bytes: $byteSize, sha256: $sha256Checksum)';
}

/// Transcripción corrupta, truncada o degradada físicamente (§6, Sad Path tipado).
final class TranscriptIntegrityCorrupt extends TranscriptIntegrityResult {
  final TranscriptCorruptionType corruptionType;
  final String reason;
  final String? quarantinedPath;
  final int? invalidLineNumber;
  final String? expectedChecksum;

  const TranscriptIntegrityCorrupt({
    required super.transcriptPath,
    required super.lineCount,
    required super.byteSize,
    required super.sha256Checksum,
    required this.corruptionType,
    required this.reason,
    this.quarantinedPath,
    this.invalidLineNumber,
    this.expectedChecksum,
  }) : super(isValid: false);

  @override
  String toString() =>
      'TranscriptIntegrityCorrupt(type: ${corruptionType.name}, reason: $reason, path: $transcriptPath, quarantined: $quarantinedPath)';
}

/// Compuerta de Integridad de Transcripts con Cuarentena Atómica (§4, §6, §39, §60.7).
///
/// Valida el cierre JSONL de archivos transcript.jsonl y la consistencia de su checksum criptográfico.
/// Ante detección de truncamiento, vaciado o corrupción física, aísla atómicamente el activo a
/// `vault/quarantine/corrupt_transcripts/` y arroja [TranscriptIntegrityException] en modo estricto.
class TranscriptIntegrityGate {
  /// Subdirectorio estándar canónico de cuarentena para transcripts corruptos en la flota.
  static const String kDefaultQuarantineSubdir =
      'vault/quarantine/corrupt_transcripts';

  final String? workspaceRoot;
  final String? defaultQuarantinePath;
  final SupportedPlatform? platform;
  final p.Context? pathContext;

  const TranscriptIntegrityGate({
    this.workspaceRoot,
    this.defaultQuarantinePath,
    this.platform,
    this.pathContext,
  });

  /// Computa el hash SHA-256 en formato hexadecimal minúsculo para un buffer de bytes.
  static String computeSha256(List<int> bytes) {
    return sha256.convert(bytes).toString().toLowerCase();
  }

  /// Normaliza y resuelve el directorio de cuarentena canónico (§4, Multi-OS).
  Directory resolveQuarantineDirectory({
    String? overrideQuarantineDir,
    String? overrideWorkspaceRoot,
  }) {
    if (overrideQuarantineDir != null &&
        overrideQuarantineDir.trim().isNotEmpty) {
      return Directory(overrideQuarantineDir.trim());
    }
    if (defaultQuarantinePath != null &&
        defaultQuarantinePath!.trim().isNotEmpty) {
      return Directory(defaultQuarantinePath!.trim());
    }

    final String root =
        overrideWorkspaceRoot ?? workspaceRoot ?? Directory.current.path;
    final p.Context ctx = pathContext ?? p.context;
    final String target = ctx.joinAll(<String>[
      root,
      'vault',
      'quarantine',
      'corrupt_transcripts',
    ]);
    return Directory(target);
  }

  /// Aísla atómicamente el archivo corrupto hacia el directorio de cuarentena (§4, §48).
  ///
  /// Crea el directorio si no existe, reubica físicamente el archivo con nombre sellado
  /// por timestamp y tipo de corrupción, erradicando locks huérfanos.
  String isolateToQuarantine(
    File sourceFile, {
    required TranscriptCorruptionType corruptionType,
    String? conversationId,
    String? overrideQuarantineDir,
    String? overrideWorkspaceRoot,
  }) {
    final Directory qDir = resolveQuarantineDirectory(
      overrideQuarantineDir: overrideQuarantineDir,
      overrideWorkspaceRoot: overrideWorkspaceRoot,
    );
    if (!qDir.existsSync()) {
      qDir.createSync(recursive: true);
    }

    final p.Context ctx = pathContext ?? p.context;
    final String baseName =
        conversationId != null && conversationId.trim().isNotEmpty
        ? conversationId.trim()
        : ctx.basenameWithoutExtension(sourceFile.path);

    final String ext = ctx.extension(sourceFile.path).isNotEmpty
        ? ctx.extension(sourceFile.path)
        : '.jsonl';

    final int timestamp = DateTime.now().toUtc().millisecondsSinceEpoch;
    final String targetFilename =
        '${baseName}_${timestamp}_${corruptionType.name}$ext';
    final String targetPath = ctx.join(qDir.path, targetFilename);
    final File targetFile = File(targetPath);

    // Movimiento atómico: rename con fallback a copy + delete
    try {
      sourceFile.renameSync(targetFile.path);
    } on FileSystemException {
      if (sourceFile.existsSync()) {
        targetFile.writeAsBytesSync(sourceFile.readAsBytesSync());
        sourceFile.deleteSync();
      }
    } catch (_) {
      if (sourceFile.existsSync()) {
        targetFile.writeAsBytesSync(sourceFile.readAsBytesSync());
        sourceFile.deleteSync();
      }
    }

    return targetPath;
  }

  /// Valida la integridad física y sintáctica de un archivo [transcriptFile] en disco.
  ///
  /// - [expectedSha256]: Hash SHA-256 esperado opcional para validación criptográfica.
  /// - [quarantineOnCorruption]: Si es true (default), reubica el archivo corrupto a cuarentena.
  /// - [strict]: Si es true (default), arroja [TranscriptIntegrityException] ante anomalías.
  /// - [conversationId]: Identificador opcional de conversación para el sellado de cuarentena.
  TranscriptIntegrityResult validateFile(
    File transcriptFile, {
    String? expectedSha256,
    bool quarantineOnCorruption = true,
    String? quarantineDirectory,
    String? workspaceRoot,
    bool strict = true,
    String? conversationId,
  }) {
    // 1. Verificación de existencia física (§4, SSSoT Física)
    if (!transcriptFile.existsSync()) {
      final String reason =
          'El archivo transcript no existe físicamente en disco: ${transcriptFile.path}';
      if (strict) {
        throw TranscriptIntegrityException(
          reason,
          transcriptPath: transcriptFile.path,
          corruptionType: TranscriptCorruptionType.notFound,
          exitCode: 2,
        );
      }
      return TranscriptIntegrityCorrupt(
        transcriptPath: transcriptFile.path,
        lineCount: 0,
        byteSize: 0,
        sha256Checksum: '',
        corruptionType: TranscriptCorruptionType.notFound,
        reason: reason,
      );
    }

    // 2. Lectura de bytes y cálculo de tamaño
    final List<int> bytes;
    try {
      bytes = transcriptFile.readAsBytesSync();
    } on FileSystemException catch (e) {
      final String reason = 'Error de I/O al leer transcript: ${e.message}';
      if (strict) {
        throw TranscriptIntegrityException(
          reason,
          transcriptPath: transcriptFile.path,
          corruptionType: TranscriptCorruptionType.ioError,
          exitCode: 1,
        );
      }
      return TranscriptIntegrityCorrupt(
        transcriptPath: transcriptFile.path,
        lineCount: 0,
        byteSize: 0,
        sha256Checksum: '',
        corruptionType: TranscriptCorruptionType.ioError,
        reason: reason,
      );
    }

    final int byteSize = bytes.length;
    final String actualSha256 = computeSha256(bytes);

    // 3. Verificación de archivo vacío (0 bytes)
    if (byteSize == 0) {
      String? quarantinedPath;
      if (quarantineOnCorruption) {
        quarantinedPath = isolateToQuarantine(
          transcriptFile,
          corruptionType: TranscriptCorruptionType.empty,
          conversationId: conversationId,
          overrideQuarantineDir: quarantineDirectory,
          overrideWorkspaceRoot: workspaceRoot,
        );
      }

      final String reason =
          'Transcript vacío detectado (0 bytes físicos en disco).';
      if (strict) {
        throw TranscriptIntegrityException(
          reason,
          transcriptPath: transcriptFile.path,
          corruptionType: TranscriptCorruptionType.empty,
          quarantinedPath: quarantinedPath,
          actualChecksum: actualSha256,
          expectedChecksum: expectedSha256,
          exitCode: 1,
        );
      }
      return TranscriptIntegrityCorrupt(
        transcriptPath: transcriptFile.path,
        lineCount: 0,
        byteSize: 0,
        sha256Checksum: actualSha256,
        corruptionType: TranscriptCorruptionType.empty,
        reason: reason,
        quarantinedPath: quarantinedPath,
        expectedChecksum: expectedSha256,
      );
    }

    // 4. Verificación de Checksum Criptográfico (si fue suministrado)
    if (expectedSha256 != null && expectedSha256.trim().isNotEmpty) {
      final String normExpected = expectedSha256.trim().toLowerCase();
      if (actualSha256 != normExpected) {
        String? quarantinedPath;
        if (quarantineOnCorruption) {
          quarantinedPath = isolateToQuarantine(
            transcriptFile,
            corruptionType: TranscriptCorruptionType.checksumMismatch,
            conversationId: conversationId,
            overrideQuarantineDir: quarantineDirectory,
            overrideWorkspaceRoot: workspaceRoot,
          );
        }

        final String reason =
            'Checksum SHA-256 no coincide (Esperado: $normExpected, Calculado: $actualSha256).';
        if (strict) {
          throw TranscriptIntegrityException(
            reason,
            transcriptPath: transcriptFile.path,
            corruptionType: TranscriptCorruptionType.checksumMismatch,
            quarantinedPath: quarantinedPath,
            actualChecksum: actualSha256,
            expectedChecksum: normExpected,
            exitCode: 1,
          );
        }
        return TranscriptIntegrityCorrupt(
          transcriptPath: transcriptFile.path,
          lineCount: 0,
          byteSize: byteSize,
          sha256Checksum: actualSha256,
          corruptionType: TranscriptCorruptionType.checksumMismatch,
          reason: reason,
          quarantinedPath: quarantinedPath,
          expectedChecksum: normExpected,
        );
      }
    }

    // 5. Decodificación UTF-8 segura
    final String content;
    try {
      content = utf8.decode(bytes, allowMalformed: false);
    } on FormatException catch (e) {
      String? quarantinedPath;
      if (quarantineOnCorruption) {
        quarantinedPath = isolateToQuarantine(
          transcriptFile,
          corruptionType: TranscriptCorruptionType.invalidJsonl,
          conversationId: conversationId,
          overrideQuarantineDir: quarantineDirectory,
          overrideWorkspaceRoot: workspaceRoot,
        );
      }

      final String reason =
          'Codificación UTF-8 corrupta o inválida: ${e.message}';
      if (strict) {
        throw TranscriptIntegrityException(
          reason,
          transcriptPath: transcriptFile.path,
          corruptionType: TranscriptCorruptionType.invalidJsonl,
          quarantinedPath: quarantinedPath,
          actualChecksum: actualSha256,
          exitCode: 1,
        );
      }
      return TranscriptIntegrityCorrupt(
        transcriptPath: transcriptFile.path,
        lineCount: 0,
        byteSize: byteSize,
        sha256Checksum: actualSha256,
        corruptionType: TranscriptCorruptionType.invalidJsonl,
        reason: reason,
        quarantinedPath: quarantinedPath,
      );
    }

    // 6. Análisis y Cierre JSONL línea por línea
    // Soporte transparente para CRLF y LF (§39, Multi-OS)
    final List<String> rawLines = content.split('\n');
    final List<String> lines = <String>[];
    for (int i = 0; i < rawLines.length; i++) {
      String l = rawLines[i];
      if (l.endsWith('\r')) {
        l = l.substring(0, l.length - 1);
      }
      // Omitir la última línea si es un salto final estándar
      if (i == rawLines.length - 1 && l.isEmpty) {
        continue;
      }
      lines.add(l);
    }

    if (lines.isEmpty || lines.every((String l) => l.trim().isEmpty)) {
      String? quarantinedPath;
      if (quarantineOnCorruption) {
        quarantinedPath = isolateToQuarantine(
          transcriptFile,
          corruptionType: TranscriptCorruptionType.empty,
          conversationId: conversationId,
          overrideQuarantineDir: quarantineDirectory,
          overrideWorkspaceRoot: workspaceRoot,
        );
      }

      final String reason =
          'Transcript sin registros JSONL válidos (solo líneas en blanco).';
      if (strict) {
        throw TranscriptIntegrityException(
          reason,
          transcriptPath: transcriptFile.path,
          corruptionType: TranscriptCorruptionType.empty,
          quarantinedPath: quarantinedPath,
          actualChecksum: actualSha256,
          exitCode: 1,
        );
      }
      return TranscriptIntegrityCorrupt(
        transcriptPath: transcriptFile.path,
        lineCount: 0,
        byteSize: byteSize,
        sha256Checksum: actualSha256,
        corruptionType: TranscriptCorruptionType.empty,
        reason: reason,
        quarantinedPath: quarantinedPath,
      );
    }

    for (int i = 0; i < lines.length; i++) {
      final String line = lines[i];
      final int lineNumber = i + 1;
      final bool isLastLine = i == lines.length - 1;

      if (line.trim().isEmpty) {
        // Línea vacía intermedia no admisible en JSONL estricto
        String? quarantinedPath;
        if (quarantineOnCorruption) {
          quarantinedPath = isolateToQuarantine(
            transcriptFile,
            corruptionType: isLastLine
                ? TranscriptCorruptionType.truncated
                : TranscriptCorruptionType.invalidJsonl,
            conversationId: conversationId,
            overrideQuarantineDir: quarantineDirectory,
            overrideWorkspaceRoot: workspaceRoot,
          );
        }

        final String reason =
            'Línea vacía o nula no permitida en registro JSONL (Línea $lineNumber).';
        final TranscriptCorruptionType cType = isLastLine
            ? TranscriptCorruptionType.truncated
            : TranscriptCorruptionType.invalidJsonl;

        if (strict) {
          throw TranscriptIntegrityException(
            reason,
            transcriptPath: transcriptFile.path,
            corruptionType: cType,
            quarantinedPath: quarantinedPath,
            actualChecksum: actualSha256,
            invalidLineNumber: lineNumber,
            exitCode: 1,
          );
        }
        return TranscriptIntegrityCorrupt(
          transcriptPath: transcriptFile.path,
          lineCount: i,
          byteSize: byteSize,
          sha256Checksum: actualSha256,
          corruptionType: cType,
          reason: reason,
          quarantinedPath: quarantinedPath,
          invalidLineNumber: lineNumber,
        );
      }

      dynamic parsed;
      String? decodeError;
      try {
        parsed = jsonDecode(line);
        if (parsed is! Map<String, dynamic>) {
          decodeError = 'El registro JSONL debe ser un objeto JSON';
        }
      } on FormatException catch (e) {
        decodeError = e.message;
      }

      if (decodeError != null) {
        // Si la última línea falla, es truncamiento por crash o corte en escritura.
        // Si una línea intermedia falla, es corrupción sintáctica.
        final TranscriptCorruptionType cType = isLastLine
            ? TranscriptCorruptionType.truncated
            : TranscriptCorruptionType.invalidJsonl;

        String? quarantinedPath;
        if (quarantineOnCorruption) {
          quarantinedPath = isolateToQuarantine(
            transcriptFile,
            corruptionType: cType,
            conversationId: conversationId,
            overrideQuarantineDir: quarantineDirectory,
            overrideWorkspaceRoot: workspaceRoot,
          );
        }

        final String reason = isLastLine
            ? 'Cierre JSONL trunco o incompleto en última línea $lineNumber: $decodeError'
            : 'Sintaxis JSON corrupta en línea $lineNumber: $decodeError';

        if (strict) {
          throw TranscriptIntegrityException(
            reason,
            transcriptPath: transcriptFile.path,
            corruptionType: cType,
            quarantinedPath: quarantinedPath,
            actualChecksum: actualSha256,
            invalidLineNumber: lineNumber,
            exitCode: 1,
          );
        }
        return TranscriptIntegrityCorrupt(
          transcriptPath: transcriptFile.path,
          lineCount: i,
          byteSize: byteSize,
          sha256Checksum: actualSha256,
          corruptionType: cType,
          reason: reason,
          quarantinedPath: quarantinedPath,
          invalidLineNumber: lineNumber,
        );
      }
    }

    // 7. Certificación de éxito (Happy Path)
    return TranscriptIntegrityValid(
      transcriptPath: transcriptFile.path,
      lineCount: lines.length,
      byteSize: byteSize,
      sha256Checksum: actualSha256,
    );
  }

  /// Valida un transcript a partir de su ruta en String.
  TranscriptIntegrityResult validatePath(
    String filePath, {
    String? expectedSha256,
    bool quarantineOnCorruption = true,
    String? quarantineDirectory,
    String? workspaceRoot,
    bool strict = true,
    String? conversationId,
  }) {
    return validateFile(
      File(filePath),
      expectedSha256: expectedSha256,
      quarantineOnCorruption: quarantineOnCorruption,
      quarantineDirectory: quarantineDirectory,
      workspaceRoot: workspaceRoot,
      strict: strict,
      conversationId: conversationId,
    );
  }

  /// Método estático de conveniencia con strict: true (§4, §6).
  ///
  /// Arroja [TranscriptIntegrityException] ante cualquier anomalía o retorna [TranscriptIntegrityValid].
  static TranscriptIntegrityValid requireValid(
    File transcriptFile, {
    String? expectedSha256,
    bool quarantineOnCorruption = true,
    String? quarantineDirectory,
    String? workspaceRoot,
    String? conversationId,
  }) {
    const TranscriptIntegrityGate gate = TranscriptIntegrityGate();
    final TranscriptIntegrityResult result = gate.validateFile(
      transcriptFile,
      expectedSha256: expectedSha256,
      quarantineOnCorruption: quarantineOnCorruption,
      quarantineDirectory: quarantineDirectory,
      workspaceRoot: workspaceRoot,
      strict: true,
      conversationId: conversationId,
    );
    return result as TranscriptIntegrityValid;
  }

  /// Evalúa la integridad de un transcript resolviéndolo canónicamente por ID de conversación (§39, Art. Multi-OS).
  TranscriptIntegrityResult validateConversation(
    String conversationId, {
    String? expectedSha256,
    bool quarantineOnCorruption = true,
    String? quarantineDirectory,
    String? workspaceRoot,
    bool strict = true,
    String? overrideHome,
    String? brainPath,
  }) {
    final TranscriptResolutionResult res = PlatformGuard.resolveTranscript(
      conversationId: conversationId,
      overrideHome: overrideHome,
      brainPath: brainPath,
      platform: platform,
      pathContext: pathContext,
    );

    switch (res) {
      case TranscriptResolved(:final String path):
        return validatePath(
          path,
          expectedSha256: expectedSha256,
          quarantineOnCorruption: quarantineOnCorruption,
          quarantineDirectory: quarantineDirectory,
          workspaceRoot: workspaceRoot,
          strict: strict,
          conversationId: conversationId,
        );
      case TranscriptDegraded(:final String reason):
        if (strict) {
          throw TranscriptIntegrityException(
            'No se pudo resolver transcript para $conversationId: $reason',
            transcriptPath: '',
            corruptionType: TranscriptCorruptionType.notFound,
            exitCode: 2,
          );
        }
        return TranscriptIntegrityCorrupt(
          transcriptPath: '',
          lineCount: 0,
          byteSize: 0,
          sha256Checksum: '',
          corruptionType: TranscriptCorruptionType.notFound,
          reason: reason,
        );
    }
  }
}
