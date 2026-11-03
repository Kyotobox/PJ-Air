import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;

import '../platform_guard.dart';

/// Tipología formal de un búnker según la arquitectura de la flota (§1, §2).
enum BunkerType {
  kernel('kernel'),
  hub('hub'),
  controlPlane('control_plane'),
  satellite('satellite'),
  shared('shared'),
  unknown('unknown');

  final String value;
  const BunkerType(this.value);

  static BunkerType fromString(String raw) {
    final String normalized = raw.trim().toLowerCase().replaceAll('-', '_');
    for (final BunkerType type in BunkerType.values) {
      if (type.value == normalized || type.name.toLowerCase() == normalized) {
        return type;
      }
    }
    return BunkerType.unknown;
  }

  /// Retorna verdadero si el búnker pertenece a la tríada central o kernel.
  bool get isCoreOrHub => this == BunkerType.kernel || this == BunkerType.hub;

  /// Retorna verdadero si es un satélite periférico de producto.
  bool get isSatellite => this == BunkerType.satellite;
}

/// Categoría funcional de un skill conforme a `vault/contracts/skill_meta.schema.json`.
enum SkillCategory {
  governance('governance'),
  orchestration('orchestration'),
  analysis('analysis'),
  ingestion('ingestion'),
  execution('execution'),
  utility('utility'),
  unknown('unknown');

  final String value;
  const SkillCategory(this.value);

  static SkillCategory fromString(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final SkillCategory cat in SkillCategory.values) {
      if (cat.value == normalized || cat.name.toLowerCase() == normalized) {
        return cat;
      }
    }
    return SkillCategory.unknown;
  }
}

/// Motivo formal y tipado de rechazo de un skill por el filtro dinámico.
enum FilterRejectionReason {
  blockedByPerimeterKernelHub('blocked_by_perimeter_kernel_hub'),
  blockedBySatelliteDomainMismatch('blocked_by_satellite_domain_mismatch'),
  vetoInertPlaceboRule55('veto_inert_placebo_rule_55'),
  explicitBlacklist('explicit_blacklist'),
  notInExplicitWhitelist('not_in_explicit_whitelist'),
  categoryNotAllowed('category_not_allowed'),
  budgetExceeded('budget_exceeded'),
  corruptedMetadata('corrupted_metadata');

  final String code;
  const FilterRejectionReason(this.code);

  static FilterRejectionReason fromString(String raw) {
    final String normalized = raw.trim().toLowerCase();
    for (final FilterRejectionReason r in FilterRejectionReason.values) {
      if (r.code == normalized || r.name.toLowerCase() == normalized) {
        return r;
      }
    }
    throw SkillFilterValidationException(
      'Motivo de rechazo de filtro no reconocido: "$raw"',
    );
  }
}

/// Excepción base para violaciones de perfil de búnker y filtrado de skills.
class BunkerProfileException implements Exception {
  final String message;
  final String? bunkerId;

  const BunkerProfileException(this.message, {this.bunkerId});

  @override
  String toString() =>
      'BunkerProfileException: $message${bunkerId != null ? " (Bunker: $bunkerId)" : ""}';
}

/// Excepción cuando el archivo bunker_profile.json no existe físicamente en disco.
class BunkerProfileNotFoundException extends BunkerProfileException {
  final String path;

  const BunkerProfileNotFoundException(this.path, {super.bunkerId})
    : super('No se encontró bunker_profile.json en la ruta "$path"');

  @override
  String toString() =>
      'BunkerProfileNotFoundException: No se encontró bunker_profile.json en "$path"';
}

/// Excepción cuando el contenido del bunker_profile.json está malformado o viola el esquema.
class BunkerProfileParseException extends BunkerProfileException {
  final String details;

  const BunkerProfileParseException(this.details, {super.bunkerId})
    : super('Error parseando bunker_profile.json: $details');

  @override
  String toString() =>
      'BunkerProfileParseException: Error parseando bunker_profile.json: $details';
}

