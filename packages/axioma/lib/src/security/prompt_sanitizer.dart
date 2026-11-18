/// Axioma Prompt Sanitizer & Anti-Prompt Injection Guard (§39 Pure Dart Core)
///
/// Provides strict XML delimitation, threat detection, and neutralization
/// against prompt injections, jailbreaks, delimiter breakouts, and role spoofing (§4, §6, §39).
library;

import 'security_exceptions.dart';

/// Operating modes for [PromptSanitizer].
enum SanitizerMode {
  /// Strict mode: throws [PromptInjectionException] immediately when any threat or
  /// forbidden meta-instruction is detected (§6 Sad Path).
  strict,

  /// Permissive mode: neutralizes forbidden instructions, defangs jailbreak attempts,
  /// escapes XML delimiters safely, and returns safe delimited content without throwing.
  permissive,
}

/// Severity classification of detected prompt injection threats.
enum ThreatSeverity { low, medium, high, critical }

/// Details of a detected threat or suspicious pattern within a prompt.
class PromptThreat {
  /// The canonical identifier of the triggered rule (e.g., "IGNORE_INSTRUCTIONS").
  final String ruleName;

  /// Human-readable explanation of why this pattern is considered malicious.
  final String description;

  /// The exact substring matched from the normalized input.
  final String matchedText;

  /// The character offset where the match begins.
  final int index;

  /// Threat severity level.
  final ThreatSeverity severity;

  const PromptThreat({
    required this.ruleName,
    required this.description,
    required this.matchedText,
    required this.index,
    this.severity = ThreatSeverity.high,
  });

  @override
  String toString() =>
      'PromptThreat($ruleName, severity: $severity, at: $index, matched: "$matchedText")';
}

/// Thrown when a prompt injection attempt, jailbreak meta-instruction,
/// or malicious delimiter breakout is detected in strict mode (§6 Sad Path).
class PromptInjectionException extends SecurityException {
  /// The primary pattern or rule name that triggered this exception.
  final String detectedPattern;

  /// A sanitized snippet showing where the threat was detected.
  final String? snippet;

  /// All threats identified during inspection.
  final List<PromptThreat> threats;

  const PromptInjectionException(
    super.message, {
    required this.detectedPattern,
    this.snippet,
    this.threats = const <PromptThreat>[],
    super.details,
  });
}

/// Immutable result of inspecting and sanitizing a user prompt.
class SanitizationResult {
  /// The original unmodified raw user input.
  final String rawInput;

  /// The sanitized inner content (defanged, escaped, normalized).
  final String sanitizedContent;

  /// The sanitized content securely wrapped in `<user_input>...</user_input>` delimiters.
  final String wrappedContent;

  /// List of threats detected during inspection.
  final List<PromptThreat> threats;

  /// The mode utilized during processing.
  final SanitizerMode mode;

  const SanitizationResult({
    required this.rawInput,
    required this.sanitizedContent,
    required this.wrappedContent,
    required this.threats,
    required this.mode,
  });

  /// True if no threats or suspicious patterns were detected.
  bool get isClean => threats.isEmpty;

  /// True if one or more threats were identified.
  bool get hasThreats => threats.isNotEmpty;
}

/// Internal threat rule specification.
class _ThreatRule {
  final String id;
  final String description;
  final RegExp regex;
  final ThreatSeverity severity;

  const _ThreatRule(this.id, this.description, this.regex, this.severity);
}

/// Production Guard for Prompt Sanitization and Anti-Prompt Injection (§39 Pure Dart Core).
class PromptSanitizer {
  /// Default XML opening delimiter tag.
  static const String xmlStartTag = '<user_input>';

  /// Default XML closing delimiter tag.
  static const String xmlEndTag = '</user_input>';

  /// Invisible and zero-width characters used to evade simple substring filters.
  static final RegExp _invisibleCharsRegex = RegExp(
    r'[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u200E\u200F]',
  );

