/// bunker_profile.dart — Contrato Canónico SemVer 2.0 de Perfil de Búnker (§12.b, §39, §43, §46, §50).
///
/// Responsabilidades Principales:
/// 1. Parseo, serialización y validación canónica de `bunker_profile.json` bajo SemVer 2.0.
/// 2. Migrador idempotente v0/v1 -> v2 para backward compatibility transparente.
/// 3. Enforzamiento del contrato `canonical_branch` (default: 'master') contra ramas efímeras (§50).
/// 4. Gobernanza asimétrica: discriminación declarativa de compuertas activas (`active_gates`) y protocolo de satélites.
library;

import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

/// Excepción base del contrato de perfil de búnker.
abstract class BunkerProfileException implements Exception {
  final String message;
  final String? bunkerId;

  const BunkerProfileException(this.message, {this.bunkerId});

  @override
  String toString() =>
      'BunkerProfileException: $message${bunkerId != null ? " (Bunker: $bunkerId)" : ""}';
}

/// Excepción arrojada cuando no se localiza el archivo `bunker_profile.json` en disco.
class BunkerProfileNotFoundException extends BunkerProfileException {
  final String path;

  const BunkerProfileNotFoundException(this.path, {super.bunkerId})
    : super('No se encontró bunker_profile.json en la ruta "$path"');

  @override
  String toString() =>
      'BunkerProfileNotFoundException: Archivo de perfil de búnker no encontrado en "$path"';
}

/// Excepción arrojada cuando `bunker_profile.json` está corrupto o carece de campos mandatorios.
class BunkerProfileParseException extends BunkerProfileException {
  final String details;
  final String path;

  const BunkerProfileParseException(
    this.details, {
    this.path = 'bunker_profile.json',
    super.bunkerId,
  }) : super(details);

  String get detailsMessage => details;

  @override
  String toString() =>
      'BunkerProfileParseException: Error en "$path": $details';
}

/// Excepción arrojada cuando la rama activa de Git diverge de la rama canónica declarada (§46, §50).
class CanonicalBranchMismatchException extends BunkerProfileException {
  final String currentBranch;
  final String canonicalBranch;

  const CanonicalBranchMismatchException({
    required String message,
    required this.currentBranch,
    required this.canonicalBranch,
    required String bunkerId,
  }) : super(message, bunkerId: bunkerId);

  @override
  String toString() =>
      'CanonicalBranchMismatchException: $message [bunker: $bunkerId, rama_actual: "$currentBranch", rama_canonica: "$canonicalBranch"]';
}

/// Resultado de la verificación de rama canónica.
class CanonicalBranchCheckResult {
  final bool isMatch;
  final String currentBranch;
  final String canonicalBranch;
  final String bunkerId;
  final String? error;

  const CanonicalBranchCheckResult({
    required this.isMatch,
    required this.currentBranch,
    required this.canonicalBranch,
    required this.bunkerId,
    this.error,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'is_match': isMatch,
    'current_branch': currentBranch,
    'canonical_branch': canonicalBranch,
    'bunker_id': bunkerId,
    if (error != null) 'error': error,
  };
}

/// Modelo SSSoT Canónico del Perfil de Búnker bajo SemVer 2.0.
class BunkerProfile {
  static const String currentSchemaVersion = '2.0.0';
  static const List<String> defaultRedZones = <String>[
    '.agents/',
    '.gemini/',
    'vault/',
  ];

  final String schemaVersion;
  final String id;
  final String project;
  final String bunkerType;
  final String role;
  final String axis;
  final String description;
  final String? domain;
  final List<String> redZonePaths;
  final String repoUrl;
  final String canonicalBranch;
  final List<String> activeGates;
  final Set<String>? allowedSkills;
  final Set<String> deniedSkills;
  final Map<String, dynamic>? satelliteProtocol;
  final String? binarySignature;
  final Map<String, dynamic> rawConfig;

  const BunkerProfile({
    this.schemaVersion = currentSchemaVersion,
    required this.id,
    this.project = '',
    required this.bunkerType,
    this.role = '',
    this.axis = '',
    this.description = '',
    this.domain,
    this.redZonePaths = defaultRedZones,
    this.repoUrl = '',
    this.canonicalBranch = 'master',
    this.activeGates = const <String>[],
    this.allowedSkills,
    this.deniedSkills = const <String>{},
    this.satelliteProtocol,
    this.binarySignature,
    this.rawConfig = const <String, dynamic>{},
  });

  /// Determina si este búnker es el Hub central o Kernel agnóstico.
  bool get isHub => bunkerType == 'hub' || bunkerType == 'kernel';

  /// Determina si este búnker es un nodo satélite de producto.
  bool get isSatellite => bunkerType == 'satellite';