/// Excepción para fallas de validación en candidatos o reglas de filtrado de skills.
class SkillFilterValidationException implements Exception {
  final String message;
  final String? skillId;

  const SkillFilterValidationException(this.message, {this.skillId});

  @override
  String toString() =>
      'SkillFilterValidationException: $message${skillId != null ? " (Skill: $skillId)" : ""}';
}

/// Modelo canónico del perfil de un búnker soberano (`bunker_profile.json`).
class BunkerProfile {
  static const int defaultMaxInjectedSkills = 7;
  static const int defaultTokenBudgetMax = 500;

  final String id;
  final String project;
  final BunkerType bunkerType;
  final String role;
  final String axis;
  final String? description;
  final String? domain;
  final Set<String>? allowedSkills;
  final Set<String> deniedSkills;
  final Set<SkillCategory>? allowedCategories;
  final List<String> redZonePaths;
  final String? perimeter;
  final int maxInjectedSkills;
  final int tokenBudgetMax;
  final Map<String, dynamic> rawConfig;

  const BunkerProfile({
    required this.id,
    required this.project,
    required this.bunkerType,
    required this.role,
    required this.axis,
    this.description,
    this.domain,
    this.allowedSkills,
    this.deniedSkills = const <String>{},
    this.allowedCategories,
    this.redZonePaths = const <String>['.agents/', '.gemini/', 'vault/'],
    this.perimeter,
    this.maxInjectedSkills = defaultMaxInjectedSkills,
    this.tokenBudgetMax = defaultTokenBudgetMax,
    this.rawConfig = const <String, dynamic>{},
  });

  /// Instancia un perfil a partir de un mapa JSON decodificado.
  factory BunkerProfile.fromJson(Map<String, dynamic> json) {
    final String? id = json['id'] as String? ?? json['project'] as String?;
    if (id == null || id.trim().isEmpty) {
      throw const BunkerProfileParseException(
        'Falta campo requerido "id" o "project".',
      );
    }

    final String project = json['project'] as String? ?? id;
    final String rawType =
        json['bunker_type'] as String? ??
        (id == 'conext_core'
            ? 'kernel'
            : (id == 'Smart'
                  ? 'hub'
                  : (id == 'automa' ? 'control_plane' : 'satellite')));
    final BunkerType bunkerType = BunkerType.fromString(rawType);

    final String role = json['role'] as String? ?? 'UNKNOWN_ROLE';
    final String axis = json['axis'] as String? ?? 'General';
    final String? description = json['description'] as String?;
    final String? domain = json['domain'] as String?;
    final String? perimeter = json['perimeter'] as String?;

    Set<String>? allowedSkills;
    if (json.containsKey('allowed_skills') && json['allowed_skills'] != null) {
      final dynamic rawAllowed = json['allowed_skills'];
      if (rawAllowed is List) {
        allowedSkills = rawAllowed
            .map((dynamic e) => e.toString().trim())
            .toSet();
      }
    }

    final Set<String> deniedSkills = <String>{};
    if (json.containsKey('denied_skills') && json['denied_skills'] != null) {
      final dynamic rawDenied = json['denied_skills'];
      if (rawDenied is List) {
        deniedSkills.addAll(rawDenied.map((dynamic e) => e.toString().trim()));
      }
    }

    Set<SkillCategory>? allowedCategories;
    if (json.containsKey('allowed_categories') &&
        json['allowed_categories'] != null) {
      final dynamic rawCats = json['allowed_categories'];
      if (rawCats is List) {
        allowedCategories = rawCats
            .map((dynamic e) => SkillCategory.fromString(e.toString()))
            .where((SkillCategory c) => c != SkillCategory.unknown)
            .toSet();
      }
    }

    final List<String> redZonePaths = <String>[];
    if (json['red_zone_paths'] is List) {
      redZonePaths.addAll(
        (json['red_zone_paths'] as List<dynamic>).map<String>(
          (dynamic e) => e.toString().trim(),
        ),
      );
    } else {
      redZonePaths.addAll(<String>['.agents/', '.gemini/', 'vault/']);
    }

    final int maxInjectedSkills =
        (json['max_injected_skills'] as num?)?.toInt() ??
        defaultMaxInjectedSkills;
    final int tokenBudgetMax =
        (json['token_budget_max'] as num?)?.toInt() ?? defaultTokenBudgetMax;

    return BunkerProfile(
      id: id.trim(),
      project: project.trim(),
      bunkerType: bunkerType,
      role: role.trim(),
      axis: axis.trim(),
      description: description,
      domain: domain?.trim(),
      allowedSkills: allowedSkills,
      deniedSkills: deniedSkills,
      allowedCategories: allowedCategories,
      redZonePaths: redZonePaths,
      perimeter: perimeter,
      maxInjectedSkills: maxInjectedSkills > 0
          ? maxInjectedSkills
          : defaultMaxInjectedSkills,
      tokenBudgetMax: tokenBudgetMax > 0
          ? tokenBudgetMax
          : defaultTokenBudgetMax,
      rawConfig: json,
    );
  }