  /// Control characters excluding standard whitespace (\t, \n, \r).
  static final RegExp _controlCharsRegex = RegExp(
    r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]',
  );

  /// Bidirectional override characters used in Trojan Source / RTL attacks.
  static final RegExp _bidiOverridesRegex = RegExp(
    r'[\u202A-\u202E\u2066-\u2069]',
  );

  /// Canonical catalog of built-in detection rules.
  static final List<_ThreatRule> _canonicalRules = <_ThreatRule>[
    _ThreatRule(
      'IGNORE_INSTRUCTIONS',
      'Attempts to disregard, ignore, forget or reset prior instructions.',
      RegExp(
        r'\b(?:ignore|disregard|forget|reset)\s+(?:all\s+|the\s+|your\s+)?(?:previous|prior|above|system)\s+(?:instructions?|prompts?|rules?|directives?|constraints?)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.critical,
    ),
    _ThreatRule(
      'SYSTEM_PROMPT_OVERRIDE',
      'Attempts to override, replace or define a new system prompt.',
      RegExp(
        r'\b(?:system\s+prompt\s+override|override\s+system\s+prompt|new\s+system\s+prompt|replace\s+system\s+prompt|override\s+your\s+instructions?)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.critical,
    ),
    _ThreatRule(
      'DEVELOPER_MODE_JAILBREAK',
      'Attempts to activate Developer Mode, DAN, or unrestricted jailbreak states.',
      RegExp(
        r'\b(?:developer\s+mode(?:\s+(?:enabled|on|activate|active))?|dan\s+mode|(?:you\s+are\s+|act\s+as\s+)dan\b|do\s+anything\s+now|jailbreak(?:\s+mode)?)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.critical,
    ),
    _ThreatRule(
      'UNRESTRICTED_AI_ROLEPLAY',
      'Attempts to force the model to assume an unrestricted, unfiltered, or lawless persona.',
      RegExp(
        r'\b(?:you\s+are\s+now\s+an?\s+(?:unrestricted|unfiltered|jailbroken|uncensored)\s+(?:ai|assistant|model|bot)|act\s+as\s+an?\s+(?:unrestricted|unfiltered|jailbroken|uncensored))\b',
        caseSensitive: false,
      ),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'BYPASS_SAFETY_GUIDELINES',
      'Attempts to bypass safety, ethics, content guidelines or guardrails.',
      RegExp(
        r'\b(?:bypass|disable|circumvent)\s+(?:all\s+)?(?:safety|content|ethical)?\s*(?:guidelines|filters|restrictions|guardrails|policies)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'PRETEND_NO_RULES',
      'Requests the model to pretend it has no rules or constraints.',
      RegExp(
        r'\bpretend\s+(?:that\s+)?you\s+have\s+no\s+(?:rules|restrictions|limits|guidelines|guardrails|filters)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'REVEAL_SYSTEM_PROMPT',
      'Attempts to extract, print, reveal or dump the hidden system instructions.',
      RegExp(
        r'\b(?:reveal|print|show|output|repeat|dump)\s+(?:all\s+|the\s+|your\s+)?(?:system|initial|base|hidden)\s+(?:prompt|instructions?|directives?)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'INQUIRE_SYSTEM_INSTRUCTIONS',
      'Direct inquiries intended to reverse-engineer system instructions.',
      RegExp(
        r'\bwhat\s+(?:are|were)\s+your\s+(?:exact\s+)?(?:system\s+)?(?:instructions|prompts?|directives?)\b',
        caseSensitive: false,
      ),
      ThreatSeverity.medium,
    ),
    _ThreatRule(
      'XML_DELIMITER_BREAKOUT',
      'Attempts to prematurely close or inject XML isolation tags.',
      RegExp(r'<\s*/?\s*user_input\s*>', caseSensitive: false),
      ThreatSeverity.critical,
    ),
    _ThreatRule(
      'CDATA_COMMENT_BREAKOUT',
      'Attempts to break parser context via XML comments or CDATA markers.',
      RegExp(r'<!\[CDATA\[|\]\]>|<!--|-->', caseSensitive: false),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'CHATML_TOKEN_INJECTION',
      'ChatML special tokens designed to inject artificial conversation boundaries.',
      RegExp(
        r'<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>',
        caseSensitive: false,
      ),
      ThreatSeverity.critical,
    ),
    _ThreatRule(
      'LLAMA_INST_TOKEN_INJECTION',
      'Llama/Alpaca instruction boundary tokens.',
      RegExp(r'\[/?INST\]', caseSensitive: false),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'ROLE_SPOOFING_HEADER',
      'Line-anchored role spoofing targeting raw prompt templates.',
      RegExp(
        r'(?:^|\n)\s*(?:system|assistant|developer)\s*:',
        caseSensitive: false,
      ),
      ThreatSeverity.high,
    ),
    _ThreatRule(
      'CONTROL_CHAR_INJECTION',
      'Malicious non-printable control characters or null bytes.',
      _controlCharsRegex,
      ThreatSeverity.medium,
    ),
    _ThreatRule(
      'BIDI_OVERRIDE_INJECTION',
      'Bidirectional override characters used to visually mask injection payloads.',
      _bidiOverridesRegex,
      ThreatSeverity.medium,
    ),
  ];

  /// The active operating mode for this sanitizer instance.
  final SanitizerMode defaultMode;

  /// Whether to convert standard XML entities (&, <, >, ", ') into XML safe entities.
  final bool escapeXmlEntities;

  /// Whether to strip invisible, zero-width, and bidirectional override characters.
  final bool stripInvisibleChars;

  /// Optional maximum allowed input character length.
  final int? maxInputLength;

  /// Custom supplementary threat rules.
  final List<RegExp> customThreatRules;

  const PromptSanitizer({
    this.defaultMode = SanitizerMode.strict,
    this.escapeXmlEntities = true,
    this.stripInvisibleChars = true,
    this.maxInputLength,
    this.customThreatRules = const <RegExp>[],
  });

  /// Normalizes [input] by:
  /// 1. Replacing non-breaking spaces with standard spaces.
  /// 2. Removing zero-width and invisible characters if [stripInvisibleChars] is enabled.
  /// 3. Normalizing consecutive whitespace (preserving newlines).
  String normalize(String input) {
    String text = input.replaceAll('\u00A0', ' ');
    if (stripInvisibleChars) {
      text = text.replaceAll(_invisibleCharsRegex, '');
    }
    return text;
  }

  /// Escapes XML delimiter characters (&, <, >, ", ') into safe entity representations.
  String escapeXml(String input) {
    return input
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
  }

  /// Wraps [content] inside immutable XML `<user_input>` delimiters.
  String wrapInXml(String content) => '$xmlStartTag$content$xmlEndTag';

  /// Removes outer `<user_input>` and `</user_input>` delimiters if present.
  String unwrapXml(String wrapped) {
    final String trimmed = wrapped.trim();
    if (trimmed.startsWith(xmlStartTag) && trimmed.endsWith(xmlEndTag)) {
      return trimmed.substring(
        xmlStartTag.length,
        trimmed.length - xmlEndTag.length,
      );
    }
    return wrapped;
  }

  /// Inspects [input] against all threat rules and returns all detected threats.
  List<PromptThreat> detectThreats(String input) {
    final String normalized = normalize(input);
    final List<PromptThreat> threats = <PromptThreat>[];

    // Built-in canonical rules
    for (final _ThreatRule rule in _canonicalRules) {
      for (final Match match in rule.regex.allMatches(normalized)) {
        threats.add(
          PromptThreat(
            ruleName: rule.id,
            description: rule.description,
            matchedText: match.group(0) ?? '',
            index: match.start,
            severity: rule.severity,
          ),
        );
      }
    }

    // Custom user rules
    for (int i = 0; i < customThreatRules.length; i++) {
      final RegExp customRegex = customThreatRules[i];
      for (final Match match in customRegex.allMatches(normalized)) {
        threats.add(
          PromptThreat(
            ruleName: 'CUSTOM_RULE_${i + 1}',
            description: 'Custom pattern match: ${customRegex.pattern}',
            matchedText: match.group(0) ?? '',
            index: match.start,
            severity: ThreatSeverity.high,
          ),
        );
      }
    }

    // Sort by position in input
    threats.sort(
      (PromptThreat a, PromptThreat b) => a.index.compareTo(b.index),
    );
    return threats;
  }

  /// Inspects and produces a comprehensive [SanitizationResult].
  ///
  /// In [SanitizerMode.strict], throws [PromptInjectionException] if any threat is found.
  /// In [SanitizerMode.permissive], neutralizes threats and safely escapes delimiters.
  SanitizationResult inspect(String input, {SanitizerMode? mode}) {
    final SanitizerMode activeMode = mode ?? defaultMode;

    if (maxInputLength != null && input.length > maxInputLength!) {
      if (activeMode == SanitizerMode.strict) {
        throw PromptInjectionException(
          'Input length (${input.length}) exceeds maximum allowed threshold ($maxInputLength characters).',
          detectedPattern: 'MAX_LENGTH_EXCEEDED',
          details: 'Length: ${input.length}, Max: $maxInputLength',
        );
      }
    }

    final String processedInput =
        (maxInputLength != null && input.length > maxInputLength!)
        ? input.substring(0, maxInputLength!)
        : input;

    final List<PromptThreat> threats = detectThreats(processedInput);

    if (threats.isNotEmpty && activeMode == SanitizerMode.strict) {
      final PromptThreat primary = threats.first;
      final int start = primary.index > 20 ? primary.index - 20 : 0;
      final int end =
          (primary.index + primary.matchedText.length + 20 <
              processedInput.length)
          ? primary.index + primary.matchedText.length + 20
          : processedInput.length;
      final String snippet = processedInput.substring(start, end).trim();

      throw PromptInjectionException(
        'Prompt injection or forbidden meta-instruction detected: "${primary.ruleName}" (${primary.matchedText}).',
        detectedPattern: primary.ruleName,
        snippet: snippet,
        threats: threats,
        details: primary.description,
      );
    }

    // Permissive mode or clean input: build sanitized content
    String safeContent = normalize(processedInput);

    if (threats.isNotEmpty && activeMode == SanitizerMode.permissive) {
      // Neutralize detected meta-instructions and forbidden phrases in permissive mode
      for (final PromptThreat threat in threats) {
        // XML delimiter breakout is handled securely via escaping
        if (threat.ruleName == 'XML_DELIMITER_BREAKOUT' ||
            threat.ruleName == 'CDATA_COMMENT_BREAKOUT' ||
            threat.ruleName == 'CONTROL_CHAR_INJECTION' ||
            threat.ruleName == 'BIDI_OVERRIDE_INJECTION') {
          continue;
        }

        // Defang explicit meta-instructions
        safeContent = safeContent.replaceAll(
          threat.matchedText,
          '[NEUTRALIZED: ${threat.ruleName}]',
        );
      }

      // Neutralize control characters and bidi overrides
      safeContent = safeContent.replaceAll(_controlCharsRegex, '');
      safeContent = safeContent.replaceAll(_bidiOverridesRegex, '');
    }

    // Escape XML delimiters/entities
    if (escapeXmlEntities) {
      safeContent = escapeXml(safeContent);
    } else {
      // Even if generic XML entity escaping is off, strictly defang isolation delimiters
      safeContent = safeContent.replaceAll(
        RegExp(r'<\s*/?\s*user_input\s*>', caseSensitive: false),
        '&lt;user_input_defanged&gt;',
      );
    }

    final String wrapped = wrapInXml(safeContent);

    return SanitizationResult(
      rawInput: input,
      sanitizedContent: safeContent,
      wrappedContent: wrapped,
      threats: threats,
      mode: activeMode,
    );
  }

  /// Sanitizes [input] and returns the safely wrapped string `<user_input>...</user_input>`.
  ///
  /// Throws [PromptInjectionException] in strict mode if malicious instructions are detected (§6 Sad Path).
  String sanitize(String input, {SanitizerMode? mode}) {
    return inspect(input, mode: mode).wrappedContent;
  }

  /// Convenience check returning true if [input] contains no threats or injection attempts.
  bool isClean(String input) => detectThreats(input).isEmpty;

  /// Static convenience helper for quick prompt sanitization with defaults.
  static String sanitizePrompt(
    String input, {
    SanitizerMode mode = SanitizerMode.strict,
    bool escapeXml = true,
  }) {
    final PromptSanitizer sanitizer = PromptSanitizer(
      defaultMode: mode,
      escapeXmlEntities: escapeXml,
    );
    return sanitizer.sanitize(input);
  }

  /// Static convenience helper for inspecting prompt threats.
  static SanitizationResult inspectPrompt(String input) {
    const PromptSanitizer sanitizer = PromptSanitizer(
      defaultMode: SanitizerMode.permissive,
    );
    return sanitizer.inspect(input);
  }
}