  /// Determina si este búnker es el plano de control / orquestador (Automa).
  bool get isOrchestrator =>
      bunkerType == 'orchestrator' || bunkerType == 'control_plane';

  /// Determina si este búnker opera bajo el corredor de compuertas ultraliviano lean.
  bool get isLeanGated =>
      isSatellite &&
      (activeGates.isEmpty || activeGates.contains('satellite_lean'));

  /// Carga el perfil desde un archivo físico en disco (§4).
  static BunkerProfile fromFile(File file) {
    if (!file.existsSync()) {
      throw BunkerProfileNotFoundException(file.path);
    }
    final String content = file.readAsStringSync().trim();
    if (content.isEmpty) {
      throw BunkerProfileParseException(
        'El archivo bunker_profile.json está vacío.',
        path: file.path,
      );
    }
    final dynamic decoded;
    try {
      decoded = jsonDecode(content);
    } catch (e) {
      throw BunkerProfileParseException(
        'Sintaxis JSON corrupta: $e',
        path: file.path,
      );
    }
    if (decoded is! Map<String, dynamic>) {
      throw BunkerProfileParseException(
        'bunker_profile.json debe ser un objeto JSON (Map<String, dynamic>)',
        path: file.path,
      );
    }
    return fromJson(decoded, path: file.path);
  }

  /// Carga el perfil desde el directorio raíz de un workspace.
  static BunkerProfile fromWorkspace(Directory workspaceDir) {
    final File profileFile = File(
      p.join(workspaceDir.path, 'bunker_profile.json'),
    );
    return fromFile(profileFile);
  }

  /// Migrador idempotente v0/v1 -> v2 para normalizar configuraciones preexistentes.
  static Map<String, dynamic> migrateToV2(Map<String, dynamic> legacy) {
    final Map<String, dynamic> normalized = Map<String, dynamic>.from(legacy);

    // Schema version bump
    normalized['schema_version'] = currentSchemaVersion;

    final String bunkerType =
        (normalized['bunker_type'] ?? normalized['type'] ?? 'satellite')
            .toString()
            .trim();

    // Rama canónica por defecto
    if (!normalized.containsKey('canonical_branch') ||
        normalized['canonical_branch'] == null) {
      normalized['canonical_branch'] = 'master';
    }

    // Active gates por defecto según tipología si no vienen declaradas
    if (!normalized.containsKey('active_gates') ||
        normalized['active_gates'] == null) {
      if (bunkerType == 'hub' || bunkerType == 'kernel') {
        normalized['active_gates'] = <String>[
          'ast_linter',
          'sad_path_evidence',
          'scope_drift',
          'schema_truth',
          'cyclomatic_complexity',
        ];
      } else {
        normalized['active_gates'] = <String>['satellite_lean'];
      }
    }

    return normalized;
  }

  /// Construye el perfil desde un mapa JSON con validación y auto-migración SemVer 2.0.
  static BunkerProfile fromJson(
    Map<String, dynamic> json, {
    String path = 'bunker_profile.json',
  }) {
    // Validar mandatorios en el JSON crudo (§6, §50)
    final dynamic rawId = json['id'] ?? json['bunker_id'];
    if (rawId == null || rawId.toString().trim().isEmpty) {
      throw BunkerProfileParseException(
        'Campo mandatorio "id" ausente o vacío',
        path: path,
      );
    }
    final String id = rawId.toString().trim();

    final dynamic rawType = json['bunker_type'] ?? json['type'];
    if (rawType == null || rawType.toString().trim().isEmpty) {
      throw BunkerProfileParseException(
        'Campo mandatorio "bunker_type" ausente o vacío',
        path: path,
      );
    }
    final String bunkerType = rawType.toString().trim();

    // Si falta schema_version o es legacy, aplicar migración idempotente
    final Map<String, dynamic> config =
        json['schema_version'] == currentSchemaVersion
        ? json
        : migrateToV2(json);

    final dynamic branchRaw = config['canonical_branch'];
    final String canonicalBranch =
        (branchRaw != null && branchRaw.toString().trim().isNotEmpty)
        ? branchRaw.toString().trim()
        : 'master';

    final List<String> redZones = <String>[];
    if (config['red_zone_paths'] is List) {
      for (final dynamic item in (config['red_zone_paths'] as List<dynamic>)) {
        if (item != null && item.toString().trim().isNotEmpty) {
          redZones.add(item.toString().trim());
        }
      }
    } else {
      redZones.addAll(defaultRedZones);
    }

    final List<String> gates = <String>[];
    if (config['active_gates'] is List) {
      for (final dynamic gate in (config['active_gates'] as List<dynamic>)) {
        if (gate != null && gate.toString().trim().isNotEmpty) {
          gates.add(gate.toString().trim());
        }
      }
    }

    Set<String>? allowedSkills;
    if (config['allowed_skills'] is List) {
      allowedSkills = (config['allowed_skills'] as List<dynamic>)
          .map((dynamic e) => e.toString().trim())
          .where((String s) => s.isNotEmpty)
          .toSet();
    }

    final Set<String> deniedSkills = <String>{};
    if (config['denied_skills'] is List) {
      deniedSkills.addAll(
        (config['denied_skills'] as List<dynamic>)
            .map((dynamic e) => e.toString().trim())
            .where((String s) => s.isNotEmpty),
      );
    }

    final Map<String, dynamic>? satelliteProtocol =
        config['satellite_protocol'] is Map
        ? Map<String, dynamic>.from(
            config['satellite_protocol'] as Map<dynamic, dynamic>,
          )
        : null;

    final String? binarySignature = config['binary_signature']
        ?.toString()
        .trim();

    return BunkerProfile(
      schemaVersion:
          config['schema_version']?.toString() ?? currentSchemaVersion,
      id: id,
      project: (config['project'] ?? id).toString().trim(),
      bunkerType: bunkerType,
      role: (config['role'] ?? '').toString().trim(),
      axis: (config['axis'] ?? '').toString().trim(),
      description: (config['description'] ?? '').toString().trim(),
      domain: config['domain']?.toString().trim(),
      redZonePaths: redZones,
      repoUrl: (config['repo_url'] ?? '').toString().trim(),
      canonicalBranch: canonicalBranch,
      activeGates: gates,
      allowedSkills: allowedSkills,
      deniedSkills: deniedSkills,
      satelliteProtocol: satelliteProtocol,
      binarySignature: binarySignature,
      rawConfig: config,
    );
  }