  /// Lee y parsea `bunker_profile.json` desde un archivo físico en disco (§4).
  factory BunkerProfile.fromFile(File file) {
    if (!file.existsSync()) {
      throw BunkerProfileNotFoundException(file.path);
    }

    try {
      final String content = file.readAsStringSync().trim();
      if (content.isEmpty) {
        throw const FormatException(
          'El archivo bunker_profile.json está vacío.',
        );
      }
      final dynamic decoded = jsonDecode(content);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException(
          'El archivo no contiene un objeto JSON válido.',
        );
      }
      return BunkerProfile.fromJson(decoded);
    } catch (e) {
      if (e is BunkerProfileException) rethrow;
      throw BunkerProfileParseException(e.toString());
    }
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'project': project,
    'bunker_type': bunkerType.value,
    'role': role,
    'axis': axis,
    if (description != null) 'description': description,
    if (domain != null) 'domain': domain,
    if (allowedSkills != null)
      'allowed_skills': allowedSkills!.toList()..sort(),
    'denied_skills': deniedSkills.toList()..sort(),
    if (allowedCategories != null)
      'allowed_categories':
          allowedCategories!.map((SkillCategory c) => c.value).toList()..sort(),
    'red_zone_paths': redZonePaths,
    if (perimeter != null) 'perimeter': perimeter,
    'max_injected_skills': maxInjectedSkills,
    'token_budget_max': tokenBudgetMax,
  };
}

/// Descriptor de un skill candidato para inyección en el contexto.
class SkillCandidate {
  final String id;
  final String name;
  final String ownerNode;
  final SkillCategory category;
  final String summary;
  final String entrypoint;
  final List<String> tags;
  final bool isQuarantined;
  final bool hasExecutableScripts;
  final int estimatedTokens;
  final Map<String, dynamic> metadata;

  const SkillCandidate({
    required this.id,
    required this.name,
    required this.ownerNode,
    required this.category,
    required this.summary,
    required this.entrypoint,
    this.tags = const <String>[],
    this.isQuarantined = false,
    this.hasExecutableScripts = true,
    required this.estimatedTokens,
    this.metadata = const <String, dynamic>{},
  });

