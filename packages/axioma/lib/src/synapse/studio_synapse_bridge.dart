// 🎯 Studio Synapse Bridge — Conector Soberano hacia adstudio-pipeline (§4, §6, §39, §45, §60.5, §60.8)
import '../contracts/context_passport.dart';
import '../contracts/synapse_bridge.dart';
import '../dtos/synapse_task_payload.dart';
import '../protocol/cross_node_exceptions.dart';
import 'task_dispatcher.dart';

/// Formatos de entrega multimedia soportados por Studio Synapse Bridge.
enum StudioDeliveryFormat {
  png('png'),
  svg('svg'),
  mp4('mp4');

  final String extension;
  const StudioDeliveryFormat(this.extension);

  static StudioDeliveryFormat fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final StudioDeliveryFormat f in StudioDeliveryFormat.values) {
      if (f.extension == clean || f.name.toLowerCase() == clean) return f;
    }
    throw FormatException(
      'Formato de entrega no soportado: "$raw". Formatos válidos: png, svg, mp4',
    );
  }
}

/// Arquetipos visuales canónicos para delegación a Studio.
enum StudioVisualArchetype {
  packshotHero('packshot_hero'),
  vectorTypography('vector_typography'),
  lifestyleAi('lifestyle_ai'),
  videoVertical916('video_vertical_9_16');

  final String value;
  const StudioVisualArchetype(this.value);

  static StudioVisualArchetype fromString(String raw) {
    final String clean = raw.trim().toLowerCase();
    for (final StudioVisualArchetype a in StudioVisualArchetype.values) {
      if (a.value == clean || a.name.toLowerCase() == clean) return a;
    }
    throw FormatException(
      'Arquetipo visual no soportado: "$raw". Válidos: packshot_hero, vector_typography, lifestyle_ai, video_vertical_9_16',
    );
  }
}

/// Puente de delegación especializado para que nodos satélites (Levita, BlueMarket)
/// deleguen trabajos de arte y renderizado a Studio (`adstudio-pipeline`) mediante SYNAPSE.
///
/// Protege el Perímetro Sónico generando pasaportes soberanos en zona GREEN y
/// delegando la ejecución sin replicar motores de render (§39, §60.8).
class StudioSynapseBridge {
  final SynapseTaskDispatcher dispatcher;
  final String originNode;
  final String sovereigntyToken;
  final String targetNode;
  final String targetSkill;

  static const String kDefaultTargetNode = 'studio';
  static const String kDefaultTargetSkill = 'adstudio-pipeline';

  StudioSynapseBridge({
    required this.dispatcher,
    required this.originNode,
    required this.sovereigntyToken,
    this.targetNode = kDefaultTargetNode,
    this.targetSkill = kDefaultTargetSkill,
  }) {
    if (originNode.trim().isEmpty) {
      throw const FormatException('originNode no puede estar vacío');
    }
    if (sovereigntyToken.trim().isEmpty) {
      throw const FormatException('sovereigntyToken no puede estar vacío');
    }
    if (targetNode.trim().isEmpty) {
      throw const FormatException('targetNode no puede estar vacío');
    }
    if (targetSkill.trim().isEmpty) {
      throw const FormatException('targetSkill no puede estar vacío');
    }
  }

  /// Delega una orden completa de renderizado creativo a Studio.
  ///
  /// Sad Paths:
  /// - Lanza [FormatException] si jobId, tenantId, headline o archetype son vacíos o inválidos.
  /// - Lanza [NodeSovereigntyException] si la zona de seguridad o pasaporte es adulterado.
  /// - Retorna [SynapseExecutionResult] con código 202 si el nodo destino está offline y
  ///   la tarea fue retenida en SQLite WAL inference_queue.db (§45).
  Future<SynapseExecutionResult> delegateCreativeRender({
    required String jobId,
    required String tenantId,
    required String archetype,
    required String headline,
    String? subheadline,
    String? productImageUrl,
    Map<String, dynamic>? brandDna,
    String outputFormat = 'png',
    List<String> allowedPaths = const <String>[
      'vault/renders/',
      'apps/levita/assets/',
    ],
    Duration passportValidity = const Duration(hours: 2),
    Duration? directTimeout,
    String sprintId = 'N154',
  }) async {
    if (jobId.trim().isEmpty) {
      throw const FormatException('jobId no puede estar vacío');
    }
    if (tenantId.trim().isEmpty) {
      throw const FormatException('tenantId no puede estar vacío');
    }
    if (headline.trim().isEmpty) {
      throw const FormatException('headline no puede estar vacío');
    }

    // Validación canónica de enums
    final StudioVisualArchetype validArch = StudioVisualArchetype.fromString(
      archetype,
    );
    final StudioDeliveryFormat validFmt = StudioDeliveryFormat.fromString(
      outputFormat,
    );

    final DateTime now = DateTime.now().toUtc();
    final ContextPassport passport = ContextPassport(
      passportId: 'PASS-STUDIO-$originNode-$jobId',
      originNode: originNode,
      targetNode: targetNode,
      targetSkill: targetSkill,
      callerIdentity: 'StudioSynapseBridge-$originNode',
      sonicPerimeterZone: 'GREEN',
      sovereigntyToken: sovereigntyToken,
      allowedPathPrefixes: allowedPaths,
      issuedAt: now,
      expiresAt: now.add(passportValidity),
      metadata: <String, dynamic>{
        'job_id': jobId,
        'tenant_id': tenantId,
        'delegation_protocol': 'SYNAPSE_V1',
      },
    );

    final Map<String, dynamic> renderParameters = <String, dynamic>{
      'job_id': jobId,
      'tenant_id': tenantId,
      'archetype': validArch.value,
      'headline': headline,
      if (subheadline != null) ...<String, dynamic>{'subheadline': subheadline},
      if (productImageUrl != null) ...<String, dynamic>{
        'product_image_url': productImageUrl,
      },
      'brand_dna': brandDna ?? <String, dynamic>{},
      'output_format': validFmt.extension,
      'status': 'PENDING',
      'created_at': now.toIso8601String(),
    };

    final SynapseTaskPayload task = SynapseTaskPayload(
      taskId: 'TASK-STUDIO-$jobId',
      passport: passport,
      action: 'DELEGATE_CREATIVE_RENDER',
      parameters: renderParameters,
    );

    return dispatcher.dispatch(
      task,
      sprintId: sprintId,
      directTimeout: directTimeout ?? const Duration(seconds: 5),
    );
  }

  /// Método de conveniencia para delegar un packshot hero promocional.
  Future<SynapseExecutionResult> delegatePackshotHero({
    required String jobId,
    required String tenantId,
    required String headline,
    required String productImageUrl,
    String? subheadline,
    Map<String, dynamic>? brandDna,
    String sprintId = 'N154',
  }) {
    return delegateCreativeRender(
      jobId: jobId,
      tenantId: tenantId,
      archetype: StudioVisualArchetype.packshotHero.value,
      headline: headline,
      subheadline: subheadline,
      productImageUrl: productImageUrl,
      brandDna: brandDna,
      outputFormat: 'png',
      sprintId: sprintId,
    );
  }
}