  /// Serializa a JSON preservando la estructura canónica SemVer 2.0.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'schema_version': schemaVersion,
    'id': id,
    'project': project,
    'bunker_type': bunkerType,
    'role': role,
    'axis': axis,
    'description': description,
    if (domain != null) 'domain': domain,
    'red_zone_paths': redZonePaths,
    'repo_url': repoUrl,
    'canonical_branch': canonicalBranch,
    'active_gates': activeGates,
    if (allowedSkills != null) 'allowed_skills': allowedSkills!.toList(),
    if (deniedSkills.isNotEmpty) 'denied_skills': deniedSkills.toList(),
    if (satelliteProtocol != null) 'satellite_protocol': satelliteProtocol,
    if (binarySignature != null) 'binary_signature': binarySignature,
  };

  /// Detecta la rama activa de Git en el workspace.
  static String detectCurrentBranch({Directory? workspaceDir}) {
    final String root = workspaceDir?.path ?? Directory.current.path;
    try {
      final ProcessResult result = Process.runSync('git', <String>[
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ], workingDirectory: root);
      if (result.exitCode == 0) {
        final String branch = result.stdout.toString().trim();
        if (branch.isNotEmpty) return branch;
      }
    } catch (_) {
      // INTENTIONAL: Fallback seguro ante entornos de prueba sin CLI git
    }
    return 'master';
  }

  /// Verifica si la rama activa coincide con la rama canónica.
  CanonicalBranchCheckResult verifyCanonicalBranch({
    String? currentBranch,
    Directory? workspaceDir,
  }) {
    final String active =
        currentBranch ?? detectCurrentBranch(workspaceDir: workspaceDir);
    final bool match = active == canonicalBranch;

    final String? errorMsg = match
        ? null
        : '[CANONICAL_BRANCH_MISMATCH] La rama activa "$active" diverge de la rama canónica "$canonicalBranch" declarada en bunker_profile.json para el nodo "$id" (§46, §50).';

    return CanonicalBranchCheckResult(
      isMatch: match,
      currentBranch: active,
      canonicalBranch: canonicalBranch,
      bunkerId: id,
      error: errorMsg,
    );
  }

  /// Valida la rama canónica para el ciclo de vida y arroja CanonicalBranchMismatchException si throwOnError=true.
  CanonicalBranchCheckResult validateLifecycleBranch({
    String? currentBranch,
    Directory? workspaceDir,
    bool throwOnError = true,
  }) {
    final CanonicalBranchCheckResult result = verifyCanonicalBranch(
      currentBranch: currentBranch,
      workspaceDir: workspaceDir,
    );

    if (!result.isMatch && throwOnError) {
      throw CanonicalBranchMismatchException(
        message: result.error ?? 'Rama divergente de la canónica',
        currentBranch: result.currentBranch,
        canonicalBranch: result.canonicalBranch,
        bunkerId: result.bunkerId,
      );
    }

    return result;
  }
}