  /// Instancia un descriptor desde un archivo `skill.json` o metadatos de manifiesto.
  factory SkillCandidate.fromSkillJson(
    Map<String, dynamic> json, {
    bool isQuarantined = false,
    bool hasExecutableScripts = true,
    int? estimatedTokens,
  }) {
    final String? id = json['skill_id'] as String? ?? json['id'] as String?;
    if (id == null || id.trim().isEmpty) {
      throw const SkillFilterValidationException(
        'Falta skill_id en metadatos del skill.',
      );
    }

    final String name = json['name'] as String? ?? id;
    final String ownerNode = json['owner_node'] as String? ?? 'Smart';
    final SkillCategory category = SkillCategory.fromString(
      json['category'] as String? ?? 'utility',
    );
    final String summary =
        json['description'] as String? ??
        json['summary'] as String? ??
        'Skill operativo de flota.';
    final String entrypoint =
        json['entrypoint'] as String? ?? '.agents/skills/$id/SKILL.md';

    final List<String> tags = <String>[];
    if (json['tags'] is List) {
      tags.addAll(
        (json['tags'] as List<dynamic>).map<String>(
          (dynamic e) => e.toString().trim(),
        ),
      );
    }

    final int tokens =
        estimatedTokens ??
        ((id.length + name.length + summary.length + tags.join(' ').length) / 4)
                .ceil() +
            10;

    return SkillCandidate(
      id: id.trim(),
      name: name.trim(),
      ownerNode: ownerNode.trim(),
      category: category,
      summary: summary.trim(),
      entrypoint: entrypoint.trim(),
      tags: tags,
      isQuarantined: isQuarantined,
      hasExecutableScripts: hasExecutableScripts,
      estimatedTokens: tokens,
      metadata: json,
    );
  }

  /// Descubre e inspecciona físicamente un directorio de skill (`.agents/skills/<id>/`) (§4, §55).
  factory SkillCandidate.fromDirectory(
    Directory skillDir, {
    PlatformGuard? guard,
  }) {
    final PlatformGuard g = guard ?? PlatformGuard();
    if (!skillDir.existsSync()) {
      throw FileSystemException(
        'Directorio de skill inexistente',
        skillDir.path,
      );
    }

    final String dirName = p.basename(skillDir.path);
    final File skillJsonFile = File(p.join(skillDir.path, 'skill.json'));
    final File skillMdFile = File(p.join(skillDir.path, 'SKILL.md'));
    final Directory scriptsDir = Directory(p.join(skillDir.path, 'scripts'));

    // Inspección física de ejecutables (§55.1)
    bool hasExecutableScripts = false;
    if (scriptsDir.existsSync()) {
      final List<FileSystemEntity> scriptFiles = scriptsDir.listSync();
      hasExecutableScripts = scriptFiles.any((FileSystemEntity f) => f is File);
    }
    final File runSh = File(p.join(skillDir.path, 'run.sh'));
    if (runSh.existsSync()) {
      hasExecutableScripts = true;
    }

    // Comprobar si el directorio reside bajo cuarentena
    final String normPath = g.toForwardSlashes(skillDir.path);
    final bool isQuarantined = normPath.contains('vault/quarantine/');

    if (skillJsonFile.existsSync()) {
      try {
        final dynamic decoded = jsonDecode(skillJsonFile.readAsStringSync());
        if (decoded is Map<String, dynamic>) {
          return SkillCandidate.fromSkillJson(
            decoded,
            isQuarantined: isQuarantined,
            hasExecutableScripts: hasExecutableScripts,
          );
        }
      } catch (_) {
        // Fallback al parser de SKILL.md
      }
    }

    String summary = 'Skill operativo de flota.';
    String name = dirName;
    final List<String> tags = <String>[];

    if (skillMdFile.existsSync()) {
      final String content = skillMdFile.readAsStringSync();
      if (content.startsWith('---')) {
        final int endDelim = content.indexOf('---', 3);
        if (endDelim != -1) {
          final String yaml = content.substring(3, endDelim);
          for (final String line in yaml.split('\n')) {
            final String trimmed = line.trim();
            if (trimmed.startsWith('name:')) {
              name = trimmed.substring(5).trim();
            } else if (trimmed.startsWith('description:')) {
              summary = trimmed.substring(12).trim();
            }
          }
        }
      }
    }

    for (final String part in dirName.split('-')) {
      if (part.isNotEmpty && tags.length < 3) {
        tags.add(part);
      }
    }

    final int tokens =
        ((name.length + summary.length + tags.join(' ').length) / 4).ceil() +
        10;

    return SkillCandidate(
      id: dirName,
      name: name,
      ownerNode: dirName.startsWith('biz-autopart') ? 'ruedas' : 'Smart',
      category: dirName.startsWith('gov-')
          ? SkillCategory.governance
          : SkillCategory.utility,
      summary: summary,
      entrypoint: g.toForwardSlashes(skillMdFile.path),
      tags: tags,
      isQuarantined: isQuarantined,
      hasExecutableScripts: hasExecutableScripts,
      estimatedTokens: tokens,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'name': name,
    'owner_node': ownerNode,
    'category': category.value,
    'summary': summary,
    'entrypoint': entrypoint,
    'tags': tags,
    'estimated_tokens': estimatedTokens,
  };
}

/// Registro atómico de una decisión individual de filtrado.
class SkillFilterDecision {
  final SkillCandidate skill;
  final bool allowed;
  final FilterRejectionReason? rejectionReason;
  final String explanation;

  const SkillFilterDecision({
    required this.skill,
    required this.allowed,
    this.rejectionReason,
    required this.explanation,
  });

  Map<String, dynamic> toJson() => <String, dynamic>{
    'skill_id': skill.id,
    'allowed': allowed,
    'rejection_reason': rejectionReason?.code,
    'explanation': explanation,
  };
}

/// Resultado exhaustivo del filtrado dinámico de contexto.
class BunkerSkillFilterResult {
  final String bunkerId;
  final BunkerType bunkerType;
  final String role;
  final int totalEvaluated;
  final List<SkillCandidate> injectedSkills;
  final List<SkillFilterDecision> decisions;
  final int estimatedTokens;
  final int tokenBudgetMax;
  final bool isWithinBudget;
  final DateTime generatedAt;

  const BunkerSkillFilterResult({
    required this.bunkerId,
    required this.bunkerType,
    required this.role,
    required this.totalEvaluated,
    required this.injectedSkills,
    required this.decisions,
    required this.estimatedTokens,
    required this.tokenBudgetMax,
    required this.isWithinBudget,
    required this.generatedAt,
  });

  /// Construye el bloque markdown renderizado para inyección directa en el prompt del Agente.
  String toContextPromptBlock({
    String blockTag = 'available_skills',
    bool includeTriggers = true,
  }) {
    if (injectedSkills.isEmpty) {
      return '<$blockTag>\n<!-- Sin skills específicos inyectados para el perfil "$bunkerId" -->\n</$blockTag>';
    }

    final StringBuffer buffer = StringBuffer();
    buffer.writeln('<$blockTag>');
    buffer.writeln(
      '<!-- Skills autorizados e inyectados dinámicamente para el búnker "$bunkerId" ($role) -->',
    );
    for (final SkillCandidate s in injectedSkills) {
      final String triggersStr = includeTriggers && s.tags.isNotEmpty
          ? ' [tags: ${s.tags.join(", ")}]'
          : '';
      buffer.writeln('- **${s.id}**: ${s.summary}$triggersStr');
      buffer.writeln('  *Ruta*: `${s.entrypoint}`');
    }
    buffer.writeln('</$blockTag>');
    return buffer.toString().trim();
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'bunker_id': bunkerId,
    'bunker_type': bunkerType.value,
    'role': role,
    'total_evaluated': totalEvaluated,
    'injected_skills': injectedSkills
        .map((SkillCandidate s) => s.toJson())
        .toList(),
    'decisions': decisions.map((SkillFilterDecision d) => d.toJson()).toList(),
    'estimated_tokens': estimatedTokens,
    'token_budget_max': tokenBudgetMax,
    'is_within_budget': isWithinBudget,
    'generated_at': generatedAt.toIso8601String(),
  };

  String toSerializedJson({bool pretty = false}) {
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(toJson());
    }
    return jsonEncode(toJson());
  }
}

/// Motor dinámico de filtrado e inyección de contexto por perfil de búnker (`BunkerSkillFilter`).
/// Conforme a §1 (Identidad), §2 (Perímetro Sónico), §39 (Pure Dart), §45 (Calm UX) y §55 (Blindaje de Skills).
class BunkerSkillFilter {
  final PlatformGuard platformGuard;

  BunkerSkillFilter({PlatformGuard? platformGuard})
    : platformGuard = platformGuard ?? PlatformGuard();

  /// Nodos satélite reconocidos como dominios de producto aislados.
  static const Set<String> knownProductSatellites = <String>{
    'ruedas',
    'praxis',
    'studio',
    'beatme',
    'pj-air',
    'biomech',
    'galeno-java',
    'ProspectAtlas',
  };

  /// Evalúa un conjunto de skills candidatos contra el perfil de un búnker.
  BunkerSkillFilterResult evaluate({
    required BunkerProfile profile,
    required List<SkillCandidate> candidates,
    int? overrideTokenBudget,
    int? overrideMaxSkills,
  }) {
    final int effectiveTokenBudget =
        overrideTokenBudget ?? profile.tokenBudgetMax;
    final int effectiveMaxSkills =
        overrideMaxSkills ?? profile.maxInjectedSkills;

    final List<SkillFilterDecision> decisions = <SkillFilterDecision>[];
    final List<SkillCandidate> passedPreBudget = <SkillCandidate>[];

    for (final SkillCandidate candidate in candidates) {
      final SkillFilterDecision decision = _evaluateSingleCandidate(
        profile: profile,
        candidate: candidate,
      );
      decisions.add(decision);
      if (decision.allowed) {
        passedPreBudget.add(candidate);
      }
    }

    // Priorización determinista para respetar el presupuesto Miller (§44 / §45):
    // 1. Skills propios del nodo (ownerNode == profile.id)
    // 2. Skills de gobernanza
    // 3. Skills de orquestación / utilitarios
    // 4. Orden alfabético
    passedPreBudget.sort((SkillCandidate a, SkillCandidate b) {
      final bool aIsOwn = a.ownerNode.toLowerCase() == profile.id.toLowerCase();
      final bool bIsOwn = b.ownerNode.toLowerCase() == profile.id.toLowerCase();
      if (aIsOwn != bIsOwn) return aIsOwn ? -1 : 1;

      final bool aIsGov = a.category == SkillCategory.governance;
      final bool bIsGov = b.category == SkillCategory.governance;
      if (aIsGov != bIsGov) return aIsGov ? -1 : 1;

      final bool aIsOrch = a.category == SkillCategory.orchestration;
      final bool bIsOrch = b.category == SkillCategory.orchestration;
      if (aIsOrch != bIsOrch) return aIsOrch ? -1 : 1;

      return a.id.compareTo(b.id);
    });

    final List<SkillCandidate> injected = <SkillCandidate>[];
    int accumulatedTokens = 30; // Overhead base de tags xml

    for (int i = 0; i < passedPreBudget.length; i++) {
      final SkillCandidate candidate = passedPreBudget[i];

      // Verificar límite Miller de cantidad de skills
      if (injected.length >= effectiveMaxSkills) {
        final int decisionIdx = decisions.indexWhere(
          (SkillFilterDecision d) => d.skill.id == candidate.id,
        );
        if (decisionIdx != -1) {
          decisions[decisionIdx] = SkillFilterDecision(
            skill: candidate,
            allowed: false,
            rejectionReason: FilterRejectionReason.budgetExceeded,
            explanation:
                'Presupuesto visual Miller excedido (tope: $effectiveMaxSkills skills, §44).',
          );
        }
        continue;
      }

      // Verificar presupuesto de tokens
      final int newTokens = accumulatedTokens + candidate.estimatedTokens;
      if (newTokens > effectiveTokenBudget) {
        final int decisionIdx = decisions.indexWhere(
          (SkillFilterDecision d) => d.skill.id == candidate.id,
        );
        if (decisionIdx != -1) {
          decisions[decisionIdx] = SkillFilterDecision(
            skill: candidate,
            allowed: false,
            rejectionReason: FilterRejectionReason.budgetExceeded,
            explanation:
                'Presupuesto de tokens excedido ($newTokens > $effectiveTokenBudget max tokens, §45).',
          );
        }
        continue;
      }

      accumulatedTokens = newTokens;
      injected.add(candidate);
    }

    return BunkerSkillFilterResult(
      bunkerId: profile.id,
      bunkerType: profile.bunkerType,
      role: profile.role,
      totalEvaluated: candidates.length,
      injectedSkills: injected,
      decisions: decisions,
      estimatedTokens: accumulatedTokens,
      tokenBudgetMax: effectiveTokenBudget,
      isWithinBudget: accumulatedTokens <= effectiveTokenBudget,
      generatedAt: DateTime.now(),
    );
  }

  /// Evalúa si un skill específico individual está permitido para el búnker.
  bool isSkillAllowedForBunker({
    required BunkerProfile profile,
    required SkillCandidate candidate,
  }) {
    final SkillFilterDecision decision = _evaluateSingleCandidate(
      profile: profile,
      candidate: candidate,
    );
    return decision.allowed;
  }

  /// Descubre e inspecciona todos los skills en un directorio físico de skills (§4).
  List<SkillCandidate> discoverSkills({
    required Directory skillsDirectory,
    Directory? quarantineDirectory,
    PlatformGuard? guard,
  }) {
    final PlatformGuard g = guard ?? platformGuard;
    if (!skillsDirectory.existsSync()) {
      throw FileSystemException(
        'Directorio de skills inexistente',
        skillsDirectory.path,
      );
    }

    final List<SkillCandidate> discovered = <SkillCandidate>[];
    final List<Directory> subdirs =
        skillsDirectory.listSync().whereType<Directory>().toList()
          ..sort((Directory a, Directory b) => a.path.compareTo(b.path));

    for (final Directory dir in subdirs) {
      final String dirName = p.basename(dir.path);
      if (dirName.startsWith('.') || dirName == 'node_modules') continue;

      try {
        final SkillCandidate candidate = SkillCandidate.fromDirectory(
          dir,
          guard: g,
        );
        discovered.add(candidate);
      } catch (_) {
        // Ignorar carpetas que no correspondan a un skill
      }
    }

    if (quarantineDirectory != null && quarantineDirectory.existsSync()) {
      final List<Directory> qSubdirs =
          quarantineDirectory.listSync().whereType<Directory>().toList()
            ..sort((Directory a, Directory b) => a.path.compareTo(b.path));

      for (final Directory qDir in qSubdirs) {
        try {
          final SkillCandidate candidate = SkillCandidate.fromDirectory(
            qDir,
            guard: g,
          );
          discovered.add(candidate);
        } catch (_) {
          // Ignorar
        }
      }
    }

    return discovered;
  }

  /// Evalúa automáticamente el búnker inspeccionando su raíz y sus skills locales.
  BunkerSkillFilterResult evaluateForBunkerDirectory({
    required Directory bunkerDirectory,
    Directory? skillsDirectory,
    Directory? quarantineDirectory,
    PlatformGuard? guard,
  }) {
    final PlatformGuard g = guard ?? platformGuard;
    final File profileFile = File(
      p.join(bunkerDirectory.path, 'bunker_profile.json'),
    );
    final BunkerProfile profile = BunkerProfile.fromFile(profileFile);

    final Directory sDir =
        skillsDirectory ??
        Directory(p.join(bunkerDirectory.path, '.agents', 'skills'));
    final Directory qDir =
        quarantineDirectory ??
        Directory(
          p.join(bunkerDirectory.path, 'vault', 'quarantine', 'inert_skills'),
        );

    final List<SkillCandidate> candidates = discoverSkills(
      skillsDirectory: sDir,
      quarantineDirectory: qDir,
      guard: g,
    );

    return evaluate(profile: profile, candidates: candidates);
  }

  /// Lógica de decisión atómica para un candidato individual.
  SkillFilterDecision _evaluateSingleCandidate({
    required BunkerProfile profile,
    required SkillCandidate candidate,
  }) {
    // 1. Compuerta Constitucional §55: Veto a Skills Inertes / Placebos o en Cuarentena
    if (candidate.isQuarantined || !candidate.hasExecutableScripts) {
      return SkillFilterDecision(
        skill: candidate,
        allowed: false,
        rejectionReason: FilterRejectionReason.vetoInertPlaceboRule55,
        explanation:
            'Veto Constitucional §55: El skill carece de scripts ejecutables en scripts/ '
            'o se encuentra aislado en cuarentena.',
      );
    }

    // 2. Lista Negra Explícita del Perfil
    if (profile.deniedSkills.contains(candidate.id)) {
      return SkillFilterDecision(
        skill: candidate,
        allowed: false,
        rejectionReason: FilterRejectionReason.explicitBlacklist,
        explanation:
            'Skill "${candidate.id}" bloqueado explícitamente por "denied_skills" en bunker_profile.json.',
      );
    }

    // 3. Lista Blanca Explícita del Perfil (si está definida)
    if (profile.allowedSkills != null &&
        !profile.allowedSkills!.contains(candidate.id)) {
      return SkillFilterDecision(
        skill: candidate,
        allowed: false,
        rejectionReason: FilterRejectionReason.notInExplicitWhitelist,
        explanation:
            'Skill "${candidate.id}" no está incluido en la lista blanca explícita "allowed_skills".',
      );
    }

    // 4. Restricción de Categorías Permitidas
    if (profile.allowedCategories != null &&
        !profile.allowedCategories!.contains(candidate.category)) {
      return SkillFilterDecision(
        skill: candidate,
        allowed: false,
        rejectionReason: FilterRejectionReason.categoryNotAllowed,
        explanation:
            'La categoría "${candidate.category.value}" no está permitida en este búnker '
            '(Permitidas: ${profile.allowedCategories!.map((SkillCategory c) => c.value).join(", ")}).',
      );
    }

    // 5. Perímetro Sónico para Kernel y Hub (§1, §2)
    // El Core/Hub NO debe ser contaminado con lógicas específicas de productos satélites.
    if (profile.bunkerType.isCoreOrHub) {
      final bool isProductSatelliteOwner = knownProductSatellites.contains(
        candidate.ownerNode.toLowerCase(),
      );
      final bool isPurePlatformCategory =
          candidate.category == SkillCategory.governance ||
          candidate.category == SkillCategory.utility ||
          candidate.category == SkillCategory.orchestration;

      if (isProductSatelliteOwner && !isPurePlatformCategory) {
        return SkillFilterDecision(
          skill: candidate,
          allowed: false,
          rejectionReason: FilterRejectionReason.blockedByPerimeterKernelHub,
          explanation:
              'Perímetro Sónico (§1, §2): Prohibida la inyección de lógicas de producto '
              'satélite ("${candidate.ownerNode}") en el Kernel/Hub central.',
        );
      }
    }

    // 6. Aislamiento Cross-Domain para Satélites (§2, §40)
    // Un satélite no puede recibir skills pertenecientes a otro satélite foráneo
    if (profile.bunkerType.isSatellite) {
      final String candidateOwner = candidate.ownerNode.toLowerCase();
      final String currentBunker = profile.id.toLowerCase();
      final bool isUniversalCategory =
          candidate.category == SkillCategory.utility ||
          candidate.category == SkillCategory.governance;

      final bool isForeignSatelliteOwner =
          knownProductSatellites.contains(candidateOwner) &&
          candidateOwner != currentBunker;

      if (isForeignSatelliteOwner && !isUniversalCategory) {
        return SkillFilterDecision(
          skill: candidate,
          allowed: false,
          rejectionReason:
              FilterRejectionReason.blockedBySatelliteDomainMismatch,
          explanation:
              'Aislamiento de Satélite (§2): Skill pertenece al satélite foráneo "$candidateOwner" '
              'y no corresponde al dominio de "$currentBunker".',
        );
      }
    }

    // Aprobado
    return SkillFilterDecision(
      skill: candidate,
      allowed: true,
      explanation:
          'Skill autorizado para inyección en el contexto del búnker "${profile.id}".',
    );
  }
}
